'use strict';

var _ = require('lodash');

var FULFILLED = 1;
var REJECTED = 2;
var NOTIFIED = 3;

function qFactory(callLater) {
    function scheduleProcessQueue(rootEval, state) {
        rootEval(function() {
            if (state.status > 0) {
                var result;
                _.forEach(state.pending, function(handlers) {
                    var defer = handlers[0];
                    var fn = handlers[state.status];
                    try {
                        if (_.isFunction(fn)) {
                            defer.resolve(fn(state.value));
                        } else {
                            if (state.status == FULFILLED)
                                defer.resolve(state.value);
                            else
                                defer.reject(state.value);
                        }
                    } catch (err) {
                        defer.reject(err);
                    }
                });
                state.pending = [];
            }
        });
    }

    function Promise() {
        this.$$state = {
            pending: [],
            status: 0
        };

        this.then = function(resolveCb, rejectCb, notifyCb) {
            var result = new Deferred();
            this.$$state.pending.push([result, resolveCb, rejectCb, notifyCb]);
            if (this.$$state.status > 0) {
                scheduleProcessQueue(callLater, this.$$state);
            }
            return result.promise;
        };

        this.catch = function(cb) {
            return this.then(null, cb);
        };

        this.finally = function(cb, notifyCb) {
            var res;
            if (_.isFunction(cb))
                res = cb();
            return this.then(function(val) {
                if (res && _.isFunction(res.then)) {
                    return res.then(function() {
                        return val;
                    });
                } else {
                    return val;
                }
            }, function(rejection) {
                if (res && _.isFunction(res.then)) {
                    return res.then(function() {
                        var d = new Deferred();
                        d.reject(rejection);
                        return d.promise;
                    });
                } else {
                    var d = new Deferred();
                    d.reject(rejection);
                    return d.promise;
                }
            }, notifyCb);
        };
    }

    function Deferred() {
        this.promise = new Promise();
        this.resolve = function(val) {
            if (this.promise.$$state.value !== undefined)
                return;

            if (val && _.isFunction(val.then)) {
                val.then(
                    _.bind(this.resolve, this),
                    _.bind(this.reject, this),
                    _.bind(this.notify, this)
                );
            } else {
                this.promise.$$state.value = val;
                this.promise.$$state.status = FULFILLED;
                scheduleProcessQueue(callLater, this.promise.$$state);
            }
        };
        this.reject = function(val) {
            if (this.promise.$$state.value !== undefined)
                return;

            this.promise.$$state.value = val;
            this.promise.$$state.status = REJECTED;
            scheduleProcessQueue(callLater, this.promise.$$state);
        };

        this.notify = function(val) {
            var state = this.promise.$$state;
            if (state.status === 0) {
                callLater(function() {
                    _.forEach(state.pending, function(handlers) {
                        var notifyCb = handlers[NOTIFIED];
                        if (_.isFunction(notifyCb)) {
                            try {
                                var newMsg = notifyCb(val);
                                handlers[0].notify(newMsg);
                            } catch (err) {
                                // do nothing
                            }
                        } else {
                            handlers[0].notify(val);
                        }
                    });
                });
            }
        };
    }

    var defer = function() {
        return new Deferred();
    };

    var reject = function(val) {
        var d = defer();
        d.reject(val);
        return d.promise;
    };

    var when = function(value, callback, errback, progressback) {
        var d = defer();
        d.resolve(value);
        return d.promise.then(callback, errback, progressback);
    };

    var all = function(promises) {
        var d = defer();
        var counter = 0;
        var res = _.isArray(promises) ? [] : {};
        _.forEach(promises, function(cb, index) {
            counter++;
            when(cb).then(function(val) {
                counter--;
                res[index] = val;
                if (!counter)
                    d.resolve(res);
            }, function(rejection) {
                d.reject(rejection);
            });
        });
        if (!counter)
            d.resolve(res);

        return d.promise;
    };

    var $Q = function Q(resolver) {
        if (!_.isFunction(resolver)) {
            throw 'Expected function, got ' + resolver;
        }
        var d = defer();
        resolver(_.bind(d.resolve, d), _.bind(d.reject, d));
        return d.promise;

    };

    return _.extend($Q, {
        defer: defer,
        reject: reject,
        when: when,
        resolve: when,
        all: all
    });
}

function $QProvider() {
    this.$get = ['$rootScope', function($rootScope) {
        return qFactory(function(callback) {
            $rootScope.$evalAsync(callback);
        });
    }];
}

function $$QProvider() {
    this.$get = function() {
        return qFactory(function(callback) {
            setTimeout(callback, 0);
        });
    };
}

module.exports = {
    $QProvider: $QProvider,
    $$QProvider: $$QProvider
};

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
            } else {
                _.forEach(state.pending, function(handlers) {
                    var notifyCb = handlers[NOTIFIED];
                    if (_.isFunction(notifyCb)) {
                        notifyCb(state.msg);
                    }
                });
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

        this.finally = function(cb) {
            var res = cb();
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
            });
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
                    _.bind(this.reject, this)
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
            this.promise.$$state.msg = val;
            scheduleProcessQueue(callLater, this.promise.$$state);
        };
    }

    var defer = function() {
        return new Deferred();
    };

    var q = {
        defer: defer
    };

    return q;
}

function $QProvider() {
    this.$get = ['$rootScope', function($rootScope) {
        return qFactory(function(callback) {
            $rootScope.$evalAsync(callback);
        });
    }];
}

module.exports = $QProvider;

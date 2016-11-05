'use strict';

var _ = require('lodash');

var FULFILLED = 1;
var REJECTED = 2;

function qFactory(callLater) {

    function scheduleProcessQueue(rootEval, state) {
        rootEval(function() {
            if (state.status > 0) {
                _.forEach(state.pending, function(handlers) {
                    var fn = handlers[state.status];
                    if(_.isFunction(fn)) 
                      fn(state.value)
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

        this.then = function(resolveCb, rejectCb) {
            this.$$state.pending.push([null, resolveCb, rejectCb]);
            if (this.$$state.status > 0) {
                scheduleProcessQueue(callLater, this.$$state);
            }
        };

        this.catch = function(cb) {
            return this.then(null, cb);
        };

        this.finally = function(cb) {
            var fn = function() {
              cb();
            };
            return this.then(fn, fn);
        };
    }

    function Deferred() {
        this.promise = new Promise();
        this.resolve = function(val) {
            if (this.promise.$$state.value !== undefined)
                return;

            this.promise.$$state.value = val;
            this.promise.$$state.status = FULFILLED;
            scheduleProcessQueue(callLater, this.promise.$$state);
        };
        this.reject = function(val) {
            if (this.promise.$$state.value !== undefined)
                return;

            this.promise.$$state.value = val;
            this.promise.$$state.status = REJECTED;
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

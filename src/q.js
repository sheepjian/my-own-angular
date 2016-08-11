'use strict';

var _ = require('lodash');

function qFactory(callLater) {

  function scheduleProcessQueue(rootEval, state) {
    rootEval(function() {
      if (state.status > 0) {
        _.forEach(state.pending, function(cb) {
          cb(state.value);
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

    this.then = function(cb) {
      this.$$state.pending.push(cb);
      if (this.$$state.status > 0) {
        scheduleProcessQueue(callLater, this.$$state);
      }
    };
  }

  function Deferred() {
    this.promise = new Promise();
    this.resolve = function(val) {
      if (this.promise.$$state.value !== undefined)
        return;

      this.promise.$$state.value = val;
      this.promise.$$state.status = 1;
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

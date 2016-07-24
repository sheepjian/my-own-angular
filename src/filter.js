'use strict';

var _ = require('lodash');

var $FilterProvider = function($provide) {
  var filterRegistry = {};

  this.register = function(name, factory) {
    var that =  this;
    if (_.isObject(name)) {
      return _.map(name, function(factory, name) {
        return that.register(name, factory);
      });
    } else {
     return $provide.factory(name+'Filter', factory);
    }
  };

  this.$get = ['$injector', function($injector) {
    return function(name) {
      return $injector.get(name+'Filter');
    };
  }];

  this.register('filter', require('./filter_filter'));
};

$FilterProvider.$inject = ['$provide'];

module.exports = $FilterProvider;

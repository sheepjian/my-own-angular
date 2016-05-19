'use strict';

var _ = require('lodash');

var filterRegistry = {};

var register = function(name, factory) {
  if (_.isObject(name)) {
    return _.map(name, function(factory, name) {
      return register(name, factory);
    });
  } else {
    var filter = factory();
    filterRegistry[name] = filter;
    return filter;
  }
};

var filter = function(name) {
  return filterRegistry[name];
};

module.exports = {
  register: register,
  filter: filter
};

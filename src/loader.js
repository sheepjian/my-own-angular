'use strict';

var _ = require('lodash');

var createModule = function(name, requires, modules) {
  if (name === 'hasOwnProperty') {
    throw 'invalid module name: ' + name;
  }
  var invokeQueue = [];

  var moduleInstance = {
    name: name,
    requires: requires,
    constant: function(key, value) {

      invokeQueue.push(['constant', [key, value]]);
    },
    _invokeQueue: invokeQueue
  };
  modules[name] = moduleInstance;
  return moduleInstance;
};

var getModule = function(name, modules) {
  if (modules.hasOwnProperty(name)) {
    return modules[name];
  } else {
    throw "unknow module: " + name;
  }
};

function setupModuleLoader(window) {
  var ensure = function(obj, name, factory) {
    return obj[name] || (obj[name] = factory());
  };

  var angular = ensure(window, 'angular', Object);

  angular.module = ensure(angular, 'module', function() {
    var modules = {};
    return function(name, requires) {
      if (requires) {
        return createModule(name, requires, modules);
      } else {
        return getModule(name, modules);
      }
    };
  });
}

module.exports = setupModuleLoader;

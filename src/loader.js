'use strict';

var _ = require('lodash');

var createModule = function(name, requires, configFn, modules) {
  if (name === 'hasOwnProperty') {
    throw 'invalid module name: ' + name;
  }
  var invokeQueue = [];
  var configBlocks = [];

  var registerProviderMethod = function(service, method, arrayMethod, queue) {
    return function() {
      queue = queue || invokeQueue;
      var item = [service, method, arguments];
      queue[arrayMethod || 'push'](item);
      return moduleInstance;
    };
  };

  var moduleInstance = {
    name: name,
    requires: requires,
    constant: registerProviderMethod('$provide','constant', 'unshift'),
    provider: registerProviderMethod('$provide','provider'),
    config: registerProviderMethod('$injector','invoke', 'push', configBlocks),
    run: function(fn) {
      moduleInstance._runBlocks.push(fn);
      return moduleInstance;
    },
    _invokeQueue: invokeQueue,
    _runBlocks: [],
    _configBlocks: configBlocks
  };
  if(configFn) {
    moduleInstance.config(configFn);
  }
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
    return function(name, requires, configFn) {
      if (requires) {
        return createModule(name, requires, configFn, modules);
      } else {
        return getModule(name, modules);
      }
    };
  });
}

module.exports = setupModuleLoader;

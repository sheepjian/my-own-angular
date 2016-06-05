'use strict';

var _ = require('lodash');

function ensureSafeKey(name) {
  if (name === 'hasOwnProperty') {
    throw 'invalid module name: ' + name;
  }
}

function createInjector(modulesToLoad) {
  var cache = {};
  var loadedModules = {};

  var injector = {
    has: function(key) {
      return cache.hasOwnProperty(key);
    },
    get: function(key) {
      return cache[key];
    }
  };

  var $provide = {
    constant: function(key, value) {
      ensureSafeKey(key);
      cache[key] = value;
    }
  };

  function loadModule(moduleName) {
    if (!loadedModules.hasOwnProperty(moduleName)) {
      loadedModules[moduleName] = true;
      var module = window.angular.module(moduleName);
      _.forEach(module.requires, function(requireModule) {
        loadModule(requireModule);
      });
      _.forEach(module._invokeQueue, function(invokeArgs) {
        var method = invokeArgs[0];
        var args = invokeArgs[1];
        $provide[method].apply($provide, args);
      });
    }
  }

  _.forEach(modulesToLoad, function(moduleName) {
    loadModule(moduleName);
  });

  return injector;
}

module.exports = createInjector;

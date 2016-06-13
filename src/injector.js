'use strict';

var _ = require('lodash');

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;

function ensureSafeKey(name) {
  if (name === 'hasOwnProperty') {
    throw 'invalid module name: ' + name;
  }
}

function createInjector(modulesToLoad, strictDi) {
  var cache = {};
  var loadedModules = {};

  var injector = {
    has: function(key) {
      return cache.hasOwnProperty(key);
    },
    get: function(key) {
      return cache[key];
    },
    invoke: function(fn, context, locals) {
      var args = _.map(fn.$inject, function(key) {
        if (_.isString(key)) {
          return locals && locals.hasOwnProperty(key) ?
            locals[key] :
            cache[key];
        } else {
          throw 'Incorrect injection token! Expected a string, got' + key;
        }
      });
      return fn.apply(context, args);
    },
    annotate: function(fn) {
      if (_.isArray(fn)) {
        return fn.slice(0, fn.length - 1);
      } else if (fn.$inject) {
        return fn.$inject;
      } else if (!fn.length) {
        return [];
      } else {
        if (strictDi) {
          throw 'fn is not using explicit annotation and' +
            'cannot be invoked in strict mode';
        }
        var argDeclaration = fn.toString().match(FN_ARGS);
        return _.map(argDeclaration[1].split(','), function(argName) {
          return argName.match(FN_ARG)[2];
        });
      }
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

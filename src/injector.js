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
  var providerCache = {};
  var instanceCache = {};

  var getService = function(name) {
    if (instanceCache.hasOwnProperty(name)) {
      return instanceCache[name];
    } else if (providerCache.hasOwnProperty(name + 'Provider')) {
      var provider = providerCache[name + 'Provider'];
      return invoke(provider.$get, provider);
    }
  };

  var annotate = function(fn) {
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
  };

  var invoke = function(fn, context, locals) {
    var args = _.map(annotate(fn), function(key) {
      if (_.isString(key)) {
        return locals && locals.hasOwnProperty(key) ?
          locals[key] :
          getService(key);
      } else {
        throw 'Incorrect injection token! Expected a string, got' + key;
      }
    });
    if (_.isArray(fn)) {
      fn = _.last(fn);
    }
    return fn.apply(context, args);
  };

  var injector = {
    has: function(key) {
      return instanceCache.hasOwnProperty(key) ||
        providerCache.hasOwnProperty(key + 'Provider');
    },
    get: getService,
    invoke: invoke,
    annotate: annotate,
    instantiate: function(type, locals) {
      var UnwrappedType = _.isArray(type) ? _.last(type) : type;
      var instance = Object.create(UnwrappedType.prototype);
      this.invoke(type, instance, locals);
      return instance;
    }
  };

  var $provide = {
    constant: function(key, value) {
      ensureSafeKey(key);
      instanceCache[key] = value;
    },
    provider: function(key, provider) {
      ensureSafeKey(key);
      providerCache[key + 'Provider'] = provider;
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

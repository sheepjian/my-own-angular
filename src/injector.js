'use strict';

var _ = require('lodash');

var FN_ARGS = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;
var FN_ARG = /^\s*(_?)(\S+?)\1\s*$/;
var INSTANTIATING = {};

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
  var dependencyPath = [];

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

  function createInternalInjector(cache, factoryFn) {
    var getService = function(name) {
      if (cache.hasOwnProperty(name)) {
        if (cache[name] === INSTANTIATING) {
          throw new Error('Circular dependency found: ' +
            name + ' <- ' + dependencyPath.join(' <- '));
        }
        return cache[name];
      } else {
        try {
          cache[name] = INSTANTIATING;
          dependencyPath.unshift(name);
          return (cache[name] = factoryFn(name));
        } finally {
          dependencyPath.shift();
          if (cache[name] === INSTANTIATING) {
            delete cache[name];
          }
        }
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

    var instantiate = function(type, locals) {
      var UnwrappedType = _.isArray(type) ? _.last(type) : type;
      var instance = Object.create(UnwrappedType.prototype);
      invoke(type, instance, locals);
      return instance;
    };

    return {
      has: function(key) {
        return cache.hasOwnProperty(key) ||
          providerCache.hasOwnProperty(key + 'Provider');
      },
      get: getService,
      invoke: invoke,
      annotate: annotate,
      instantiate: instantiate
    };
  }

  var providerInjector = createInternalInjector(providerCache, function() {
    throw 'Unknown provider:  ' + dependencyPath.join(' <- ');
  });

  var instanceInjector = createInternalInjector(instanceCache, function(name) {
    var provider = providerInjector.get(name + 'Provider');
    return instanceInjector.invoke(provider.$get, provider);
  });

  instanceCache.$injector = instanceInjector;
  providerCache.$injector = providerInjector;

  var $provide = providerCache.$provide = {
    constant: function(key, value) {
      ensureSafeKey(key);
      providerCache[key] = value;
      instanceCache[key] = value;
    },
    provider: function(key, provider) {
      ensureSafeKey(key);
      if (_.isFunction(provider)) {
        provider = providerInjector.instantiate(provider);
      }
      providerCache[key + 'Provider'] = provider;
    },
    config: function(fn) {
      providerInjector.instantiate(fn);
    }
  };

  function runInvokeQueue(queue) {
    _.forEach(queue, function(invokeArgs) {
      var service = providerInjector.get(invokeArgs[0]);
      var method = invokeArgs[1];
      var args = invokeArgs[2];
      service[method].apply(service, args);
    });
  }

  var runBlocks = [];

  function loadModule(moduleName) {
    if(_.isFunction(moduleName) || _.isArray(moduleName)) {
      runBlocks.push(providerInjector.invoke(moduleName));
    } else if (!loadedModules.hasOwnProperty(moduleName)) {
      loadedModules[moduleName] = true;
      var module = window.angular.module(moduleName);
      _.forEach(module.requires, function(requireModule) {
        loadModule(requireModule);
      });
      runInvokeQueue(module._invokeQueue);
      runInvokeQueue(module._configBlocks);
      runBlocks = runBlocks.concat(module._runBlocks);
    }
  }

  _.forEach(modulesToLoad, function(moduleName) {
    loadModule(moduleName);
  });

  _.forEach(_.compact(runBlocks), function(blockFn) {
    instanceInjector.invoke(blockFn);
  });

  return instanceInjector;
}

module.exports = createInjector;

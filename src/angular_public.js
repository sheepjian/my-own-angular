'use strict';

var setupModuleLoader = require('./loader');
var createInjector = require('./injector');
var filter = require('./filter');
var parse = require('./parse');
var rootScope = require('./scope');
var q = require('./q');

var publishExternalAPI = function() {
  setupModuleLoader(window);
  var ngModule = window.angular.module('ng', []);

  ngModule.provider('$filter', filter);
  ngModule.provider('$parse', parse);
  ngModule.provider('$rootScope', rootScope);
  ngModule.provider('$q', q);
};

module.exports = publishExternalAPI;

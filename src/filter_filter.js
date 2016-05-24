'use strict';

var _ = require('lodash');

function deepCompare(actual, expected, comparator) {
  if (_.isObject(actual)) {
    return _.some(actual, function(value) {
      return deepCompare(value, expected, comparator);
    });
  } else {
    return comparator(actual, expected);
  }
}

function stringComparator(actual, expected) {
  actual = actual.toLowerCase();
  expected = expected.toLowerCase();
  return actual.indexOf(expected) !== -1;
}

function defaultComparator(actual, expected) {
  return actual === expected;
}



function createPredicateFn(expression, type) {
  var comparator;
  if(type === 'string') {
    comparator = stringComparator;
  } else {
    comparator = defaultComparator;
  }
  return function predicateFn(item) {
    return deepCompare(item, expression, comparator);
  };
}

function filterFilter() {
  return function(array, filterExpr) {
    var predicateFn;
    if (_.isFunction(filterExpr)) {
      predicateFn = filterExpr;
    } else if (_.isString(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr, 'string');
    } else if (_.isNumber(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr, 'number');
    } else if (_.isBoolean(filterExpr)) {
      predicateFn = createPredicateFn(filterExpr, 'boolean');
    } else {
      return array;
    }
    return _.filter(array, predicateFn);
  };
}
module.exports = filterFilter;

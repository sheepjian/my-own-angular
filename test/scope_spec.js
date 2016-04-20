'use strict';

var Scope = require('../src/scope');
var _ = require('lodash');

describe("Scope--->", function() {
	it("can be constructed and used as an object", function() {
		var scope = new Scope();
		scope.aProperty = 1;
		expect(scope.aProperty).toBe(1);
	});

	describe("digest--->", function() {
		var scope;

		beforeEach(function() {
			scope = new Scope();
		});

		it("calls the listener function of a watch on first $digest",
			function() {
				var watchFn = function() {
					return 'wat';
				};
				var listenerFn = jasmine.createSpy();

				scope.$watch(watchFn, listenerFn);
				scope.$digest();

				expect(listenerFn).toHaveBeenCalled();
			});

		it("calls the watch function with the scope as the argument",
			function() {
				var watchFn = jasmine.createSpy();
				var listenerFn = function() {};

				scope.$watch(watchFn, listenerFn);
				scope.$digest();

				expect(watchFn).toHaveBeenCalledWith(scope);
			});

		it("call the listern function when the watched value changes",
			function() {
				scope.someValue = 0;
				scope.counter = 0;

				var watchFn = function(someScope) {
					return someScope.someValue;
				};

				var listenerFn = function(newValue, oldValue, someScope) {
					someScope.counter++;
				};

				scope.$watch(watchFn, listenerFn);
				expect(scope.counter).toBe(0);

				scope.$digest();
				expect(scope.counter).toBe(1);

				scope.$digest();
				expect(scope.counter).toBe(1);

				scope.someValue = 1;
				expect(scope.counter).toBe(1);

				scope.$digest();
				expect(scope.counter).toBe(2);
			});

		it("calls listener when watch value is first undefined", function() {
			scope.counter = 0;
			scope.$watch(
				function(scope) {
					return scope.someValue;
				},
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
		});

		it("calls listener with new value as old value the first time", function() {
			scope.someValue = 123;
			var oldValueGiven;
			scope.$watch(
				function(scope) {
					return scope.someValue;
				},
				function(newValue, oldValue, scope) {
					oldValueGiven = oldValue;
				}
			);
			scope.$digest();
			expect(oldValueGiven).toBe(123);
		});

		it("may have watchers that omit the listener function", function() {
			var watchFn = jasmine.createSpy().and.returnValue('something');
			scope.$watch(watchFn);
			scope.$digest();
			expect(watchFn).toHaveBeenCalled();
		});

		it("triggers chained watchers in the same digest", function() {
			scope.name = 'Jane';

			// this order of watchers will call the digest function three times
			// reverse the order, the calling time will be 2
			// this may cost very much when updating the watcher of the DOM
			// reactiveJS solve this issue to compute the equilibrium state in the memory
			// TODO: find the optimal way to order the watchers 
			// Idea: use truth table for building the topological order 
			// How to prove the topological order is the optimal updating strategy? 
			scope.$watch(
				function(scope) {
					return scope.nameUpper;
				},
				function(newValue, oldValue, scope) {
					if (newValue) {
						scope.initial = newValue.substring(0, 1) + '.';
					}
				}
			);
			scope.$watch(
				function(scope) {
					return scope.name;
				},
				function(newValue, oldValue, scope) {
					if (newValue) {
						scope.nameUpper = newValue.toUpperCase();
					}
				}
			);
			scope.$digest();
			expect(scope.initial).toBe('J.');
			scope.name = 'Bob';
			scope.$digest();
			expect(scope.initial).toBe('B.');
		});

		it("gives up on the watches after 10 iterations", function() {
			scope.counterA = 0;
			scope.counterB = 0;
			scope.$watch(
				function(scope) {
					return scope.counterA;
				},
				function(newValue, oldValue, scope) {
					scope.counterB++;
				}
			);
			scope.$watch(
				function(scope) {
					return scope.counterB;
				},
				function(newValue, oldValue, scope) {
					scope.counterA++;
				}
			);
			expect((function() {
				scope.$digest();
			})).toThrow();
		});

		it("test the superDigestOnce method", function() {
			scope.a = 0;
			scope.b = 1;
			scope.c = 2;
			scope.d = 4;

			scope.$watch(
				function(scope) {
					return scope.d;
				},
				function(newValue, oldValue, scope) {}
			);
			scope.$watch(
				function(scope) {
					return scope.c;
				},
				function(newValue, oldValue, scope) {
					scope.d++;
				}
			);
			scope.$watch(
				function(scope) {
					return scope.b;
				},
				function(newValue, oldValue, scope) {
					scope.c++;
				}
			);
			scope.$watch(
				function(scope) {
					return scope.a;
				},
				function(newValue, oldValue, scope) {
					scope.b++;
				}
			);
			var digestRound = scope.$digest(false);
			//console.log('Digest Rounds with no optimization is '+digestRound);

			scope.a = 1;
			var optimizingDigestRound = scope.$digest(true);
			//console.log('Digest Rounds during optimization is '+digestRound);

			scope.a = 2;
			var optimizedDigestRound = scope.$digest(true);
			//console.log('Digest Rounds after optimization is '+digestRound);

			expect(optimizingDigestRound >= optimizedDigestRound).toBe(true);
		});

		it("ends the digest when the last watch is clean", function() {
			scope.array = _.range(100);
			var watchExecutions = 0;
			_.times(100, function(i) {
				scope.$watch(
					function(scope) {
						watchExecutions++;
						return scope.array[i];
					},
					function(newValue, oldValue, scope) {}
				);
			});
			scope.$digest();
			expect(watchExecutions).toBe(200);
			scope.array[0] = 420;
			scope.$digest();
			expect(watchExecutions).toBe(301);

			// the short circuit optimization doest not make too much difference for worst case
			scope.array[99] = 420;
			scope.$digest();
			expect(watchExecutions).toBe(501);
		});

		it("does not end digest so that new watches are not run", function() {
			scope.aValue = 'abc';
			scope.counter = 0;
			scope.$watch(
				function(scope) {
					return scope.aValue;
				},
				function(newValue, oldValue, scope) {
					scope.$watch(
						function(scope) {
							return scope.aValue;
						},
						function(newValue, oldValue, scope) {
							scope.counter++;
						}
					);
				}
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
		});

		it("compares based on value if enabled", function() {
			scope.aValue = [1, 2, 3];
			scope.counter = 0;

			scope.$watch(
				function(scope) {
					return scope.aValue;
				},
				function(newValue, oldValue, scope) {
					scope.counter++;
				},
				true
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
			scope.aValue.push(4);
			scope.$digest();
			expect(scope.counter).toBe(2);
		});

		it("correctly handles NaNs", function() {
			scope.number = 0 / 0; // NaN
			scope.counter = 0;
			scope.$watch(
				function(scope) {
					return scope.number;
				},
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
			scope.$digest();
			expect(scope.counter).toBe(1);
		});

		it("executes $eval'ed function and returns result", function() {
			scope.aValue = 42;
			var result = scope.$eval(function(scope) {
				return scope.aValue;
			});
			expect(result).toBe(42);
		});

		it("passes the second $eval argument straight through", function() {
			scope.aValue = 42;
			var result = scope.$eval(function(scope, arg) {
				return scope.aValue + arg;
			}, 2);
			expect(result).toBe(44);
		});

		it("executes $apply'ed function and starts the digest", function() {
			scope.aValue = 'someValue';
			scope.counter = 0;
			scope.$watch(
				function(scope) {
					return scope.aValue;
				},
				function(newValue, oldValue, scope) {
					scope.counter++;
				}
			);
			scope.$digest();
			expect(scope.counter).toBe(1);
			scope.$apply(function(scope) {
				scope.aValue = 'someOtherValue';
			});
			expect(scope.counter).toBe(2);
		});



	});
});
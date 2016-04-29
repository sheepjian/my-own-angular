'use strict';
var _ = require('lodash');

function Scope() {
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
	this.$$asyncQueue = [];
	this.$$applyAsyncQueue = [];
	this.$$applyAsyncId = null;
	this.$$postDigestQueue = [];
	this.$$phase = null;
	this.$$children = [];
	this.$$parent = null;
	this.$$root = this;
}

var initWatchVal = function() {};

Scope.prototype.$$superDigestOnce = function() {
	var self = this;
	var newValue, oldValue, dirty;
	var cleanWatcher = [];
	var dirtyWatcher = [];
	_.forEach(this.$$watchers, function(watcher) {
		try {
			newValue = watcher.watchFn(self);
			oldValue = watcher.last;
			if (self.dirtyCheck(newValue, oldValue, watcher.valueEq)) {
				watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
				if (oldValue === initWatchVal) {
					oldValue = newValue;
				}
				watcher.listenFn(newValue, oldValue, self);
				dirty = true;
			}
		} catch (e) {

		}
	});
	_.forEach(this.$$watchers, function(watcher) {
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if (self.dirtyCheck(newValue, oldValue)) {
			dirtyWatcher.push(watcher);
		} else {
			cleanWatcher.push(watcher);
		}
	});
	this.$$watchers = cleanWatcher.concat(dirtyWatcher);
	return dirty;
};

Scope.prototype.dirtyCheck = function(oldValue, newValue, valueEq) {
	if ((typeof newValue === 'number' && typeof oldValue === 'number' &&
			isNaN(newValue) && isNaN(oldValue)))
		return false;

	if (valueEq) {
		return !_.isEqual(oldValue, newValue);
	} else {
		return (oldValue !== newValue);
	}
};

Scope.prototype.$$digestOnce = function() {
	var self = this;
	var newValue, oldValue, dirty;
	var currentWatchers;

	_.forEachRight(self.$$watchers, function(watcher) {
		try {
			newValue = watcher.watchFn(self);
			oldValue = watcher.last;
			if (self.dirtyCheck(newValue, oldValue, watcher.valueEq)) {
				self.$$root.$$lastDirtyWatch = watcher;
				watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
				if (oldValue === initWatchVal) {
					oldValue = newValue;
				}
				watcher.listenFn(newValue, oldValue, self);
				dirty = true;
			} else if (self.$$root.$$lastDirtyWatch === watcher) {
				return false;
			}
		} catch (e) {
			// leave it alone, will delegate the task to $exceptionService
			//console.error(e);
		}
	});
	return dirty;
};

Scope.prototype.$digest = function(isSuperDigest) {
	var dirty;
	var counter = 0;
	var upperBound = 10;
	this.$$root.$$lastDirtyWatch = null;
	this.$beginPhase('$digest');

	if (this.$$applyAsyncId) {
		clearTimeout(this.$$applyAsyncId);
		this.$$flushApplyAsync();
	}

	do {
		while (this.$$asyncQueue.length) {
			var asyncTask = this.$$asyncQueue.shift();
			this.$eval(asyncTask);
		}
		if (isSuperDigest)
			dirty = this.$$superDigestOnce();
		else
			dirty = this.$$digestOnce();
		counter++;
	} while ((dirty || this.$$asyncQueue.length) && counter <= upperBound);
	if (dirty || this.$$asyncQueue.length)
		throw upperBound + " digest iterations reached";

	while (this.$$postDigestQueue.length) {
		this.$eval(this.$$postDigestQueue.shift());
	}
	_.forEach(this.$$children, function(childScope) {
		childScope.$digest();
	});
	this.$clearPhase();
	return counter;
};

Scope.prototype.$watch = function(watchFn, listenFn, valueEq) {
	var watcher = {
		watchFn: watchFn,
		listenFn: listenFn || function() {},
		last: initWatchVal,
		valueEq: !!valueEq
	};

	this.$$watchers.unshift(watcher);
	this.$$root.$$lastDirtyWatch = null;
	var self = this;

	return function() {
		var index = self.$$watchers.indexOf(watcher);
		if (index >= 0) {
			self.$$watchers.splice(index, 1);
		}
	};
};

Scope.prototype.$eval = function(evalFn, args) {
	try {
		return evalFn(this, args);
	} catch (e) {
		// leave it alone, will delegate the task to $exceptionService
		//console.error(e);
	}
};

Scope.prototype.$evalAsync = function(evalFn) {
	var self = this;
	// one time flush in the same digest
	if (!self.$$phase && !self.$$asyncQueue.length) {
		setTimeout(function() {
			self.$$root.$digest();
		}, 0);
	}
	this.$$asyncQueue.push(evalFn);
};

Scope.prototype.$apply = function(applyFn) {
	// don't use apply in the mid of the digest phase
	try {
		this.$beginPhase('$apply');
		this.$eval(applyFn);
	} finally {
		this.$clearPhase();
		this.$$root.$digest();
	}
};

Scope.prototype.$applyAsync = function(applyFn) {
	var self = this;
	self.$$applyAsyncQueue.push(function() {
		self.$eval(applyFn);
	});
	// one time flush for the whole queue after the digest queue
	// avoid the apply conflicts with digest
	if (self.$$applyAsyncId === null) {
		self.$$applyAsyncId = setTimeout(function() {
			self.$apply(_.bind(self.$$flushApplyAsync, self));
		}, 0);
	}
};

Scope.prototype.$$flushApplyAsync = function() {
	while (this.$$applyAsyncQueue.length) {
		this.$eval(this.$$applyAsyncQueue.shift());
	}
	this.$$applyAsyncId = null;
};

Scope.prototype.$beginPhase = function(phase) {
	// this is how the digest conflict happens
	if (this.$$phase) {
		throw this.$$phase + ' already in progress.';
	}
	this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
	this.$$phase = null;
};

Scope.prototype.$$postDigest = function(cb) {
	this.$$postDigestQueue.push(cb);
};

// compare my implemetation with solution of the book
// less code, more power
// think is more improtant than code
Scope.prototype.$watchGroup = function(watchFnArray, listenFn) {
	var self = this;
	var watchFns = function(scope) {
		return _.map(watchFnArray, function(watchFn) {
			return watchFn(scope);
		});
	};
	return self.$watch(watchFns, listenFn, true);
};


/*
 *
 *  Scope Inheritance
 *
 */
Scope.prototype.$new = function(isolated, anotherParent) {
	var child;
	if (!isolated) {
		// this shows how Object.create() is implemented
		var ChildScopeConstrucor = function() {};
		ChildScopeConstrucor.prototype = this;
		child = new ChildScopeConstrucor();
		Scope.call(child);
	} else {
		child = new Scope();
	}

	anotherParent = anotherParent || this;
	child.$$parent = anotherParent;
	child.$$root = anotherParent.$$root;
	anotherParent.$$children.push(child);

	return child;
};

Scope.prototype.$destroy = function() {
	if (this.$$parent) {
		var index = this.$$parent.$$children.indexOf(this);
		if (index >= 0) {
			this.$$parent.$$children.splice(index, 1);
		}
	}
	this.$$watchers = null;
};

function isArrayLike(obj) {
	if (_.isNull(obj) || _.isUndefined(obj)) {
		return false;
	}
	var length = obj.length;
	return _.isNumber(length);
}


Scope.prototype.$watchCollection = function(watchFn, listenerFn) {
	var newValue, oldValue;
	var self = this;
	var changeCount = 0;
	var arrayLength = 0;

	var internalWatchFn = function(scope) {
		newValue = watchFn(scope);
		if (_.isObject(newValue)) {
			if (isArrayLike(newValue)) {
				if (!_.isArray(oldValue)) {
					oldValue = [];
				}
				if (oldValue.length != newValue.length) {
					oldValue.length = newValue.length;
				}
				_.forEach(newValue, function(newItem, i) {
					var bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
					if (!bothNaN && newItem !== oldValue[i]) {
						changeCount++;
						oldValue[i] = newItem;
					}
				});
			} else {
				if (!_.isObject(oldValue) || isArrayLike(oldValue)) {
					changeCount++;
					oldValue = {};
				}
				_.forOwn(newValue, function(newVal, key) {
					var bothNaN = _.isNaN(newVal) && _.isNaN(oldValue[key]);
					if (!bothNaN && oldValue[key] !== newVal) {
						changeCount++;
						oldValue[key] = newVal;
					}
				});
				_.forOwn(oldValue, function(oldVal, key) {
					if (!newValue.hasOwnProperty(key)) {
						changeCount++;
						//watch out for `delete oldValue.key`, it is different because of prototype chain
						delete oldValue[key];
					}
				});
			}
		} else {
			if (newValue !== oldValue && !isNaN(newValue)) {
				changeCount++;
			}
			oldValue = newValue;
		}

		return changeCount;
	};
	var internalListenerFn = function() {
		listenerFn(newValue, oldValue, self);
	};

	return this.$watch(internalWatchFn, internalListenerFn);
};



module.exports = Scope;
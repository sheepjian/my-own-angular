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
				self.$$lastDirtyWatch = watcher;
				watcher.last = (watcher.valueEq ? _.cloneDeep(newValue) : newValue);
				if (oldValue === initWatchVal) {
					oldValue = newValue;
				}
				watcher.listenFn(newValue, oldValue, self);
				dirty = true;
			} else if (self.$$lastDirtyWatch === watcher) {
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
	this.$$lastDirtyWatch = null;
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
	this.$$lastDirtyWatch = null;
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
			self.$digest();
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
		this.$digest();
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
Scope.prototype.$new = function() {
	// this shows how Object.create() is implemented
	var ChildScopeConstrucor = function() {};
	ChildScopeConstrucor.prototype = this;
	var child = new ChildScopeConstrucor();
	Scope.call(child);
	this.$$children.push(child);
	return child;
};

module.exports = Scope;
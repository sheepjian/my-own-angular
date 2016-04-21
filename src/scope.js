'use strict';
var _ = require('lodash');

function Scope() {
	this.$$watchers = [];
	this.$$lastDirtyWatch = null;
	this.$$asyncQueue = [];
	this.$$phase = null;
}

var initWatchVal = function() {};

Scope.prototype.$$superDigestOnce = function() {
	var self = this;
	var newValue, oldValue, dirty;
	var cleanWatcher = [];
	var dirtyWatcher = [];
	_.forEach(this.$$watchers, function(watcher) {
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if (self.dirtyCheck(newValue, oldValue)) {
			watcher.last = newValue;
			if (oldValue === initWatchVal) {
				oldValue = newValue;
			}
			watcher.listenFn(newValue, oldValue, self);
			dirty = true;
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

	_.forEach(self.$$watchers, function(watcher) {
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
	});
	return dirty;
};

Scope.prototype.$digest = function(isSuperDigest) {
	var dirty;
	var counter = 0;
	var upperBound = 10;
	this.$$lastDirtyWatch = null;
	this.$beginPhase('$digest');
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

	this.$$watchers.push(watcher);
	this.$$lastDirtyWatch = null;
};

Scope.prototype.$eval = function(evalFn, args) {
	return evalFn(this, args);
};

Scope.prototype.$evalAsync = function(evalFn) {
	var self = this;
	if(!self.$$phase && !self.$$asyncQueue.length) {
		setTimeout(function() {
			self.$digest();
		}, 0);
	}
	this.$$asyncQueue.push(evalFn);
};

Scope.prototype.$apply = function(applyFn) {
	try {
		this.$beginPhase('$apply');
		this.$eval(applyFn);
	} finally {
		this.$clearPhase();
		this.$digest();
	}
};

Scope.prototype.$beginPhase = function(phase) {
	if (this.$$phase) {
		throw this.$$phase + ' already in progress.';
	}
	this.$$phase = phase;
};

Scope.prototype.$clearPhase = function() {
	this.$$phase = null;
};


module.exports = Scope;
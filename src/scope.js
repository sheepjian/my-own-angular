'use strict';
var _ = require('lodash');

function Scope() {
	this.$$watchers = [];
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
		if(self.dirtyCheck(newValue, oldValue)) {
			watcher.last = newValue;
			if(oldValue === initWatchVal) {
				oldValue = newValue;
			}
			watcher.listenFn(newValue, oldValue, self);
			dirty = true;
		}
	});
	_.forEach(this.$$watchers, function(watcher) {
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if(self.dirtyCheck(newValue, oldValue)) {
			dirtyWatcher.push(watcher);
		} else {
			cleanWatcher.push(watcher);
		}
	});
	this.$$watchers = cleanWatcher.concat(dirtyWatcher);
	return dirty;
};

Scope.prototype.dirtyCheck = function(oldValue, newValue) {
	return oldValue !== newValue;
};

Scope.prototype.$$digestOnce = function() {
	var self = this;
	var newValue, oldValue, dirty;
	_.forEach(this.$$watchers, function(watcher) {
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if(self.dirtyCheck(newValue, oldValue)) {
			watcher.last = newValue;
			if(oldValue === initWatchVal) {
				oldValue = newValue;
			}
			watcher.listenFn(newValue, oldValue, self);
			dirty = true;
		}
	});
	return dirty;
};

Scope.prototype.$digest = function(isSuperDigest) {
	var dirty;
	var counter = 0;
	do {
		if(isSuperDigest)
			dirty = this.$$superDigestOnce();
		else
			dirty = this.$$digestOnce();
		counter++;
	} while (dirty && counter<=10);
	if(dirty)
		throw "10 digest iterations reached";

	return counter;
};

Scope.prototype.$watch = function(watchFn, listenFn) {
	var watcher = {
		watchFn: watchFn,
		listenFn: listenFn || function() {},
		last: initWatchVal
	};

	this.$$watchers.push(watcher);
};

module.exports = Scope;
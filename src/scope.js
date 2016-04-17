'use strict';
var _ = require('lodash');

function Scope() {
	this.$$watchers = [];
}

Scope.prototype.dirtyCheck = function(oldValue, newValue) {
	return oldValue !== newValue;
};

Scope.prototype.$digest = function() {
	var self = this;
	var newValue, oldValue;
	_.forEach(this.$$watchers, function(watcher) {
		newValue = watcher.watchFn(self);
		oldValue = watcher.last;
		if(self.dirtyCheck(newValue, oldValue)) {
			watcher.last = newValue;
			watcher.listenFn(newValue, oldValue, self);
		}
	});
};

Scope.prototype.$watch = function(watchFn, listenFn) {
	var watcher = {
		watchFn: watchFn,
		listenFn: listenFn
	};

	this.$$watchers.push(watcher);
};

module.exports = Scope;
/**
 * Shims built-in async functions and automatically wraps callbacks with "wrap"
 * @param {function} wrap The function to return the new callback
 */
module.exports = function hook(wrap) {
	if (alreadyRequired) throw new Error("This should only be required and used once")
	alreadyRequired = true
	
	// Wrap setTimeout and setInterval
	;["setTimeout", "setInterval"].forEach(function (name) {
		var original = this[name]
		this[name] = function (callback) {
			arguments[0] = wrap(callback, name)
			return original.apply(this, arguments)
		}
	})
	
	// Wrap process.nextTick
	var nextTick = process.nextTick
	process.nextTick = function wrappedNextTick(callback) {
		return nextTick.call(this, wrap(callback, 'process.nextTick'))
	}
	
	// Wrap FS module async functions
	var FS = require('fs')
	Object.keys(FS).forEach(function (name) {
		// If it has a *Sync counterpart, it's probably async
		if (!FS.hasOwnProperty(name + "Sync")) return
		var original = FS[name]
		FS[name] = function () {
			var i = arguments.length - 1
			if (typeof arguments[i] === 'function') {
				arguments[i] = wrap(arguments[i], 'fs.'+name)
			}
			return original.apply(this, arguments)
		}
	})
	
	// Wrap EventEmitters
	var EventEmitter = require('events').EventEmitter
	var onEvent = EventEmitter.prototype.on
	EventEmitter.prototype.on = EventEmitter.prototype.addListener = function (type, listener) {
		var self = this
			, list
			, id
			, origListener = listener

		if (this === process && type === 'uncaughtException') {
			listener = function(e) {
				if (e.domain == null) origListener(e)
			}
		}

		self._hookListeners = self._hookListeners || {}
		id = listener._hookId = listener._hookId || ''+process.hrtime()
		self._hookListeners[id] = self._hookListeners[id] || {}

		if (!self._hookListeners[id][type]) {
			self._hookListeners[id][type] = []
			self._hookListeners[id][type].callback = function() {
				var args = arguments
					, list = self._hookListeners[id][type]

		    for (var i = 0, length = list.length; i < length; i++) {
			    list[i].apply(self, args)
		    }
			}
		}

		self._hookListeners[id][type].push(wrap(listener, 'EventEmitter.on'))
		return onEvent.call(this, type, self._hookListeners[id][type].callback)
	}
	var removeEvent = EventEmitter.prototype.removeListener
	EventEmitter.prototype.removeListener = function (type, listener) {
		var empty = true
			, id = listener._hookId
			, list
			, hookListener
			, hookCallback

		if (this._hookListeners &&
				this._hookListeners[id] &&
				this._hookListeners[id][type]) {
			hookCallback = this._hookListeners[id][type].callback
			hookListener = this._hookListeners[id]
			list = hookListener[type]

			list.shift()
			if (!list.length) {
				delete hookListener[type]
			}
			for (var i in hookListener) {
				if (hookListener.hasOwnProperty(i)) {
					empty = false
					break;
				}
			}
			if (empty) {
				delete this._hookListeners[id]
			}
			listener = hookCallback
		}
		return removeEvent.call(this, type, listener)
	}
	var removeAll = EventEmitter.prototype.removeAllListeners
	EventEmitter.prototype.removeAllListeners = function (type) {
		for (var id in this._hookListeners) {
			if (this._hookListeners.hasOwnProperty(id)) {
				if (this._hookListeners[id][type]) {
					delete this._hookListeners[id][type]
				}
			}
		}
		return removeAll.call(this, type)
	}
}

// If we delete an EventEmitter, we have a memory leak
var alreadyRequired

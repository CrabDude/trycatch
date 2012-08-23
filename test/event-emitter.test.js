var assert = require('assert'),
		util = require("util"),
		events = require("events"),
		trycatch = require('../lib/trycatch')

/*
		Since trycatch assumes EventEmitter callbacks are called asynchronously,
		this test is to test whether the proper catch functions are called when
		EventEmitter.emit is called synchronously

	To run this test:	node ./event-emitter.test.js
*/

describe('EventEmitter', function() {
	function EE() {
		this.on('sync', this.onSync)
		this.on('async', this.onAsync)
	}
	util.inherits(EE, events.EventEmitter);
	EE.prototype.sync = function() {
		this.emit('sync')
	}
	EE.prototype.onSync = function() {
		throw new Error('Sync')
	}
	EE.prototype.async = function() {
		var self = this

		setTimeout(function() {
			self.emit('async')
		}, 0)
	}
	EE.prototype.onAsync = function() {
		throw new Error('Async')
	}

	it('should catch when emit called synchronously', function(done) {
		trycatch(function() {
			(new EE).sync()
		}, function(err) {
			assert.equal(err.message, 'Sync')
			done()
		})
	})

	it('should catch as when emit called asynchronously', function(done) {
		trycatch(function() {
			(new EE).async()
		}, function(err) {
			assert.equal(err.message, 'Async')
			done()
		})
	})

	it('should catch when asynchronously called and emitted', function(done) {
		trycatch(function() {
			setTimeout(function() {
				(new EE).async()
			}, 0);
		}, function(err) {
			assert.equal(err.message, 'Async')
			done()
		})
	})
})

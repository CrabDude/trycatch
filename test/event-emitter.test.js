if (process.env.USE_STRICT) require('use-strict')

var trycatch = require('../lib/trycatch')
	, assert = require('assert')
	, util = require('util')
	, events = require('events')

/*
		Since trycatch assumes EventEmitter callbacks are called asynchronously,
		this test is to test whether the proper catch functions are called when
		EventEmitter.emit is called synchronously

	To run this test:	node ./event-emitter.test.js
*/

function run(longStackTraces) {
  var str = longStackTraces ? ' (long-stack-traces)' : ''
	describe('EventEmitter' + str, function() {
    var delimitter = '----------------------------------------'

	  before(function() {
	    trycatch.configure({
	      'long-stack-traces': Boolean(longStackTraces)
	    })
	  })

		function EE() {}
		util.inherits(EE, events.EventEmitter)
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
					var ee = new EE
					ee.on('sync', ee.onSync)
					ee.sync()
				}
			, function(err) {
					assert.equal(err.message, 'Sync')
					done()
				})
		})

		it('should catch when emit called asynchronously', function(done) {
			trycatch(function() {
					var ee = new EE
					ee.on('async', ee.onAsync)
					ee.async()
				}
			, function(err) {
					assert.equal(err.message, 'Async')
					done()
				})
		})

		it('should catch when asynchronously called and emitted', function(done) {
			trycatch(function() {
					setTimeout(function() {
						var ee = new EE
						ee.on('async', ee.onAsync)
						ee.async()
					}, 0)
				}
			, function(err) {
					assert.equal(err.message, 'Async')
					done()
				})
		})

	  it('should removeListener if addListener called multiple times', function(done) {
	    var ee = new EE

	    function foo() {
	      throw new Error('Event handler should have been removed')
	    }

	    ee.on('foo', foo)
	    ee.on('foo', foo)
	    ee.removeListener('foo', foo)
	    ee.removeListener('foo', foo)
	    assert.doesNotThrow(function() {
	      ee.emit('foo')
	    })
	    done()
	  })

	  it('should catch emitted errors passed directly to domain', function(done) {
			trycatch(function () {
        var ee = new EE
        process.nextTick(function () {
          ee.emit('error', new Error('Async'))
        })
			}, function(err) {
        assert.equal(err.message, 'Async')
        assert.notEqual(err.stack, undefined)
        assert.equal(err.stack.split(delimitter).length, longStackTraces ? 2 : 1)
        done()
			})
		})

		it('should not add redundant stacks when emit is called synchronously', function(done) {
			trycatch(function() {
				var i
				for (i=0; i<4; i++) {
					(function() {
						var ee = new EE
						ee.on('foo', function() {})
						ee.emit('foo')
					})()
				}
				process.nextTick(function() {
					throw new Error()
				})
			}, function(err) {
				assert.equal(err.stack.split(delimitter).length, longStackTraces ? 2 : 1)
				done()
			})
		})
	})
}

run(false)
run(true)

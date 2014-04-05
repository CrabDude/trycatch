var trycatch = require('../lib/trycatch')
  , assert = require('assert')
  , delimitter = '----------------------------------------'


/*
  This tests the basic functionality of catching errors synchronously and asynchronously
*/

function run(longStackTraces) {
  var str = longStackTraces ? ' (long-stack-traces)' : ''

  describe('Basic Error catching' + str, function() {
    before(function() {
      trycatch.configure({
        'long-stack-traces': Boolean(longStackTraces)
      })
    })

    it('should require tryFn to be a function', function() {
      assert.throws(function() {
        trycatch(null, function() {})
      }, Error)
    })

    it('should require catchFn to be a function', function() {
      assert.throws(function() {
        trycatch(function() {}, null)
      }, Error)
    })

    it('should catch Error object thrown synchronously', function(done) {
      trycatch(function() {
          (function foo() {
            throw new Error('Sync')
          })()
        }
      , function(err) {
          assert.equal(err.message, 'Sync')
          assert.notEqual(err.stack, undefined)
          done()
        })
    })

    it('should catch Error object thrown asynchronously', function(done) {
      trycatch(function() {
          process.nextTick(function() {
            throw new Error('Async')
          })
        }
      , function(err) {
          assert.equal(err.message, 'Async')
          assert.notEqual(err.stack, undefined)
          done()
        })
    })

    it('should catch Error object thrown without stack trace', function(done) {
      trycatch(function() {
          process.nextTick(function() {
            Error.stackTraceLimit = 0
            var err = new Error('Async')
            throw err
          })
        }
      , function(err) {
          Error.stackTraceLimit = 10
          assert.equal(err.message, 'Async')
          assert.notEqual(err.stack, undefined)
          done()
        })
    })

    it('should generate correct stack when err.stack lazily accessed', function(done) {
      var err

      trycatch(function() {
          setTimeout(function() {
            err = new Error()
            process.nextTick(function() {
              assert(err.stack.split('\n')[2].indexOf('timers.js') !== -1)
              assert.equal(err.stack.split(delimitter).length, longStackTraces ? 2 : 1)
              done()
            })
          })
        }
      , function(err) {
          throw err
      })
    })
  })
}

run(false)
run(true)

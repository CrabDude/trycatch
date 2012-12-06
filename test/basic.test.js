var trycatch = require('../lib/trycatch')
  , assert = require('assert')
  

/*
  This tests the basic functionality of catching errors synchronously and asynchronously
*/

function run(longStackTraces) {
  var str = longStackTraces ? ' (long-stack-traces)' : ''
  
  describe('Basic Error catching' + str, function() {
    before(function() {
      trycatch.configure({
        'long-stack-traces': !!longStackTraces
      })
    })

    it('should catch Error object thrown synchronously', function(done) {
      trycatch(function() {
        (function foo() {
          throw new Error('Sync')
        })()
      }, function(err) {
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
      }, function(err) {
        assert.equal(err.message, 'Async')
        assert.notEqual(err.stack, undefined)
        done()
      })
    })
  })
}

run(false)
run(true)
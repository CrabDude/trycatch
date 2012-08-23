var assert = require('assert'),
  trycatch = require('../lib/trycatch')

/*
  This tests the basic functionality of catching errors synchronously and asynchronously
*/

describe('Basic Error catching', function() {
  it('should catch Error object thrown synchronously', function(done) {
    var onErrorCalled = false

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
    var onErrorCalled = false

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

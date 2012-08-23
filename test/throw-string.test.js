var assert = require('assert'),
  trycatch = require('../lib/trycatch')

/*
  This test is to test whether trycatch can handle non-Errors being thrown
  like string, number, boolean.

  Before the fix, there was an error in
  trycatch.js filterInternalFrames() line 97

  TypeError: Cannot call method 'split' of undefined
*/

describe('non-Errors', function() {
  it('should catch Strings', function (done) {
    trycatch(function () {
      setTimeout(function () {
        throw 'my-string being thrown'
      }, 0)
    }, function onError(err) {
      assert.equal(err.message, 'my-string being thrown')
      assert.notEqual(err.stack, undefined)
      done()
    })
  })

  it('should catch Numbers', function (done) {
    trycatch(function () {
      setTimeout(function () {
        throw 123
      }, 0)
    }, function onError(err) {
      assert.equal(err.message, (123).toString())
      assert.notEqual(err.stack, undefined)
      done()
    })
  })

  it('should catch Booleans', function (done) {
    var onErrorCalled = false

    trycatch(function () {
      setTimeout(function () {
        throw true
      }, 0)
    }, function onError(err) {
      assert.equal(err.message, (true).toString())
      assert.notEqual(err.stack, undefined)
      done()
    })
  })
})
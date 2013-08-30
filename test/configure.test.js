var trycatch = require('../lib/trycatch')
  , assert = require('assert')

/*
  This tests the basic functionality of catching errors synchronously and asynchronously
*/

function run(longStackTraces) {
  var str = longStackTraces ? ' (long-stack-traces)' : ''

  describe('Stack Traces' + str, function() {
    before(function() {
      trycatch.configure({
        'long-stack-traces': Boolean(longStackTraces)
      })
    })

    it.skip('should be colored', function(done) {
      setTimeout(function() {
        throw new Error('test 1')
      })
    })
    it.skip('should be filtered: internal', function(done) {
      setTimeout(function() {
        throw new Error('test 1')
      })
    })
    it.skip('should be filtered: configurable', function(done) {
      setTimeout(function() {
        throw new Error('test 1')
      })
    })
    it.skip('should be filtered: line', function(done) {
      setTimeout(function() {
        throw new Error('test 1')
      })
    })
    it.skip('should be ' + longStackTraces ? 'long' : 'short', function(done) {
      var delimitter = '----------------------------------------'

      setTimeout(function() {
        throw new Error('test 1')
      })
    })
  })
}

run(false)
run(true)

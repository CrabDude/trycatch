var trycatch = require('../lib/trycatch')
  , assert = require('assert')
  , _ = require('lodash')
  , delimitter = '\n    ----------------------------------------'

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

    beforeEach(function() {
      trycatch.configure({
        colors: {
          node: 'red'
        , node_modules: 'red'
        , default: 'red'
        }
      })
    })

    afterEach(function() {
      trycatch.configure({
        colors: null
      , filter: null
      })
    })

    it('should be colored', function() {
      new Error().stack.split(delimitter)[0].split('\n').forEach(function(value, key) {
        if (key === 0) return

        assert.equal(value.charCodeAt(0), 27)
        assert.equal(value.substring(1,5), '[31m')
      })
    })

    it('should be filtered: internal', function() {
      var stack = new Error().stack.split('\n')
        , success

      success = _.every(stack, function(value, key) {
        return !_.some(['trycatch.js', 'formatError.js', 'hookit'], function(filePattern, key) {
          return _.contains(value, filePattern)
        })
      })
      assert(success)
    })

    it('should be filtered: configurable', function() {
      var stack

      trycatch.configure({
        colors: {
          node: false
        , node_modules: false
        , default: 'red'
        }
      })

      stack = new Error().stack.split(delimitter)[0].split('\n')
      assert.equal(stack.length, 2)
    })

    it('should be filtered: line', function() {
      var stack
        , referenceStack

      referenceStack = new Error().stack.split(delimitter)[0].split('\n')

      trycatch.configure({
        filter: ['configure.test.js']
      })

      stack = new Error().stack.split(delimitter)[0].split('\n')

      assert.equal(referenceStack.length-1, stack.length)
    })

    it('should be ' + (longStackTraces ? 'long' : 'short'), function() {
      var stack
        , index

      trycatch.configure({'long-stack-traces': longStackTraces})

      stack = new Error().stack
      index = stack.indexOf(delimitter)
      assert[longStackTraces ? 'notEqual' : 'equal'](index, -1)
    })
  })
}

run(false)
run(true)

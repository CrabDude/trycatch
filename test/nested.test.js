if (process.env.USE_STRICT) require('use-strict')

var assert = require('assert'),
  trycatch = require('../lib/trycatch')

/*
  This test is to test whether trycatch can be nested and handle Errors being thrown again

  Before the fix, catch functions were skipped in heirarchy
*/

function run(longStackTraces) {
  var str = longStackTraces ? ' (long-stack-traces)' : ''

  describe('Nested trycatchs' + str, function() {
    before(function() {
      trycatch.configure({
        'long-stack-traces': Boolean(longStackTraces)
      })
    })

    var delimitter = '----------------------------------------'

    it('should catch nested synchronously rethrown errors', function(done) {
      var count = 0

      trycatch(function () {
        trycatch(function () {
            ++count
            throw new Error('test 1')
          }
        , function(err) {
            ++count
            assert.equal(err.stack.split(delimitter).length, 1)
            throw err
          })
        }
      , function(err) {
          ++count
          if (err.message.indexOf('AssertionError') !== -1) throw err
          assert.equal(err.message, 'test 1')
          assert.equal(count, 3)
          assert.equal(err.stack.split(delimitter).length, 1)
          done()
        })
    })

    it('should catch asynchronously nested rethrown errors', function(done) {
      var count = 0

      trycatch(function () {
          setTimeout(function() {
            trycatch(function () {
                setTimeout(function() {
                  ++count
                  throw new Error('test 2')
                }, 0)
              }
            , function(err) {
                ++count
                assert.equal(err.stack.split(delimitter).length, longStackTraces ? 2 : 1)
                throw err
              })
          }, 0)
        }
      , function(err) {
          ++count
          if (err.message.indexOf('AssertionError') !== -1) throw err
          assert.equal(err.message, 'test 2')
          assert.equal(count, 3)

          assert.equal(err.stack.split(delimitter).length, longStackTraces ? 3 : 1)
          done()
        })
    })

    it('should catch asynchronously nested asynchronously rethrown errors', function(done) {
      var count = 0

      trycatch(function () {
          setTimeout(function() {
            trycatch(function () {
                setTimeout(function() {
                  ++count
                  throw new Error('test 3')
                }, 0)
              }
            , function(err) {
                setTimeout(function() {
                  ++count

                  assert.equal(err.stack.split(delimitter).length, longStackTraces ? 2 : 1)
                  throw err
                }, 0)
              })
          }, 0)
        }
      , function(err) {
          ++count
          if (err.message.indexOf('AssertionError') !== -1) throw err
          assert.equal(err.message, 'test 3')
          assert.equal(count, 3)

          assert.equal(err.stack.split(delimitter).length, longStackTraces ? 3 : 1)
          done()
        })
    })
  })
}

run(false)
run(true)

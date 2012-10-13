var fs = require('fs');
var trycatch = require('../lib/trycatch');
var _ = require('underscore')._

trycatch.format({
    "node": "none"
})

trycatch(function() {
  fs.readFile(__filename, function () {
      _.map(['Error 1', 'Error 2'], function foo(v) {
        setTimeout(function() {
          throw new Error(v)
        }, 10)
      })
  })
}, function(err) {
  console.log("Async error caught!\n", err.stack);
});

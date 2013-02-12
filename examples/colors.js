var fs = require('fs')
	, trycatch = require('../lib/trycatch')
	, _ = require('underscore')._

trycatch.configure({
	'long-stack-traces': true
, colors: {
    "node": "none"
  , "node_modules": false
  , "default": 'yellow'
  }
})

trycatch(function() {
	  fs.readFile(__filename, function () {
	      _.map(['Error 1', 'Error 2']
	      , function foo(v) {
		        setTimeout(function() {
		          throw new Error(v)
		        }, 10)
		      })
	  })
	}
, function(err) {
	  console.log("Async error caught!\n", err.stack);
	});
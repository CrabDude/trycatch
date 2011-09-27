var fs = require('fs');
var Scoper = require('../lib/catcher');

// Embed a token and test it by starting a stack that has an async link in it.
// The exception in C should 
Scoper(function onerror(err) {
  console.log("This is a scoped error handler!\n", err.stack);
}, function init() {
  a();
});

function a() {
  setTimeout(b, 5);
}

function b(cb) {
  c();
}

function c(cb) {
	fs.stat(__filename, function (err, stats) {
		console.log(stats);
	  	throw new Error("Hellow World");
	});
}





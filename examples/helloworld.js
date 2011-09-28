var fs = require('fs');
var trycatch = require('../lib/trycatch');

setInterval(function() {
	console.log('Still running.');
}, 1000);

trycatch(function init() {
		a();
	},
	function onerror(err) {
		console.log("This is a scoped error handler!\n", err.stack);
	}
);

function a() {
	setTimeout(b, 5);
}

function b(cb) {
	c();
}

function c(cb) {
	fs.readFile(__filename, function (err, data) {
		console.log(''+data);
		throw new Error("Hellow World");
	});
}



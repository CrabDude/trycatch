var trycatch = require('../lib/trycatch');
trycatch(tryFn, catchFn);


function tryFn() {
	function f() {
		throw new Error('foo');
	}
	
	setTimeout(f, Math.random()*1000);
	setTimeout(f, Math.random()*2000);
}

function catchFn(err) {
	console.log("This is a scoped error handler!\n", err.stack);
}

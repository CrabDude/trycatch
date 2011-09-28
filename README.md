Catcher
=======

An asynchronous exception handler with long stack traces for node.js

Background
----------

See the "Background" from the [long-stack-traces](https://github.com/tlrobinson/long-stack-traces) module.

### Install

	npm install catcher

### Example

	function tryFn() {
		function f() {
			throw new Error('foo');
		}
		
		setTimeout(f, Math.random()*1000);
		setTimeout(f, Math.random()*1000);
	}
	function catchFn(err) {
		console.log("This is a scoped error handler!\n", err.stack);
	}
	Catcher(fnTry, fnCatch);
	
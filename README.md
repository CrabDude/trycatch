Catcher
=======

An asynchronous exception handler with long stack traces for node.js

Background
----------

See the "Background" from the [long-stack-traces](https://github.com/tlrobinson/long-stack-traces) module.

### Install

	npm install catcher

### Example

	// Old & Busted
	
	try {
		function f() {
			throw new Error('foo');
		}
		
		f();
	} catch(err) {
		console.log("This is a synchronous error handler!\n", err.stack);
	}
	
	
	// New Hotness
	
	trycatch(function() {
		function f() {
			throw new Error('foo');
		}
		
		setTimeout(f, Math.random()*1000);
		setTimeout(f, Math.random()*1000);
	}, function(err) {
		console.log("This is an asynchronous scoped error handler!\n", err.stack);
	});
	
### Output

	$ node examples/setTimeout.js 
	This is an asynchronous scoped error handler!
	 Error: foo
	    at Object.f (/Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:5:9)
	    at Timer.callback (timers.js:83:39)
	----------------------------------------
	    at setTimeout
	    at /Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:8:2
	    at Object.<anonymous> (/Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:3:1)
	    at Module._compile (module.js:404:26)
	    at Object..js (module.js:410:10)
	    at Module.load (module.js:336:31)
	This is an asynchronous scoped error handler!
	 Error: foo
	    at Object.f (/Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:5:9)
	    at Timer.callback (timers.js:83:39)
	----------------------------------------
	    at setTimeout
	    at /Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:9:2
	    at Object.<anonymous> (/Users/adamcrabtree/projects/mine/trycatch/examples/setTimeout.js:3:1)
	    at Module._compile (module.js:404:26)
	    at Object..js (module.js:410:10)
	    at Module.load (module.js:336:31)

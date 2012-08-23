trycatch
=======

An asynchronous try catch exception handler with long stack traces for node.js

**Now PRODUCTION Ready!**

With the update to 0.1.0, stack traces are now lazy, and all try/catch blocks conform to [V8 best practices](https://github.com/joyent/node/wiki/Best-practices-and-gotchas-with-v8).



Install
-------

	npm install trycatch

Use
---

Because trycatch shims all native I/O calls, it must be required before any other modules.

	var trycatch = require('trycatch')
	trycatch(fnTry, fnCatch)

Basic Example
-------------

```javascript

    var trycatch = require("trycatch"),
      _ = require('underscore')._

    trycatch(function() {
      _.map(['Error 1', 'Error 2'], function foo(v) {
        setTimeout(function() {
          throw new Error(v)
        }, 10)
      })
    }, function(err) {
      console.log("Async error caught!\n", err.stack);
    });
``` 

#### Output

![](https://raw.github.com/CrabDude/trycatch/master/screenshot.png)


Advanced Examples
-------------
See the `/test` and `examples` directories for more use cases.


Returning 500s on Server Request
--------------------------------

```javascript
	http.createServer(function(req, res) {
		trycatch(function() {
			setTimeout(function() {
				throw new Error('Baloney!');
			}, 1000);
		}, function(err) {
			res.writeHead(500);
			res.end(err.stack);
		});
	}).listen(8000);
```

Visit http://localhost:8000 and get your 500.



Thanks
----------

Special thanks to [Tom Robinson](https://github.com/tlrobinson) for his [long-stack-traces](https://github.com/tlrobinson/long-stack-traces) module and [Tim Caswell](https://github.com/creationix) who built out the initial hook.js code.
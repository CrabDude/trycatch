trycatch
=======

[![Build Status](https://travis-ci.org/CrabDude/trycatch.png)](https://travis-ci.org/CrabDude/trycatch)

An asynchronous domain-based try/catch exception handler with (optional) long stack traces for node.js [optimized for V8](https://github.com/joyent/node/wiki/Best-practices-and-gotchas-with-v8).

#Install

```
npm install trycatch
```

#Use

```javascript
var trycatch = require('trycatch')
trycatch(function() {
  // do something error-prone
}, function(err) {
  console.log(err.stack);
})
```


###Returning 500s on Server Request

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

#Options
Optional Long-Stack-Traces:
```javascript
// Because trycatch shims all native I/O calls,
// it must be required & configured with 'long-stack-traces' before any other modules.
var trycatch = require('trycatch')
trycatch.configure({'long-stack-traces': true})
trycatch(fnTry, fnCatch)
```

Colors:
```javascript
var trycatch = require('trycatch')
trycatch.configure({
  colors: {
    // 'none' or falsy values will omit
    'node': 'none',
    'node_modules': false,
    'default': 'yellow'
  }
})
trycatch(fnTry, fnCatch)
```

Advanced Formatting:
```javascript
var trycatch = require('trycatch')
trycatch.configure({
  format: function(line) {
    // Alter final output (falsy values will omit)
    return line
  }
})
trycatch(fnTry, fnCatch)
```

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

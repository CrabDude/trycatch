var assert = require('assert'),
    trycatch = require('../lib/trycatch'),
    util = require("util"),
    events = require("events"),
    oneCalled = false,
    twoCalled = false;

/*
    Since trycatch assumes EventEmitter callbacks are called asynchronously,
    this test is to test whether the proper catch functions are called when
    EventEmitter.emit is called synchronously

  To run this test:  node ./event-emitter.test.js
*/

//be compatible with running test from command line or from something like Expresso
var EXIT = (require.main === module) ? 'exit' : 'beforeExit'; 

function doit(cb) {
    trycatch(function() {
        if (!f) f = new foo
        f.bar()
    }, cb)
}

function foo() {
    this.on('bar', this.onBar)
}
util.inherits(foo, events.EventEmitter);
foo.prototype.bar = function() {
    this.emit('bar')
}
foo.prototype.onBar = function() {
    throw new Error('Catchme')
}

var f

doit(function() {
    oneCalled = true
})
doit(function() {
    twoCalled = true
})

process.on(EXIT, function () {
    //check callbacks were called here
    assert(oneCalled, 'throw string onError function should have been called');
    assert(twoCalled, 'throw string onError function should have been called');
    console.error('success - correct catch functions called');
});

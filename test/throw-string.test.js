'use strict';

var assert = require('assert');
var trycatch = require('../lib/trycatch');

/*
  This test is to test whether trycatch can handle non-Errors being thrown
  like string, number, boolean.

  Before the fix, there was an error in
  trycatch.js filterInternalFrames() line 97

  TypeError: Cannot call method 'split' of undefined


  To run this test:  node ./throw-string.test.js
 */

//be compatible with running test from command line or from something like Expresso
var EXIT = (require.main === module) ? 'exit' : 'beforeExit';

exports['throwing non-Error object like string should be caught'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    setTimeout(function () {
      throw 'my-string being thrown';  //throwing a string non-Error object
    }, 100);
  }, function onError(err) {
    onErrorCalled = true;
    assert.equal(err.message, 'my-string being thrown');
    assert.notEqual(err.stack, undefined);
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, true, 'throw string onError function should have been called');
    console.error('success - caught thrown String');
  });

};

exports['throwing non-Error object like number should be caught'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    setTimeout(function () {
      throw 123;               //throwing a number non-Error object
    }, 100);
  }, function onError(err) {
    onErrorCalled = true;
    assert.equal(err.message, (123).toString());
    assert.notEqual(err.stack, undefined);
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, true, 'throw number onError function should have been called');
    console.error('success - caught thrown number');
  });

};

exports['throwing non-Error object like boolean should be caught'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    setTimeout(function () {
      throw true;               //throwing a boolean non-Error object
    }, 100);
  }, function onError(err) {
    onErrorCalled = true;
    assert.equal(err.message, (true).toString());
    assert.notEqual(err.stack, undefined);
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, true, 'throw boolean onError function should have been called');
    console.error('success - caught thrown boolean');
  });

};

exports['throwing from nested and bubbling trycatch should be caught (shimmed)'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    trycatch(function () {
      setTimeout(function () {
        trycatch(function () {
          setTimeout(function () {
            throw Error('error');
          }, 100);
        }, function firstError(err) {
        });
      }, 100);
    }, function secondError(err) {
    });
  }, function onError(err) {
    onErrorCalled = true;
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, true, 'onError function should have been called');
    console.error('success - caught bubbling nested trycatch error (shimmed)');
  });

};

exports['throwing from nested and bubbling trycatch should be caught (unshimmed)'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    trycatch(function () {
      trycatch(function () {
        throw Error('error');
      }, function firstError(err) {
      });
    }, function secondError(err) {
    });
  }, function onError(err) {
    onErrorCalled = true;
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, true, 'onError function should have been called');
    console.error('success - caught bubbling nested trycatch error (unshimmed)');
  });

};

exports['throwing from nested and non bubbling trycatch should not be caught (shimmed)'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    trycatch(function () {
      setTimeout(function () {
        trycatch(function () {
          setTimeout(function () {
            throw Error('error');
          }, 100);
        }, function firstError(err) {
        });
      }, 100);
    }, function secondError(err) {
      return false;
    });
  }, function onError(err) {
    onErrorCalled = true;
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, false, 'onError function should have been called');
    console.error('success - did not catch non bubbling nested trycatch error (shimmed)');
  });

};

exports['throwing from nested and non bubbling trycatch should not be caught (unshimmed)'] = function () {
  var onErrorCalled = false;

  trycatch(function () {
    trycatch(function () {
      trycatch(function () {
        throw Error('error');
      }, function firstError(err) {
      });
    }, function secondError(err) {
      return false;
    });
  }, function onError(err) {
    onErrorCalled = true;
  });

  process.on(EXIT, function () {
    //check callbacks were called here
    assert.equal(onErrorCalled, false, 'onError function should have been called');
    console.error('success - did not catch non bubbling nested trycatch error (unshimmed)');
  });

};

// if run directly from node execute all the exports
if (require.main === module) Object.keys(exports).forEach(function (f) { exports[f](); });



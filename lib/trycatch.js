module.exports = trycatch;
// use colors module, if available
try { trycatch.colors = require('colors'); } catch(err) {}
var FormatStackTrace = require('./formatStackTrace');


// findToken fails for stack traces deeper Error.stackTraceLimit => Error.stackTraceLimit = Infinity
// Make configurable?
Error.stackTraceLimit = Infinity;
// The event-source hooks allows tokens & new stacks to be linked
// called as shim
require('./hook')(generateShim);

// generate a new callback shim for shim'd async function (e.g., fs.stats)
function generateShim(next, name, location) {
	var self;
	var res = findToken();
	if (!res) return next;
	var token = res.token;
	var stack = res.stack;

	// _TOKEN_ is the new callback and calls the real callback, next()
	function _TOKEN_() {
		try {
			return next.apply(self, arguments);
		} catch (err) {
			catchFunc(err, _TOKEN_);
		}
	}

	_TOKEN_.orig = name;
	_TOKEN_.stack = stack;
	_TOKEN_.token = token;

	return function() {
		self = this;
		_TOKEN_.apply(token, arguments);
	};
}

// Tags a stack and all decendent stacks with a token
function trycatch(tryFn, catchFn) {
	function _TOKEN_() {
		try {
			tryFn();
		} catch (err) {
			catchFunc(err, _TOKEN_);
		}
	}
	_TOKEN_.token = catchFn;

	var res = findToken();
	if (res) {
		_TOKEN_.nestedToken = res.token
	}

	_TOKEN_();
}

function catchFunc(err, _TOKEN_) {
	if (!(err instanceof Error)) {
		err = new Error(''+err);
	}

	var token, nestedToken, catchFn;
	token = _TOKEN_;
	err.stack = filterInternalFrames(err.stack);
	// build stack trace
	while(token.token) {
		if (token.stack) {
			err.stack += '\n    ----------------------------------------\n' +
				'    at '+token.orig+'\n' +
				token.stack.substring(token.stack.indexOf("\n") + 1)
		}
		nestedToken = token.nestedToken;
		catchFn = token = token.token;

		// look for nested trycatch token for deeper stack trace
		if (!token.token && nestedToken) {
			token = nestedToken;
		}
	}

	// execute catch functions
	token = _TOKEN_;
	var execCatchFunction = function() {
		var bubbled = false;

		// trycatch the user's catch function because it may have some async
		// callback that throws error
		trycatch(function() {
			while(token.token) {
				nestedToken = token.nestedToken;
				catchFn = token = token.token;
				if (!token.token) {
					// execute the user's catch function
					catchFn(err);
				}
			}
		}, function(err2) {
			// error should only bubble once, just incase there is some async function
			// that is bubbling the error again
			if (bubbled) {
				return;
			}
			bubbled = true;
			bubbleError(err2);
		});
	};

	var bubbleError = function(err2) {
		// update the error with the error thrown by the nested catch function.
		// this should normally be the same as the current error, but it could
		// be different if the user's catch function is faulty.
		if (err !== err2) {
			err = err2;
		}

		// if there isn't anymore user catch function, just throw the error. seems
		// like there is some problem with the user's catch function
		if (!nestedToken) {
			throw err2;
		}

		// if there a nested catch function, we retry looking for the a higher level
		// user catch function
		token = nestedToken;
		execCatchFunction();
	};

	execCatchFunction();
}

// Looks for a token in the current stack using the V8 stack trace API
function findToken(err) {
	if (!err) err = new Error();
	var original = Error.prepareStackTrace;
	// stackSearch returns a function object instead of the string expected from the built-in
	Error.prepareStackTrace = stackSearch;
	var res = err.stack;
	Error.prepareStackTrace = original;
	err.stack = res && res.stack;
	return res;
}

function stackSearch(error, structuredStackTrace) {
	if (!structuredStackTrace) return;

	for (var fn, i = 0, l = structuredStackTrace.length; i < l; i++) {
		fn = structuredStackTrace[i].fun;
		if (fn.name === '_TOKEN_') {
			return {
				token: fn,
				stack: filterInternalFrames(FormatStackTrace(error, structuredStackTrace))
			}
		}
	}
}

var filename1 = __filename;
var filename2 = require.resolve('./hook');
function filterInternalFrames(frames) {
	var ret = [];
	ret = frames.split("\n").filter(function(frame) {
		return frame.indexOf(filename1) < 0 && frame.indexOf(filename2) < 0;
	});
	if (trycatch.colors) {
		ret = ret.map(function(frame, k) {
			if (frame.indexOf('/node_modules/') >= 0) {
				frame = trycatch.colors.cyan(frame);
			} else if (frame.indexOf('/') >= 0) {
				frame = trycatch.colors.red(frame);
			}
			return frame;
		});
	}
	return ret.join("\n");
}

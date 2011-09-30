module.exports = trycatch;
var FormatStackTrace = require('./formatStackTrace');

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
			var catchFn;
			token = _TOKEN_;
			
			err.stack = filterInternalFrames(err.stack);
			while(token.token) {
				if (token.stack) {
					err.stack += '\n----------------------------------------\n' +
						'    at '+token.orig+'\n' +
						token.stack.substring(token.stack.indexOf("\n") + 1)
				}
				catchFn = token = token.token;
			}

			catchFn(err);
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
		tryFn();
	}
	_TOKEN_.token = catchFn;
	try {
		_TOKEN_();
	} catch (err) {
		err.stack = filterInternalFrames(err.stack);
		catchFn(err);
	}
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
	for (var i = 0, l = structuredStackTrace.length; i < l; i++) {
		var callSite = structuredStackTrace[i];
		if (callSite.fun.name === '_TOKEN_') {
			var token = callSite.fun;
			var stack = filterInternalFrames(FormatStackTrace(error, structuredStackTrace));
			return {
				token: token,
				stack: stack
			}
		}
	}
}

var filename1 = __filename;
var filename2 = require.resolve('./hook');
function filterInternalFrames(frames, filename) {
	return frames.split("\n").filter(function(frame) {
		return frame.indexOf(filename1) < 0 && frame.indexOf(filename2) < 0;
	}).join("\n");
}

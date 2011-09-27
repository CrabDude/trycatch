module.exports = catcher;
var FormatStackTrace = require('./formatStackTrace');

// The event-source hooks allows tokens & new stacks to be linked
// called as shim
require('./hook')(generateShim);

// generate a new callback shim for shim'd async function (e.g., fs.stats)
function generateShim(next, name, location) {
	var self;
	var token = findToken();
	if (!token) return next;
	
	// _TOKEN_ is the new callback and calls the original callback (next) 
	function _TOKEN_() {
		try {
			return next.apply(self, arguments);
		} catch (err) {
			var token = findToken(err);
			if (!token) throw err;
			
			while(token.token) {
				token = token.token;
				if (token.stack) {
					err.stack += '\n----------------------------------------\n' +
						'    at '+token.orig+'\n' +
						token.stack.substring(token.stack.indexOf("\n") + 1)
				}
			}
			token(err);
		}
	}
	
	token.orig = name;
	_TOKEN_.token = token;
	
	
	return function() {
		self = this;
		_TOKEN_.apply(token, arguments);
	};
}

// Tags a stack and all decendent stacks with a token
function catcher(errorHandler, next) {
	function _TOKEN_() {
		next();
	}
	_TOKEN_.token = errorHandler;
	_TOKEN_();
}

// Looks for a token in the current stack using the V8 stack trace API
function findToken(err) {
	if (!err) err = new Error();
	var original = Error.prepareStackTrace;
	// stackSearch returns a function object instead of the string expected from the built-in
	Error.prepareStackTrace = stackSearch
	var token = err.stack;
	Error.prepareStackTrace = original;
	err.stack = token.stack;
	return token;
}

function stackSearch(error, structuredStackTrace) {
	if (!structuredStackTrace) return;
	for (var i = 0, l = structuredStackTrace.length; i < l; i++) {
		var callSite = structuredStackTrace[i];
		if (callSite.fun.name === '_TOKEN_') {
			var token = callSite.fun;
			token.stack = filterInternalFrames(FormatStackTrace(error, structuredStackTrace));
			return token;
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

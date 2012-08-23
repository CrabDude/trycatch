module.exports = trycatch

// use colors module, if available
try { trycatch.colors = require('colors') } catch(err) {}
var FormatStackTrace = require('./formatStackTrace'),
	filename1 = __filename,
	filename2 = require.resolve('./hook')

// findToken fails when _TOKEN_ deeper than Error.stackTraceLimit
Error.stackTraceLimit = Infinity

// Replace built-in async functions, shim callbacks
require('./hook')(generateShim)

// Generate a new callback wrapped in _TOKEN_ with Error to trace back
function generateShim(next, name, location) {
	if (typeof next !== 'function') return next

	// _TOKEN_ is the new callback and calls the real callback, next()
	function _TOKEN_() {
		try {
			return next.apply(this, arguments)
		} catch (e) {
			handleError(e, _TOKEN_, false)
		}
	}

	_TOKEN_.orig = name
	_TOKEN_.error = new Error
	
	return _TOKEN_
}

function handleError(err, token, recursive) {
	var origin

	if (!recursive) {
		if (!err.token) {
			// Newly created Error
			err = err instanceof Error ? err : new Error(''+err)
			err = getFilteredError(err)
			err.originalStack = err.stack
		} else {
			token = err.token
		}
	}

	while(token.error) {
		// stackSearch returns an object {token, stack} in place of error.stack String
		origin = getFilteredError(token.error, stackSearch).stack
		if (!origin) throw err

		if (!token.catchFn && origin.stack) {
			err.stack += '\n		----------------------------------------\n' +
				'		at '+token.orig+'\n' +
				origin.stack.substring(origin.stack.indexOf("\n") + 1)
		}
		token = origin.token
		if (token.catchFn) break
	}

	if (typeof token.catchFn === 'function') {
		err.token = token
		try {
			token.catchFn.call(null, err, token)
		} catch(e2) {
			handleError(e2, token, true)
		}
	}
}

// Create origin _TOKEN_ for stack termination
function trycatch(tryFn, catchFn) {
	function _TOKEN_() {
			tryFn()
	}
	_TOKEN_.catchFn = catchFn
	_TOKEN_.error = new Error
	_TOKEN_.orig = 'trycatch'

	try {
		_TOKEN_()
	} catch (err) {
		catchFn(getFilteredError(err))
	}
}

function getFilteredError(err, fn) {
	if (typeof fn !== 'function') {
		fn = function(error, structuredStackTrace) {
			return FormatStackTrace(error, structuredStackTrace, [filename1, filename2], trycatch.colors)
		}
	}
	if (!err) err = new Error;
	var old = Error.prepareStackTrace
	Error.prepareStackTrace = fn
	err.stack = err.stack
	Error.prepareStackTrace = old
	return err
}

function stackSearch(error, structuredStackTrace) {
	if (!structuredStackTrace) return
	
	for (var fn, i=0, l=structuredStackTrace.length; i<l; i++) {
		fn = structuredStackTrace[i].fun
		if (fn.name === '_TOKEN_') {
			return {
				token: fn,
				stack: FormatStackTrace(error, structuredStackTrace, [filename1, filename2], trycatch.colors)
			}
		}
	}
}

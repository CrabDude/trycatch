var util = require('util')
	, FormatStackTrace = require('./formatStackTrace')
	, Block = require('./control-block')
	, filename1 = __filename
	, filename2 = require.resolve('./hook')
	, options = {
			'long-stack-traces': false
		}

// use colors module, if available
try { trycatch.colors = require('colors') } catch(err) {}

module.exports = trycatch

function trycatch(tryFn, catchFn) {
	trycatch.begin(tryFn, catchFn)
}
trycatch.begin = Block.begin
trycatch.guard = Block.guard
trycatch.configure = configure

function configure(opts) {
	util._extend(options, opts)

	if (!!opts['long-stack-traces']) {
		// findToken fails when _TOKEN_ deeper than Error.stackTraceLimit
		Error.stackTraceLimit = Infinity
		trycatch.guard = longStackTracesGuard
		trycatch.begin = begin
	} else if (typeof opts['long-stack-traces'] !== 'undefined') {
		Error.stackTraceLimit = 10
		trycatch.begin = Block.begin
		trycatch.guard = Block.guard
	}
}

function begin(tryFn, catchFn) {
	// Create origin _TOKEN_ for stack termination
	function _TOKEN_() {
			tryFn()
	}
	_TOKEN_.catchFn = catchFn
	_TOKEN_.error = new Error
	_TOKEN_.parent = 'trycatch'

	try {
		_TOKEN_()
	} catch (err) {
		catchFn(generateStack(err))
	}
}

function generateStack(err, fn) {
	if (typeof fn !== 'function') {
		fn = function(error, structuredStackTrace) {
			return FormatStackTrace(error
			, structuredStackTrace
			, [filename1, filename2]
			, trycatch.colors)
		}
	}
	if (!err) err = new Error
	var old = Error.prepareStackTrace
	Error.prepareStackTrace = fn
	err.stack = err.stack
	Error.prepareStackTrace = old
	return err
}

// Generate a new callback wrapped in _TOKEN_ with Error to trace back
function longStackTracesGuard(next, name, location) {
	if (typeof next !== 'function') return next

	// _TOKEN_ is the new callback and calls the real callback, next()
	function _TOKEN_() {
		try {
			return next.apply(this, arguments)
		} catch (e) {
			handleError(e, _TOKEN_, false)
		}
	}

	_TOKEN_.parent = name
	_TOKEN_.error = new Error
	
	return _TOKEN_
}

function handleError(err, token, recursive) {
	var parent

	if (!recursive) {
		if (!err.token) {
			// Newly created Error
			err = err instanceof Error ? err : new Error(''+err)
			err = generateStack(err)
			err.parentalStack = err.stack
		} else {
			token = err.token
		}
	}

	while(token.error) {
		// HACK: Use Error.prepareStackTrace = stackSearch to find parent
		parent = generateStack(token.error, stackSearch).stack
		if (!parent) throw err

		if (!token.catchFn && parent.stack) {
			err.stack += '\n		----------------------------------------\n' +
				'		at '+token.parent+'\n' +
				parent.stack.substring(parent.stack.indexOf("\n") + 1)
		}
		token = parent.token
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

// Replace built-in async functions, shim callbacks with generator
require('./hook')(function generateShim(next, name, location) {
  return trycatch.guard(next, name, location)
})
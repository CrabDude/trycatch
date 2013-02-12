var util = require('util')
	, domain = require('domain')
	, FormatStackTrace = require('./formatStackTrace')
	, hook = require('./hook')
	, hooked = false
	, fileNameFilter = [__filename, require.resolve('./hook'), 'domain.js']
	, options = {
			'long-stack-traces': null
		}

// use colors module, if available
try { trycatch.colors = require('colors') } catch(err) {}

module.exports = trycatch

function trycatch(tryFn, catchFn) {
	if ('function' !== typeof tryFn || 'function' !== typeof catchFn) {
		throw new Error('tryFn and catchFn must be functions')
	}
	trycatch.begin(tryFn, catchFn)
}

trycatch.begin = domainTrycatch
// Won't be used until long-stack-traces turned off=>on=>off
trycatch.guard = nopGuard
trycatch.configure = configure

function configure(opts) {
	if ('undefined' !== typeof opts['long-stack-traces']) {
		options['long-stack-traces'] = Boolean(opts['long-stack-traces'])
	}

	if (true === options['long-stack-traces']) {
		if (!hooked) {
			hooked = true
			
			// Replace built-in async functions, shim callbacks with generator
			hookit()
		}

		// findToken fails when _TOKEN_ deeper than Error.stackTraceLimit
		Error.stackTraceLimit = Infinity
		trycatch.begin = longStackTraceBegin
		trycatch.guard = longStackTraceGuard
	} else if (false === options['long-stack-traces'] && hooked) {
		console.warn('Turning long-stack-traces off can result in indeterminate behavior.')
		Error.stackTraceLimit = 10
		trycatch.begin = domainTrycatch
		trycatch.guard = nopGuard
	}
}

function hookit() {
	hook(function generateShim(callback, fnName) {
	  return trycatch.guard(callback, fnName)
	})
}

// In case long-stack-traces are switched on -> off
function nopGuard(cb) {
	return cb
}

function domainTrycatch (fn, cb, token) {
  var parentDomain = domain.active
    , d = domain.create()

  d.on('error', function onError(err) {
  	var isError = err instanceof Error
    if (true === options['long-stack-traces'] && '_TOKEN_' === fn.name) {
    	if (isError) {
	    	err = handleError(err)
    	} else {
    		console.warn('Unable to generate long-stack-trace for thrown non-Error')
    	}
    }

  	if (!isError) {
      err = new Error(err)
    }

    runInDomain(parentDomain, function() {
      cb(err)
    })
  })
  
  runInDomain(d, fn)
}

function runInDomain(d, fn) {
  if (d && !d._disposed) {
    try {
      d.run(fn)
    } catch(e) {
      d.emit('error', e)
    }
  } else {
    fn()
  }
}

function handleError(err) {
	var parent
		, token
		, skip = false

	if (err.token) {
		skip = true
		token = err.token
	} else {
		parent = generateStack(err, stackSearch).stack
		err.stack = parent.stack
		if (!parent.token) {
			// options['long-stack-traces'] was probably toggled after async was invoked
			return err
		}
		token = parent.token
		parent = null
	}

	while(token.error) {
		if (!skip && token.catchFn) break

		skip = false

		// HACK: Use Error.prepareStackTrace = stackSearch to find parent
		parent = generateStack(token.error, stackSearch).stack
		if (!parent) {
			throw err
		}

		if (!token.catchFn && parent.stack) {
			err.stack += '\n		----------------------------------------\n' +
				'		at '+token.parent+'\n' +
				parent.stack.substring(parent.stack.indexOf("\n") + 1)
		}
		token = parent.token
	}

	if ('function' === typeof token.catchFn) {
		err.token = token
		return err
	}
}

function longStackTraceBegin(tryFn, catchFn) {
	// Create origin _TOKEN_ for stack termination
	function _TOKEN_() {
		tryFn()
	}
	_TOKEN_.catchFn = catchFn
	_TOKEN_.error = new Error
	_TOKEN_.parent = 'trycatch'

	domainTrycatch(_TOKEN_, catchFn)
}

function generateStack(err, fn) {
	if ('function' !== typeof fn) {
		fn = function(error, structuredStackTrace) {
			return FormatStackTrace(error
			, structuredStackTrace
			, fileNameFilter
			, trycatch.colors)
		}
	}
	if (!err) err = new Error
	var old = Error.prepareStackTrace
	Error.prepareStackTrace = fn
	// Generate stack trace by accessing stack property
	err.stack = err.stack
	Error.prepareStackTrace = old
	return err
}

// Generate a new callback wrapped in _TOKEN_ with Error to trace back
function longStackTraceGuard(callback, name) {
	var parentDomain

	if ('function' !== typeof callback) return callback

	parentDomain = domain.active

	// _TOKEN_ is the new callback and calls the real callback, callback()
	function _TOKEN_() {
		callback.apply(this, arguments)
	}

	_TOKEN_.parent = name
	_TOKEN_.error = new Error
	
	return function() {
		var args = arguments
		runInDomain(parentDomain, function() {
			_TOKEN_.apply(this, args)
		})
	}
}

function stackSearch(error, structuredStackTrace) {
	var stack

	if (!structuredStackTrace) return
	
	stack = FormatStackTrace(error, structuredStackTrace, fileNameFilter, trycatch.colors)

	for (var fn, i=0, l=structuredStackTrace.length; i<l; i++) {
		fn = structuredStackTrace[i].fun
		if ('_TOKEN_' === fn.name) {
			return {
				token: fn,
				stack: stack
			}
		}
	}
	return {stack: stack}
}
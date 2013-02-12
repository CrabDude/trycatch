var util = require('util')
	, domain = require('domain')
	, FormatStackTrace = require('./formatStackTrace')
	, hook = require('./hook')
	, hooked = false
	, fileNameFilter = [__filename, require.resolve('./hook'), 'domain.js']
	, d = require('path').join('/')
  , node_modules = d + 'node_modules' + d
	, options = {
			'long-stack-traces': null
		, 'colors': {
			  'node': 'white',
			  'node_modules': 'cyan',
			  'default': 'red'
			}
		, 'format': defaultFormat
		, 'filter': fileNameFilter
		}

// use colors module, if available
if (process.stdout.isTTY) {
	try { trycatch.colors = require('colors') } catch(err) {}
}

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
trycatch.format = FormatStackTrace(defaultFormat, fileNameFilter)

function configure(opts) {
	var resetFormat = false

	if ('undefined' !== typeof opts['long-stack-traces']) {
		options['long-stack-traces'] = Boolean(opts['long-stack-traces'])
		
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

	if (null != opts.colors && 'object' === typeof opts.colors) {
		if ('undefined' !== typeof opts.colors.node) {
			options.colors.node = opts.colors.node
		}
		if ('undefined' !== typeof opts.colors.node_modules) {
			options.colors.node_modules = opts.colors.node_modules
		}
		if ('undefined' !== typeof opts.colors.default) {
			options.colors.default = opts.colors.default
		}
	}

	if ('undefined' !== typeof opts.format) {
		if ('function' === typeof opts.format) {
			options.format = opts.format
			resetFormat = true
		} else if (!Boolean(opts.format)) {
			options.format = defaultFormat
			resetFormat = true
		}
	}

	if (Array.isArray(opts.filter)) {
		options.filter = opts.filter
		resetFormat = true
	}

	if (resetFormat) {
		trycatch.format = FormatStackTrace(options.format, options.filter)
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

function domainTrycatch (fn, cb, isLongStackTrace) {
	var parentDomain = domain.active
		, d = domain.create()

	d.on('error', function onError(err) {
		err = buildError(err, Boolean(options['long-stack-traces'] && isLongStackTrace))

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

function buildError(err, isLongStackTrace) {
	var parent
		, token
		, skip = false
		, isError = err instanceof Error

	// Coerce to error
	if (!isError) {
		err = new Error(err)
	}

	if (!isLongStackTrace) {
		return generateStack(err)
	} else if (!isError) {
		console.warn('Unable to generate long-stack-trace for thrown non-Error')
		return generateStack(err)
	}

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

	domainTrycatch(_TOKEN_, catchFn, true)
}

function generateStack(err, fn) {
	if ('function' !== typeof fn) {
		fn = trycatch.format
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
	var stack, fn, i, l

	if (!structuredStackTrace) return
	
	stack = trycatch.format(error, structuredStackTrace)

	for (i=0, l=structuredStackTrace.length; i<l; i++) {
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

function defaultFormat(line) {
	var type, color

	if (trycatch.colors) {
	  if (line.indexOf(node_modules) >= 0) {
	    type = "node_modules";
	  } else if (line.indexOf(d) >= 0) {
	    type = "default";
	  } else {
	    type = "node"
	  }

	  color = options.colors[type]
		if ('none' === color || !Boolean(color)) {
			return
		}

	  if (trycatch.colors[color]) {
	    return trycatch.colors[color](line);
	  }
	}
  return line
}

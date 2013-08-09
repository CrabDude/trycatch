// Don't rely on domains to catch errors
// Use domains to pass caught errors to active
// Keep (add?) fix for event emitter handler
// emit uncaughtException if (isCore(err) && err instanceof EvalError, RangeError, ReferenceError, SyntaxError, TypeError, URIError))


// when we run, set domain to active
// do usual long-stack-traces/trycatch run
//
// in guard, if it's eventemitter, reset active domain to closure domain


var util = require('util')
  , domain = require('domain')
  , path = require('path')
  , FormatStackTrace = require('./formatStackTrace')
  , hookit = require('hookit')
  , fileNameFilter = [__filename, require.resolve('hookit'), 'domain.js']
  , formatter = FormatStackTrace(fileNameFilter)
  , node_modules = path.sep + 'node_modules' + path.sep
  , hasGuardedWithoutLST
  , options

options = {
      'long-stack-traces': null
    , 'colors': {
        'node': false, //'white',
        'node_modules': false, //'cyan',
        'default': 'red'
      }
    , 'format': defaultFormat
    , 'filter': fileNameFilter
    }

module.exports = trycatch

Error.stackTraceLimit = 30

// use colors module, if available
if (process.stdout.isTTY) {
  try { trycatch.colors = require('colors') } catch(err) {}
}


function trycatch(tryFn, catchFn) {
  if ('function' !== typeof tryFn || 'function' !== typeof catchFn) {
    throw new Error('tryFn and catchFn must be functions')
  }
  return trycatch.run(tryFn, catchFn)
}

trycatch.run = run
trycatch.wrap = wrap
trycatch.configure = configure
trycatch.format = defaultFormat

hookit(function generateShim(callback, fnName) {
  return trycatch.wrap(callback, fnName)
})

function run(fn, cb) {
  var parentDomain = domain.active
    , d = domain.create()

  d.on('error', function(e) {
    handleException(e, parentDomain, cb)
  })

  if (options['long-stack-traces']) {
    fn = lstRunWrap(fn)
  }

  runInDomain(d, fn)
  return d
}

function handleException(err, parentDomain, cb) {
    var caught

    err = buildError(err, options['long-stack-traces'])

    err.stack = formatError(err)

    if (!err.catchable) {
      // Unexpected error, core in undefined state, requires restart
      caught = process.emit('uncaughtException', err)
      // Otherwise crash the process
      if (!caught) {
        throw err
      }
      return
    }

    if (!parentDomain) {
      if ('function' === typeof cb) {
        cb(err)
        return
      }
      caught = process.emit('uncaughtApplicationException', err)
      if (!caught) {
        caught = process.emit('uncaughtException', err)
      }
      if (!caught) {
        throw err
      }
      return
    }

    runInDomain(parentDomain, function() {
      cb(err)
    })
}

function runInDomain(d, fn) {
  if (!d || d._disposed) {
    try {
      fn()
    } catch(e1) {
      handleException(e1)
    }
   return
  }

  try {
    d.run(fn)
  } catch(e2) {
    d.emit('error', e2)
  }
}

function isCatchableError(err) {
  if (!isCoreError(err)) return true

  // Unexpected runtime errors aren't catchable
  if (err instanceof EvalError ||
    err instanceof RangeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError ||
    err instanceof URIError) return false

  // Can't catch invalid input errors more than 1 layer deep
  return !isCoreSlice(err.stack.split('\n')[2])
}

function isCoreSlice(slice) {
  return slice && slice.indexOf(path.sep) === -1
}

function isCoreError(err) {
  return true !== err.coerced && err.stack && isCoreSlice(err.stack.split('\n')[1])
}

function lstRunWrap(tryFn) {
  // Create origin _TOKEN_ for stack termination
  function _TOKEN_() {
    tryFn()
  }
  _TOKEN_.error = new Error
  _TOKEN_.parent = 'trycatch'

  return _TOKEN_
}

// Generate a new callback wrapped in _TOKEN_ (optionally with Error for LSTs)
function wrap(callback, name) {
  var parentDomain = domain.active

  if ('function' !== typeof callback) return callback

  function _TOKEN_(that, args) {
    callback.apply(that, args)
  }

  if (options['long-stack-traces']) {
    _TOKEN_.parent = name
    _TOKEN_.error = new Error
  }

  // Running in parentDomain should only be necessary for EventEmitter handlers
  // Core should handle the rest
  // Wrapping is still necessary to fix core error handling
  return function() {
    var that = this
      , args = arguments

    runInDomain(parentDomain, function() {
      _TOKEN_(that, args)
    })
  }
}

function buildError(err, isLST) {
  var parent
    , token
    , skip = false
    , isError = err instanceof Error

  // Coerce to error
  if (!isError) {
    err = new Error(err)
    err.coerced = true
  }

  if (!isLST) {
    return setProperties(generateStack(err))
  } else if (!isError) {
    console.warn('Unable to generate long-stack-trace for thrown non-Error')
    return setProperties(generateStack(err))
  }

  // If previously caught
  if (err.token) {
    skip = true
    token = err.token
  } else {
    parent = generateStack(err, stackSearch).stack
    err.stack = parent.stack
    err = setProperties(err)
    if (!parent.token) {
      // options['long-stack-traces'] was probably toggled after async was invoked
      return err
    }
    token = parent.token
    parent = null
  }

  while(token.error) {
    if (!skip && 'trycatch' === token.parent) break

    skip = false

    // HACK: Use Error.prepareStackTrace = stackSearch to find parent
    parent = generateStack(token.error, stackSearch).stack
    if (!parent) {
      throw err
    }

    if ('trycatch' !== token.parent && parent.stack) {
      err.stack += '\n    ----------------------------------------\n' +
        '    at '+token.parent+'\n' +
        parent.stack.substring(parent.stack.indexOf("\n") + 1)
    }
    token = parent.token
  }

  if ('trycatch' === token.parent) {
    err.token = token
    return err
  }
}

function setProperties(err) {
  err.coreThrown = isCoreError(err)
  err.catchable = isCatchableError(err)
  return err
}

function generateStack(err, fn) {
  var old = Error.prepareStackTrace

  if ('function' !== typeof fn) {
    fn = formatter
  }
  if (!err) err = new Error
  Error.prepareStackTrace = fn
  // Generate stack trace by accessing stack property
  err.stack = err.stack
  Error.prepareStackTrace = old
  return err
}

function stackSearch(error, structuredStackTrace) {
  var stack, fn, i, l

  if (!structuredStackTrace) return

  stack = formatter(error, structuredStackTrace)

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

function formatError(err) {
  if (!err.stack) {
    return err.toString();
  }
  
  var stack = err.stack.split('\n')
    , i = stack.length

  while (i--) {
    stack[i] = trycatch.format(stack[i])
  }
  return stack.join('\n')
}

function defaultFormat(line) {
  var type, color

  if (trycatch.colors) {
    if (line.indexOf(node_modules) >= 0) {
      type = "node_modules";
    } else if (line.indexOf(path.sep) >= 0) {
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

function configure(opts) {
  if (null != opts['long-stack-traces']) {
    opts['long-stack-traces'] = Boolean(opts['long-stack-traces'])

    if (opts['long-stack-traces']) {
      if (hasGuardedWithoutLST) {
        console.warn('Turning long-stack-traces off can result in indeterminate behavior.')
      }
      // findToken fails when _TOKEN_ deeper than Error.stackTraceLimit
      Error.stackTraceLimit = Infinity
    } else {
      Error.stackTraceLimit = 30
    }
    options['long-stack-traces'] = opts['long-stack-traces']
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
      trycatch.format = options.format = opts.format
    } else if (!Boolean(opts.format)) {
      trycatch.format = options.format = defaultFormat
    }
  }

  if (Array.isArray(opts.filter)) {
    options.filter = opts.filter
  }
}


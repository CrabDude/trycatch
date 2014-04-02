var domain = require('domain')
  , path = require('path')
  , hookit = require('hookit')
  , FormatStackTrace = require('./FormatStackTrace')
  , formatErrorModule = require('./formatError')
  , formatErrorWithOptions = formatErrorModule.formatError
  , formatStackWithOptions = formatErrorModule.formatStack
  , coerceToError = formatErrorModule.coerceToError
  , addNonEnumerableValue = formatErrorModule.addNonEnumerableValue
  , delimitter = '\n    ----------------------------------------\n'
  , stackHolder = {}
  , defaultColors
  , defaultFileNameFilter
  , options

defaultColors = {
  'node': 'default'
, 'node_modules': 'cyan'
, 'default': 'red'
}

defaultFileNameFilter = [
  path.dirname(__filename)
, require.resolve('hookit')
, 'domain.js'
, 'Domain.emit'
]

options = {
  'long-stack-traces': false
, 'colors': defaultColors
, 'format': null
, 'filter': defaultFileNameFilter
}

function trycatch(tryFn, catchFn) {
  var parentDomain
    , isLST
    , parentStack
    , d

  if ('function' !== typeof tryFn || 'function' !== typeof catchFn) {
    throw new Error('tryFn and catchFn must be functions')
  }

  parentDomain = domain.active
  isLST = options['long-stack-traces']
  d = domain.create()

  if (isLST) {
    parentStack = trycatch.currentStack
    trycatch.currentStack = null
  }

  d.on('error', _trycatchOnError)
  runInDomain(d, tryFn, trycatchit)

  if (isLST) {
    trycatch.currentStack = parentStack
  }

  return d

  function _trycatchOnError(err) {
    err = coerceToError(err)
    if (!err.normalized) err.stack = formatError(err, err.stack)

    if (!err.catchable) {
      // Most likely a domain "caught" error
      d.exit()
      throw err
    }

    if (err.caught) {
      addNonEnumerableValue(err, 'rethrown', true)
    } else addNonEnumerableValue(err, 'caught', true)

    if (isLST) {
      if (err.rethrown) {
        if (err.parentStack) {
          err.stack += delimitter + err.parentStack
          err.parentStack = undefined
        }
      }

      if (parentStack) {
        if (err.parentStack) err.parentStack = parentStack
        else {
          addNonEnumerableValue(err, 'parentStack', parentStack)
        }
      }
    }

    d.exit()
    handleException(err, parentDomain, catchFn)
  }
}

// Generate a new callback
// Ensure it runs in the same domain
function wrap(callback, name) {
  var isLST
    , stack
    , d

  if ('function' !== typeof callback || callback && callback.name === '_trycatchOnError') return callback

  isLST = options['long-stack-traces']
  d = process.domain
  if (isLST) {
    stack = getUpdatedCurrentStack()
  }

  // Inherit from callback for when properties are added
  newCallback.__proto__ = callback
  return newCallback

  function newCallback() {
    if (isLST) trycatch.currentStack = stack

    runInDomain(d, callback, trycatchitApply, [this, arguments])
  }
}

function getUpdatedCurrentStack() {
  var stack = ''

  if (!options['long-stack-traces']) return

  // Get new stack and chop off leading non-stack portion
  // MUST use Error.captureStackTrace to avoid stack filtering
  Error.captureStackTrace(stackHolder)
  stack = stackHolder.stack

  if (trycatch.currentStack) {
    stack += delimitter + trycatch.currentStack
  }
  return stack
}

function runInDomain(d, tryFn, trycatchitFn, arg) {
  var hasDomain = d && !d._disposed
  var enterExit = hasDomain && process.domain !== d

  enterExit && d.enter()
  var err = trycatchitFn(tryFn, arg)
  enterExit && d.exit()
  if (err) {
    err = coerceToError(err)
    if (hasDomain) {
      d.emit('error', err)
    } else {
      handleException(err)
    }
  }
}

// To avoid V8 deopt
function trycatchitApply(tryFn, args) {
  try {
    tryFn.apply(args[0], args[1])
  } catch(err) {
    return err
  }
}

// To avoid V8 deopt
function trycatchit1(tryFn, arg) {
  try {
    tryFn.call(null, arg)
  } catch(err) {
    return err
  }
}

// To avoid V8 deopt
function trycatchit(tryFn) {
  try {
    tryFn()
  } catch(err) {
    return err
  }
}

function handleException(err, parentDomain, catchFn) {
  var caught
    , secondError

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
    if ('function' === typeof catchFn) {
      secondError = trycatchit1(catchFn, err)
      if (secondError) {
        handleException(secondError);
      }
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
  runInDomain(parentDomain, catchFn, trycatchit1, err)
}

function formatError(err, stack) {
  return formatErrorWithOptions(err, stack
  , {
      lineFormatter: trycatch.format
    , colors: options.colors
    , filter: options.filter
    })
}

function formatStack(stack) {
  return formatStackWithOptions(stack
  , {
      lineFormatter: trycatch.format
    , colors: options.colors
    , filter: options.filter
    })
}

/* Config Logic */

function configure(opts) {
  if (null != opts['long-stack-traces']) {
    options['long-stack-traces'] = Boolean(opts['long-stack-traces'])

    // No longer necessary, but nice to have
    Error.stackTraceLimit = options['long-stack-traces'] ? Infinity  : 10
  }

  if (undefined !== opts.colors) {
    if (opts.colors === null) {
      options.colors = defaultColors
    } else if ('object' === typeof opts.colors) {
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
  }

  if ('undefined' !== typeof opts.format) {
    if ('function' === typeof opts.format) {
      trycatch.format = options.format = opts.format
    } else if (!Boolean(opts.format)) {
      trycatch.format = null
    }
  }

  if (undefined !== opts.filter) {
    if (null === opts.filter) {
      options.filter = defaultFileNameFilter
    } else if (Array.isArray(opts.filter)) {
      options.filter = defaultFileNameFilter.concat(opts.filter)
    }
  }

  return this
}

Error.prepareStackTrace = prepareStackTrace
function prepareStackTrace(err, frames) {
  var stack = FormatStackTrace.call(this, err, frames)
  if (err === stackHolder) {
    // When stackTraceLimit === 0, stack is empty
    stack = stack && stack.substr(16)
    return formatStack(stack)
  }

  stack = formatError(err, stack)
  if (options['long-stack-traces'] && trycatch.currentStack) {
    stack += delimitter + trycatch.currentStack
  }
  return stack
}

// Pass callback wrapping function to hookit
hookit(wrap)

trycatch.configure = configure
trycatch.format = null

module.exports = trycatch

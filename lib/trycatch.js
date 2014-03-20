var util = require('util')
  , domain = require('domain')
  , path = require('path')
  , hookit = require('hookit')
  , chalk = require('chalk')
  , formatErrorWithOptions = require('./formatError').formatError
  , normalizeError = require('./formatError').normalizeError
  , fileNameFilter = [path.dirname(__filename), require.resolve('hookit'), 'domain.js', 'Domain.emit']
  , delimitter = '\n    ----------------------------------------\n'
  , originalError = global.Error
  , hasGuardedWithoutLST
  , options

options = {
  'long-stack-traces': false
, 'colors': {
    'node': 'default',
    'node_modules': 'cyan',
    'default': 'red'
  }
, 'format': null
, 'filter': fileNameFilter
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

  function _trycatchOnError(e) {
    if (!e.caught) {
      if (false === e.domainThrown || false === e.domain_thrown) {
        // "error" emitted, passed directly to domain
        e = normalizeError(e)
      } else {
        d.exit()
        throw e
      }
    }

    if (isLST) {
      if (e.rethrown) {
        if (e.parentStack) {
          e.stack += delimitter + e.parentStack
        }
      }
    }

    e = formatError(e)

    if (isLST && parentStack) {
      e.parentStack = parentStack
    }

    d.exit()
    handleException(e, parentDomain, catchFn)
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
  var obj
    , stack

  if (!options['long-stack-traces']) return

  // Get new stack and chop off leading non-stack portion
  obj = {}
  originalError.captureStackTrace(obj)
  stack = obj.stack.substr(16)

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
    if (hasDomain) {
      d.emit('error', normalizeError(err))
    } else {
      handleException(formatError(normalizeError(err)))
    }
  }
}

// To avoid V8 deopt
function trycatchitApply(tryFn, args) {
  try {
    tryFn.apply(args[0], args[1])
  } catch(e) {
    return e
  }
}

// To avoid V8 deopt
function trycatchit1(tryFn, arg) {
  try {
    tryFn.call(null, arg)
  } catch(e) {
    return e
  }
}

// To avoid V8 deopt
function trycatchit(tryFn) {
  try {
    tryFn()
  } catch(e) {
    return e
  }
}

function handleException(err, parentDomain, catchFn) {
  var caught

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
      catchFn(err)
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

function formatError(err) {
  return formatErrorWithOptions(err
  , {
      'long-stack-traces': options['long-stack-traces']
    , lineFormatter: trycatch.format
    , colors: options.colors
    , filter: options.filter
    })
}

/* Config Logic */

function configure(opts) {
  if (null != opts['long-stack-traces']) {
    opts['long-stack-traces'] = Boolean(opts['long-stack-traces'])

    if (opts['long-stack-traces']) {
      if (hasGuardedWithoutLST) {
        console.warn('Turning long-stack-traces on late can result in incomplete long-stack-traces.')
      }
      // No longer necessary, but nice to have
      originalError.stackTraceLimit = Infinity
    } else {
      originalError.stackTraceLimit = 10
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
      trycatch.format = null
    }
  }

  if (Array.isArray(opts.filter)) {
    options.filter = opts.filter
  }

  return this
}

function Error(message) {
  var err = new originalError(message)
  err.__proto__ = this.__proto__

  if (options['long-stack-traces'] && trycatch.currentStack) {
    err.stack += delimitter + trycatch.currentStack
  }
  formatError(err)
  return err
}
Error.__proto__ = originalError
util.inherits(Error, originalError)
global.Error = Error
Object.defineProperty(Error, 'prepareStackTrace', {
  get: function() {return originalError.prepareStackTrace}
, set: function(v) {originalError.prepareStackTrace = v}
})
Object.defineProperty(Error, 'stackTraceLimit', {
  get: function() {return originalError.stackTraceLimit}
, set: function(v) {originalError.stackTraceLimit = v}
})

// Pass callback wrapping function to hookit
hookit(wrap)

trycatch.configure = configure
trycatch.format = null
trycatch.chalk = chalk

module.exports = trycatch

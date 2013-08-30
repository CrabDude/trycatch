var util = require('util')
  , domain = require('domain')
  , path = require('path')
  , hookit = require('hookit')
  , originalFormatError = require('./formatError').formatError
  , normalizeError = require('./formatError').normalizeError
  , fileNameFilter = [__filename, require.resolve('hookit'), 'domain.js', 'Domain.emit']
  , hasGuardedWithoutLST
  , options

var delimitter = '----------------------------------------'
options = {
  'long-stack-traces': null
, 'colors': {
    'node': 'white',
    'node_modules': 'cyan',
    'default': 'red'
  }
, 'format': null
, 'filter': fileNameFilter
}

/* Run Logic */
function trycatch(tryFn, catchFn) {
  if ('function' !== typeof tryFn || 'function' !== typeof catchFn) {
    throw new Error('tryFn and catchFn must be functions')
  }
  return trycatch.run(tryFn, catchFn)
}

function run(tryFn, catchFn) {
  var parentDomain = domain.active
    , d = domain.create()
    , stack

  d.parentStack = parentDomain && parentDomain.currentStack

  d.on('error', onError)
  runInDomain(d, tryFn)
  return d

  function onError(e) {
    if (!e.caught) {
      d.exit()
      throw e
    }

    if (e.rethrown) {
      if (e.parentStack) {
        e.stack += '\n    ----------------------------------------\n' + e.parentStack
      }
    } else if (d.currentStack) {
      e.stack += '\n    ----------------------------------------\n' + d.currentStack
    }
    e = formatError(e)

    if(d.parentStack) {
      e.parentStack = d.parentStack
    }

    d.exit()
    handleException(e, parentDomain, catchFn)
  }
}

/* Wrapping Logic */

// Generate a new callback
// Ensure it runs in the same domain
function wrap(callback, name) {
  var d = process.domain
    , stack

  if ('function' !== typeof callback) return callback

  stack = getStack(d)

  return function() {
    var that = this
      , args = arguments

    if (d) d.currentStack = stack
    runInDomain(d, function() {
      callback.apply(that, args)
    })
  }
}

function getStack(parentDomain) {
  var stack = ''

  if (options['long-stack-traces']) {
    stack = new Error().stack.substr(6)
    if (parentDomain && parentDomain.currentStack) {
      stack += '\n    ----------------------------------------\n' + parentDomain.currentStack
    }
  }
  return stack
}

function runInDomain(d, fn) {
  if (!d || d._disposed) {
    try {
      fn()
    } catch(e1) {
      handleException(formatError(normalizeError(e1)))
    }
   return
  }

  try {
    d.run(fn)
  } catch(e2) {
    d.emit('error', normalizeError(e2))
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

  runInDomain(parentDomain, function() {
    catchFn(err)
  })
}

function formatError(err) {
  return originalFormatError(err
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
        console.warn('Turning long-stack-traces off can result in indeterminate behavior.')
      }
      // No longer necessary, but nice to have
      Error.stackTraceLimit = Infinity
    } else {
      Error.stackTraceLimit = 10
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
}

/* Setup Logic */

// Pass callback wrapping function to hookit
hookit(function generateShim(callback, fnName) {
  if ('function' !== typeof callback) return callback

  var newCallback = trycatch.wrap(callback, fnName)
  // Inherit from callback for when properties are added
  if (newCallback !== callback) newCallback.__proto__ = callback
  return newCallback
})

trycatch.run = run
trycatch.wrap = wrap
trycatch.configure = configure
trycatch.format = null

module.exports = trycatch
var util = require('util')
  , domain = require('domain')
  , path = require('path')
  , hookit = require('hookit')
  , originalFormatError = require('./formatError').formatError
  , normalizeError = require('./formatError').normalizeError
  , fileNameFilter = [path.dirname(__filename), require.resolve('hookit'), 'domain.js', 'Domain.emit']
  , delimitter = '\n    ----------------------------------------\n'
  , hasGuardedWithoutLST
  , options

options = {
  'long-stack-traces': false
, 'colors': {
    'node': 'white',
    'node_modules': 'cyan',
    'default': 'red'
  }
, 'format': null
, 'filter': fileNameFilter
}

function trycatch(tryFn, catchFn) {
  var parentDomain
    , isLST
    , d

  if ('function' !== typeof tryFn || 'function' !== typeof catchFn) {
    throw new Error('tryFn and catchFn must be functions')
  }

  parentDomain = domain.active
  isLST = options['long-stack-traces']
  d = domain.create()

  if (isLST && parentDomain) {
    d.parentStack = parentDomain.currentStack
  }

  d.on('error', _trycatchOnError)
  runInDomain(d, tryFn)
  return d

  function _trycatchOnError(e) {
    if (!e.caught) {
      if (false === e.domainThrown || false === e.domain_thrown) {
        // "error" emitted, passed directly to domain
        e = normalizeError(e)
        console.log('here: ', e.stack)
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
      } else if (d.currentStack) {
        console.log('there')
        e.stack += delimitter + d.currentStack
      }
    }
    e = formatError(e)


    if (isLST && d.parentStack) {
      e.parentStack = d.parentStack
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
    stack = getStack(d)
  }

  // Inherit from callback for when properties are added
  newCallback.__proto__ = callback
  return newCallback

  function newCallback() {
    var that = this
      , args = arguments

    if (isLST && d) d.currentStack = stack

    runInDomain(d, function() {
      callback.apply(that, args)
    })
  }
}

function getStack(parentDomain) {
  var stack

  if (options['long-stack-traces']) {
    stack = new Error().stack.substr(6)
    if (parentDomain && parentDomain.currentStack) {
      stack += delimitter + parentDomain.currentStack
    }
  }
  return stack
}

function runInDomain(d, tryFn) {
  var catchFn = function(err) {
    d.emit('error', normalizeError(err))
  }

  if (!d || d._disposed) {
    catchFn = function(err) {
      handleException(formatError(normalizeError(err)))
    }
  // Pushes duplicates on stack => catchFn called multiple times
  } else if (process.domain !== d) {
    tryFn = d.bind(tryFn)
  }

  trycatchit(tryFn, catchFn)
}

// To avoid V8 deopt
function trycatchit(tryFn, catchFn) {
  try {
    tryFn()
  } catch(e) {
    catchFn(e)
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

// Pass callback wrapping function to hookit
hookit(wrap)

trycatch.configure = configure
trycatch.format = null

module.exports = trycatch
var path = require('path')
  , node_modules = path.sep + 'node_modules' + path.sep
  , delimitter = '    ----------------------------------------'
  , chalk

// use chalk module, if available
try {chalk = require('chalk') } catch(err) {}

function formatError(err, options) {
  err = normalizeError(err)

  err.stack = formatStack(err
  , {
      lineFormatter: options.lineFormatter
    , colors: options.colors
    , filter: options.filter
    })
  return err
}

// Ensure error conforms to common expectations
function normalizeError(err) {
  var isError = err instanceof Error

  // Coerce to error
  if (!isError) {
    err = new Error(err)
    err.coerced = true
    // For when Error.stackTraceLimit = 0
  } else if (!err.stack) {
    err.stack = String(err)
  }

  if (err.caught) {
    err.rethrown = true
  } else err.caught = true

  err.normalized = true
  err.originalStack = err.stack
  err.coreThrown = isCoreError(err)
  err.catchable = isCatchableError(err)
  return err
}

function isCatchableError(err) {
  if (!isCoreError(err)) return true

  if (false === err.domainThrown || false === err.domain_thrown) return true

  // Unexpected runtime errors aren't catchable
  if (err instanceof EvalError ||
    err instanceof RangeError ||
    err instanceof ReferenceError ||
    err instanceof SyntaxError ||
    err instanceof URIError) return false

  // Can't catch invalid input errors more than 1 layer deep
  return !isCoreSlice(err.originalStack.split('\n')[2])
}

function isCoreSlice(slice) {
  return slice && slice.indexOf(path.sep) === -1
}

function isCoreError(err) {
  return true !== err.coerced && isCoreSlice(err.originalStack.split('\n')[1])
}

/* Post-generation formatting */
function formatStack(err, options) {
  var stack = err.stack.split('\n')
    , newStack = []
    , lineFormatter = options.lineFormatter || defaultFormatter
    , line
    , i, l, j, m

  for (i=0, l=stack.length; i<l; i++) {
    line = lineFormatter(stack[i], {colors: options.colors})
    for (j=0, m=options.filter.length; j<m; j++) {
      if (line && line.indexOf(options.filter[j]) !== -1) {
        line = ''
      }
    }
    if (line) {
      newStack.push(line)
    }
  }
  return newStack.join('\n')
}

function defaultFormatter(line, options) {
  var type, color

  if (chalk) {
    if (line.indexOf(node_modules) >= 0) {
      type = "node_modules";
    } else if (line.indexOf(path.sep) >= 0) {
      type = "default";
    } else if (line === delimitter || line.substring(0, 5) === 'Error') {
      return line
    } else {
      type = "node"
    }

    color = options.colors[type]
    if ('none' === color || !Boolean(color)) {
      return
    }

    if (chalk[color] && chalk[color] !== 'default') {
      return chalk[color](line);
    }
  }

  return line
}

module.exports.formatError = formatError
module.exports.normalizeError = normalizeError
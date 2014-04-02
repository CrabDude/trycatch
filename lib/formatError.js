var path = require('path')
  , node_modules = path.sep + 'node_modules' + path.sep
  , delimitter = '    ----------------------------------------'
  , colors

// use colors module, if available
colors = (function getColors() {
  if (process.stdout && process.stdout.isTTY) {
    try {
      return require('colors')
    } catch(err) {}
  }
})()

function formatError(err, stack, options) {
  normalizeError(err, stack)

  stack = formatStack(stack || ''
  , {
      lineFormatter: options.lineFormatter
    , colors: options.colors
    , filter: options.filter
    })

  return stack
}

function coerceToError(err) {
  // Coerce to error
  if (!isError(err)) {
    err = new Error(err)
    addNonEnumerableValue(err, 'coerced', true)
  }
  err.stack
  return err
}

// Ensure error conforms to common expectations
function normalizeError(err, stack) {
  addNonEnumerableValue(err, 'originalStack', stack || err.message)
  addNonEnumerableValue(err, 'normalized', true)
  addNonEnumerableValue(err, 'coreThrown', isCoreError(err))
  addNonEnumerableValue(err, 'catchable', isCatchableError(err))
}

function addNonEnumerableValue(obj, property, value) {
  Object.defineProperty(obj, property, {
    writable: true
  , enumerable: false
  , configurable: true
  , value: value
  })
}

function isCatchableError(err) {
  if (!isCoreError(err)) return true

  if (true === err.domainThrown || true === err.domain_thrown) return false

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
function formatStack(stack, options) {
  var newStack = []
    , lineFormatter = options.lineFormatter || defaultFormatter
    , line
    , i, l, j, m

  stack = stack.split('\n')

  for (i=0, l=stack.length; i<l; i++) {
    line = lineFormatter(stack[i], {colors: options.colors})
    for (j=0, m=options.filter.length; j<m; j++) {
      if (line && line.indexOf(options.filter[j]) !== -1) {
        line = null
        break
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

  if (colors) {
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

    if (colors[color] && colors[color] !== 'default') {
      return colors[color](line);
    }
  }

  return line
}

function isError(err) {
  return Object.prototype.toString.call(err) === "[object Error]"
}

module.exports.formatError = formatError
module.exports.formatStack = formatStack
module.exports.coerceToError = coerceToError
module.exports.addNonEnumerableValue = addNonEnumerableValue
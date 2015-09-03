function FormatStackTrace(error, frames) {
  var stack = stringify(error, String)

  for (var line, i = 0, l = frames.length; i < l; i++) {
    line = stringify(frames[i], String)
    if (line) stack += '\n    at ' + line
  }
  return stack
}

// To avoid V8 deopt
function stringify(error, fn) {
  try {
    try {
      return fn(error)
    } catch(e) {
      return '<error: ' + e + '>'
    }
  } catch(ee) {
    // Any code that reaches this point is seriously nasty!
    return '<error>'
  }
}

module.exports = FormatStackTrace

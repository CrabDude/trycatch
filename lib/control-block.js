module.exports = Block

/**
 * Block class is used for routing errors to higher level logic.
 */
function Block(errback) {
  this._parent = Block.current
  this._errback = errback
}
Block.current = null

/**
 * Wrap a function such that any exceptions it generates
 * are sent to the error callback of the Block that is active
 * at the time of the call to guard().  If no Block
 * is active, just returns the function.
 *
 * Example: stream.on('end', Block.guard(function() { ... }))
 */
Block.guard=function(f) {
  if (Block.current) return Block.current.guard(f)
  else return f
}

/**
 * Begins a new Block with two callback functions.  The first
 * is the main part of the block (think 'try body'), the
 * second is the rescue function/error callback (think 'catch').
 * The terminology follows Ruby for no other reason than that
 * Block, begin and rescue describe an exception handling
 * paradigm and are not reserved words in JavaScript.
 */
Block.begin=function(block, rescue) {
  var ec = new Block(rescue)
  return ec.trap(block)
}

/**
 * Returns a function(err) that can be invoked at any time to raise
 * an exception against the now current block (or the current context
 * if no current).  Errors are only raised if the err argument is true
 * so this can be used in both error callbacks and error events.
 *
 * Example: request.on('error', Block.errorHandler())
 */
Block.errorHandler=function() {
  // Capture the now current Block for later
  var current = this.current
  
  return function(err) {
    if (!err) return
    if (current) return current.raise(err)
    else throw err
  }
}

/**
 * Raises an exception on the Block.  If the block has an
 * error callback, it is given the exception.  Otherwise,
 * raise(...) is called on the parent block.  If there is
 * no parent, the exception is simply raised.
 * Any nested exceptions from error callbacks will be raised
 * on the block's parent.
 */
Block.prototype.raise=function(err) {
  var self = this

  if (!(err instanceof Error)) {
    err = new Error(err)
  }
  if (this._errback) {
    try {
      if (!this._parent) return this._errback(err)
      this._parent.trap(function() {
        self._errback(err)
      })
    } catch (nestedE) {
      if (!this._parent) throw nestedE
      this._parent.raise(nestedE)
    }
  } else {
    if (!this._parent) throw(err)
    this._parent.raise(err)
  }
}

/**
 * Executes a callback in the context of this block.  Any
 * errors will be passed to this Block's raise() method.
 * Returns the value of the callback or undefined on error.
 */
Block.prototype.trap=function(callback) {
  var origCurrent=Block.current
  Block.current=this
  try {
    var ret=callback()
    Block.current=origCurrent
    return ret
  } catch (e) {
    Block.current=origCurrent
    this.raise(e)
  }
}

/**
 * Wraps a function and returns a function that routes
 * errors to this block.  This is similar to trap but
 * returns a new function instead of invoking the callback
 * immediately.
 */
Block.prototype.guard=function(f) {
  if (f.__guarded__) return f
  var self=this
  var wrapped=function() {
    var origCurrent=Block.current
    Block.current=self
    try {
      var ret=f.apply(this, arguments)
      Block.current=origCurrent
      return ret
    } catch (e) {
      Block.current=origCurrent
      self.raise(e)
    }
  }
  wrapped.__guarded__=true
  return wrapped
}
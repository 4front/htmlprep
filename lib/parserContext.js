var debug = require('debug')('htmlprep');

module.exports = ParserContext;

function ParserContext(output, tagMatch) {
  this._originalOutput = output;
  this._tagMatch;
  this._tagMatchStack;
  this._output = output;

  this.variations = {};
  this.removing = false;
}

ParserContext.prototype.writeOutput = function(str) {
  this._output.push(str);
};

ParserContext.prototype.pushOpenTag = function(tagName) {
  debug("pushOpenTag tagName:%s, currentTag:%s", tagName, this._tagMatch);
  if (tagName === this._tagMatch) {
    this._tagMatchStack++;
    debug("increment match context stack %s", this._tagMatchStack);
  }
}

ParserContext.prototype.popTag = function(tagName) {
  if (this._tagMatch === tagName) {
    this._tagMatchStack--;
    debug("decrement stack for tag context %s %s", this._tagMatch, this._tagMatchStack);
    if (this._tagMatchStack === 0) {
      debug("end of tag %s match context", this._tagMatch);
      this._output = this._originalOutput;
      this._tagMatch = null;
      this.removing = false;
    }
  }
}

ParserContext.prototype.swapOutput = function(output) {
  this._originalOutput = this.output;
  this.output = output;
};

ParserContext.prototype.revertOutput = function() {
  this.output = this._originalOutput;
};

ParserContext.prototype.startTagMatch = function(tagName, removeContents) {
  debugger;
  this._tagMatch = tagName;
  this._tagMatchStack = 1;

  this.removing = removeContents;

  debug("begin tagMatchContext %s, removing: %s", this._tagMatch, this.removing);
};


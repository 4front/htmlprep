var EventEmitter = require('events').EventEmitter;
var HtmlParser = require('../htmlparser2').Parser;
var debug = require('debug')('htmlprep');
var util = require('util');
var includes = require('lodash.includes');
var isEmpty = require('lodash.isempty');
var isString = require('lodash.isstring');
var isNull = require('lodash.isnull');
var forEach = require('lodash.foreach');
var has = require('lodash.has');
var glob = require('glob');

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col',
  'command', 'embed', 'hr', 'img', 'input'
];

// Special characters that should be escaped to prevent confusion with HTML characters
// http://www.w3.org/TR/html4/charset.html
var charEntityReferences = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;'
};

module.exports = Parser;

function Parser(options, output) {
  var self = this;

  debug('Parser constructor');

  this._output = output;
  this._options = options;
  this._tagMatchStack = 0;
  this._tagMatch = null;
  this._removing = false;

  // The baseUrlRegex matches the root baseUrl followed by 0 or more slashes
  this._baseUrlRegex = new RegExp(options.baseUrlPlaceholder + '/*', 'ig');

  this._customAttribute = require('./custom-attribute')(options.attrPrefix);
  this._attributeModifier = require('./attribute-modifier')(this._options);
  this._textModifier = require('./text-modifier')(this._options);

  this._parser = new HtmlParser({
    onopentag: function(name, attribs) {
      self.onOpenTag(name, attribs);
    },
    onclosetag: function(name) {
      self.onCloseTag(name);
    },
    ontext: function(text) {
      if (self._removing === true) return;

      debug('writing text %s', text);

      // If the literal string is a single character like a double-quote, check if there is a
      // special character mapping.
      if (text.length === 1 && charEntityReferences[text]) {
        self._output.push(charEntityReferences[text]);
      } else {
        self._output.push(self._textModifier(self._currentTagName, text));
      }
    },
    onprocessinginstruction: function(name, data) {
      self._output.push('<' + data + '>');
    },
    oncomment: function(value) {
      self._output.push('<!--' + value);
    },
    oncommentend: function() {
      self._output.push('-->');
    },
    onend: function() {
      debug('parser.onend');
      self.emit('end');
    }
  }, {
    decodeEntities: false,
    lowerCaseTags: false,
    lowerCaseAttributeNames: false,
    doNotParseCodeBlocks: true
  });
}

util.inherits(Parser, EventEmitter);

Parser.prototype.write = function(chunk) {
  var self = this;
  debug('writing chunk %s to parser', chunk);
  self._parser.write(chunk);
};

Parser.prototype.end = function() {
  this._parser.end();
};

Parser.prototype.onOpenTag = function(tagName, attribs) {
  tagName = tagName.toLowerCase();
  debug('open %s', tagName);

  // Trim all the attribs
  forEach(attribs, function(value, key) {
    attribs[key] = value.trim();
  });

  // Content variation block
  if (this._removing !== true) {
    // var contentVariation = attribs[customAttrs.contentVariation];
    // if (isEmpty(contentVariation) === false) {
    //   if (context.tagMatch) throw new Error("Invalid nesting of content-variation element");

    //   context.variations[variation] = new VariationBuffer();
    //   context.swapOutput(context.variations[variation]);
    //   context.startTagMatch(name, false);
    // }

    // var variationName = attribs[customAttrs.variation];
    // if (isEmpty(variationName) === false) {
    //   if (this._tagMatch)
    //     throw new Error("Invalid nesting of variation element");

    //   if (options.variation && variationName !== options.variation) {
    //     // Check if we have content for this variation name.
    //     var substituteContent = context.contentVariations[variationName];
    //     if (isEmpty(substituteContent) === false) {
    //       // Write the substitute content.
    //       context.writeOutput(substituteContent);
    //       context.startTagMatch(name, true);

    //       return;
    //     }
    //   }
    //   attribs[customAttrs.contentSubstitute] = null;
    // }

    // If there is a data-placeholder attribute, replace the tag
    // with the new contents.
    var placeholder = attribs[this._customAttribute('placeholder')];
    if (isEmpty(placeholder) === false) {
      attribs[this._customAttribute('placeholder')] = null;

      this._output.push(buildTag(tagName, attribs));

      if (isEmpty(this._options.inject[placeholder]) === false) {
        debug('injecting block %s', placeholder);
        this._output.push(this._options.inject[placeholder]);
      }

      return;
    }
  }

  debug('pushOpenTag tagName:%s, currentTag:%s', tagName, this._tagMatch);
  if (tagName === this._tagMatch) {
    this._tagMatchStack++;
    debug('increment match context stack %s', this._tagMatchStack);
  }

  // If in removeMode, don't write to the output stream.
  if (this._removing === true) return;

  // If the data-strip attribute is present, remove this tag and everything within it.
  if (has(attribs, this._customAttribute('strip'))) {
    this.startTagMatch(tagName, true);
    return;
  }

  var buildType = attribs[this._customAttribute('build')];
  if (isEmpty(buildType) === false) {
    this.startTagMatch(tagName, buildType !== this._options.buildType);

    if (this._removing === true) return;

    attribs[this._customAttribute('build')] = null;
  }

  // Some tools capitalize the 'S' in stylesheet but livereload
  // requires all lowercase.
  if (tagName === 'link' && attribs.rel === 'Stylesheet') {
    attribs.rel = 'stylesheet';
  }

  var globPattern;

  // Look for a set of scripts to expand
  // <script data-src-expand="js/**/*/js"></script>
  var srcExpandAttr = this._customAttribute('src-expand');
  if (tagName === 'script' && attribs[srcExpandAttr]) {
    this.startTagMatch('script', true);
    globPattern = attribs[srcExpandAttr];
    attribs[srcExpandAttr] = null;
    this.expandGlobPattern('script', globPattern, attribs);

    // Need to explicitly return here since we are removing the original script tag
    return;
  }

  // Look for a set of stylesheets to expand
  // <link data-href-expand="css/**/*.css" />
  var hrefExpandAttr = this._customAttribute('href-expand');
  if (tagName === 'link' && attribs[hrefExpandAttr]) {
    globPattern = attribs[hrefExpandAttr];
    attribs[hrefExpandAttr] = null;
    this.expandGlobPattern('link', globPattern, attribs);

    // Need to explicitly return here since we are removing the original link tag
    return;
  }

  this._attributeModifier(tagName, attribs);

  this._currentTagName = tagName;
  this._output.push(buildTag(tagName, attribs, includes(singletonTags, tagName)));
};

Parser.prototype.onCloseTag = function(tagName) {
  tagName = tagName.toLowerCase();
  this._currentTagName = null;
  debug('close %s', tagName);

  // get the value of this._removing before this.popTag is invoked
  // which could change the value.
  var removing = this._removing;
  this.popTag(tagName);

  // if this._removing was true before popTag, then exit now.
  if (removing === true) return;

  // Don't close singleton tags
  if (includes(singletonTags, tagName)) return;

  // Special blocks appended to the head
  if (tagName === 'head') {
    if (this._options.inject.head) {
      this._output.push(this._options.inject.head);
    }
  }

  // Append the livereload script at the end of the body.
  if (tagName === 'body') {
    if (this._options.inject.body) {
      debug('inject body block');
      this._output.push(this._options.inject.body);
    }

    if (this._options.liveReload === true) {
      this._output.push('<script src="//localhost:' +
        this._options.liveReloadPort + '/livereload.js"></script>');
    }
  }

  debug('writing close </%s>', tagName);
  this._output.push('</' + tagName + '>');
};

Parser.prototype.startTagMatch = function(tagName, removeContents) {
  this._tagMatch = tagName;
  this._tagMatchStack = 1;
  this._removing = removeContents;

  debug('begin tagMatchContext %s, removing: %s', this._tagMatch, this._removing);
};

Parser.prototype.popTag = function(tagName) {
  if (this._tagMatch === tagName) {
    this._tagMatchStack--;
    debug('decrement stack for tag context %s %s', this._tagMatch, this._tagMatchStack);
    if (this._tagMatchStack === 0) {
      debug('end of tag %s match context', this._tagMatch);
      // this._output = this._originalOutput;
      this._tagMatch = null;
      this._removing = false;
    }
  }
};

Parser.prototype.appendFingerprintQuery = function(attribs) {
  var assetPath = attribs.src;
  if (isEmpty(assetPath)) return;

  // If this is an embedded url, leave it be.
  if (assetPath.slice(0, 5) === 'data:') return;

  if (assetPath.indexOf('?') !== -1) {
    assetPath += '&' + this.options.fingerprintQuery + '=' + this.options.fingerprint;
  }
};

Parser.prototype.expandGlobPattern = function(tagName, pattern, attribs) {
  // Use glob to find all the matching files
  var fileMatches = glob.sync(pattern, {
    cwd: this._options.cwd,
    nonull: true,
    nodir: true
  });

  for (var i = 0; i < fileMatches.length; i++) {
    var assetPath = fileMatches[i].replace('\\', '/');

    if (tagName === 'script') {
      attribs.src = assetPath;
      this._output.push(buildTag('script', attribs));
      this._output.push('</script>');
    } else if (tagName === 'link') {
      attribs.href = assetPath;
      this._output.push(buildTag('link', attribs, true));
    }
  }
};

function buildTag(name, attribs, selfClosing) {
  var tag = '<' + name;
  forEach(attribs, function(attrValue, key) {
    if (isString(attrValue) && attrValue.length === 0) {
      tag += ' ' + key;
    } else if (isNull(attrValue) === false) {
      tag += ' ' + key + '="' + attrValue + '"';
    }
  });

  tag += selfClosing === true ? '/>' : '>';
  return tag;
}

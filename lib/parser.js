var EventEmitter = require('events').EventEmitter;
var HtmlParser = require('htmlparser2').Parser;
var debug = require('debug')('htmlprep');
var util = require('util');
var _ = require('lodash');
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

var absoluteUrlRe = /^(\/\/|http[s]?:\/\/)/i;

var customAttributes = [
  'build',              // indicate a tag that should be conditionally included based on the build type, i.e. 'release' or 'debug'.
  'placeholder',        // deliniate a tag that is a placeholder for injectable content
  'content-variation',
  'src-expand',         // expand tags with src wildcard attributes
  'href-expand',        // expand tags with wildcard href attributes
  'src-keep'            // indicate that the src attribute should not be re-written to an absolute CDN url
];

module.exports = Parser;

function Parser(options, output) {
  var self = this;

  debug('Parser constructor');

  this._output = output;
  // this._originalOutput = output;
  this._options = options;
  this._tagMatchStack = 0;
  this._tagMatch = null;
  this._removing = false;

  // Map each custom attribute to the full actual attribute name with the data- prefix followed
  // by an optional custom prefix, i.e. data-custom-build
  this._customAttrs = {};
  _.each(customAttributes, function(name) {
    var attrValue = 'data-' + (options.attrPrefix ? (options.attrPrefix + '-') : '') + name;
    self._customAttrs[name] = attrValue;
  });

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
        self._output.push(text);
      }
    },
    onprocessinginstruction: function(name, data) {
      self._output.push('<' + data + '>');
    },
    onend: function() {
      debug('parser.onend');
      self.emit('end');
    }
  }, {
    decodeEntities: true
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

  // Content variation block
  if (this._removing !== true) {
    // var contentVariation = attribs[customAttrs.contentVariation];
    // if (_.isEmpty(contentVariation) === false) {
    //   if (context.tagMatch) throw new Error("Invalid nesting of content-variation element");

    //   context.variations[variation] = new VariationBuffer();
    //   context.swapOutput(context.variations[variation]);
    //   context.startTagMatch(name, false);
    // }

    // var variationName = attribs[customAttrs.variation];
    // if (_.isEmpty(variationName) === false) {
    //   if (this._tagMatch)
    //     throw new Error("Invalid nesting of variation element");

    //   if (options.variation && variationName !== options.variation) {
    //     // Check if we have content for this variation name.
    //     var substituteContent = context.contentVariations[variationName];
    //     if (_.isEmpty(substituteContent) === false) {
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
    var placeholder = attribs[this._customAttrs.placeholder];
    if (_.isEmpty(placeholder) === false) {
      attribs[this._customAttrs.placeholder] = null;

      this._output.push(buildTag(tagName, attribs));

      if (_.isEmpty(this._options.inject[placeholder]) === false) {
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

  var buildType = attribs[this._customAttrs.build];
  if (_.isEmpty(buildType) === false) {
    this.startTagMatch(tagName, buildType !== this._options.buildType);

    if (this._removing === true) return;

    attribs[this._customAttrs.build] = null;
  }

  // Some tools capitalize the 'S' in stylesheet but livereload
  // requires all lowercase.
  if (tagName === 'link' && attribs.rel === 'Stylesheet') {
    attribs.rel = 'stylesheet';
  }

  var globPattern;

  // Look for a set of scripts to expand
  // <script data-src-expand="js/**/*/js"></script>
  if (tagName === 'script' && attribs[this._customAttrs['src-expand']]) {
    this.startTagMatch('script', true);
    globPattern = attribs[this._customAttrs['src-expand']];
    attribs[this._customAttrs['src-expand']] = null;
    this.expandGlobPattern('script', globPattern, attribs);

    // Need to explicitly return here since we are removing the original script tag
    return;
  }

  // Look for a set of stylesheets to expand
  // <link data-href-expand="css/**/*.css" />
  if (tagName === 'link' && attribs[this._customAttrs['href-expand']]) {
    globPattern = attribs[this._customAttrs['href-expand']];
    attribs[this._customAttrs['href-expand']] = null;
    this.expandGlobPattern('link', globPattern, attribs);

    // Need to explicitly return here since we are removing the original link tag
    return;
  }

  // Prepend asset paths if a prefix was provided. This is most often used to
  // point static assets to a CDN.
  if (_.isEmpty(this._options.assetPathPrefix) === false) {
    if (tagName === 'link' && attribs.href) {
      this.prependAssetPath(attribs, 'href');
    } else if (_.contains(['script', 'img', 'embed'], tagName)) {
      if (_.has(attribs, this._customAttrs['src-keep']) === false) {
        this.prependAssetPath(attribs, 'src');
      }
    }
  }

  this._output.push(buildTag(tagName, attribs, _.contains(singletonTags, tagName)));
};

Parser.prototype.onCloseTag = function(tagName) {
  tagName = tagName.toLowerCase();
  debug('close %s', tagName);

  // get the value of this._removing before this.popTag is invoked
  // which could change the value.
  var removing = this._removing;
  this.popTag(tagName);

  // if this._removing was true before popTag, then exit now.
  if (removing === true) return;

  // Don't close singleton tags
  if (_.contains(singletonTags, tagName)) return;

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

Parser.prototype.prependAssetPath = function(attribs, pathAttr) {
  if (_.isEmpty(attribs[pathAttr])) return;

  // If the path is already absolute, leave it as-is.
  if (absoluteUrlRe.test(attribs[pathAttr])) return;

  attribs[pathAttr] = this._options.assetPathPrefix +
    (attribs[pathAttr][0] === '/' ? '' : '/') + attribs[pathAttr];
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
  _.each(attribs, function(attrValue, key) {
    if (_.isString(attrValue) && attrValue.length === 0) {
      tag += ' ' + key;
    } else if (_.isNull(attrValue) === false) {
      tag += ' ' + key + '="' + attrValue + '"';
    }
  });

  tag += selfClosing === true ? '/>' : '>';
  return tag;
}

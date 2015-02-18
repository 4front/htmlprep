var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('4front:htmlprep');
var Parser = require('htmlparser2').Parser;
var ParserContext = require('./lib/parserContext');

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col',
  'command', 'embed', 'hr', 'img', 'input'
]

var absoluteUrlRe = /^(\/\/|http[s]?:\/\/)/i

exports = module.exports = function(options) {
  options = _.defaults(options, {
    attrPrefix: null,
    buildType: 'debug',
    liveReload: false, // Should livereload script be injected
    liveReloadPort: 35729, // Port that livereload to listen on
    inject: {}, // Blocks of HTML to be injected
    variation: null, // The name of the variation to render. Omit for default content.
    contentVariations: null, // File with the content variations
    assetPathPrefix: null
  });

  // Map each custom attribute to the full actual attribute name with the data- prefix followed 
  // by an optional custom prefix, i.e. data-custom-build
  var customAttrs = {};
  _.each(['build', 'placeholder', 'content-variation'], function(name) {
    customAttrs[name] = 'data-' + (options.attrPrefix ? (options.attrPrefix + '-') : '') + name;
  });

  // if (!_.isEmpty(options.variations)) {
  //   // Load the variations into a map

  // }

  return through2(function(chunk, enc, callback) {
    var context = new ParserContext(this);

    var parser = new Parser({
      onopentag: function(name, attribs) {
        onOpenTag(name, attribs, context)
      },
      onclosetag: function(name) {
        onCloseTag(name, context);
      },
      ontext: function(text) {
        if (context.removing === true)
          return;

        debug("writing text %s", text);
        context.writeOutput(text);
      },
      onprocessinginstruction: function(name, data) {
        context.writeOutput('<' + data + '>');
      },
      onend: function() {
        callback();
      }
    }, {
      decodeEntities: true
    });

    parser.write(chunk);
    parser.end();
  });

  function onOpenTag(name, attribs, context) {
    name = name.toLowerCase();
    debug('open %s', name);

    // Content variation block
    if (context.removing !== true) {
      var contentVariation = attribs[customAttrs.contentVariation];
      if (_.isEmpty(contentVariation) === false) {
        if (context.tagMatch) throw new Error("Invalid nesting of content-variation element");

        context.variations[variation] = new VariationBuffer();
        context.swapOutput(context.variations[variation]);
        context.startTagMatch(name, false);
      }

      var variationName = attribs[customAttrs.variation];
      if (_.isEmpty(variationName) === false) {
        if (context.tagMatch) 
          throw new Error("Invalid nesting of variation element");

        if (options.variation && variationName !== options.variation) {
          // Check if we have content for this variation name.
          var substituteContent = context.contentVariations[variationName];
          if (_.isEmpty(substituteContent) === false) {
            // Write the substitute content.
            context.writeOutput(substituteContent); 
            context.startTagMatch(name, true);

            return;
          }
        }
        attribs[customAttrs.contentSubstitute] = null;
      }

      // If there is a data-placeholder attribute, replace the tag
      // with the new contents.
      var placeholder = attribs[customAttrs.placeholder];
      if (_.isEmpty(placeholder) === false) {
        attribs[customAttrs.placeholder] = null;

        context.writeOutput(buildTag(name, attribs));

        if (_.isEmpty(options.inject[placeholder]) === false) {
          debug('injecting block %s', placeholder);
          context.writeOutput(options.inject[placeholder]);
        }

        return;
      }
    }

    context.pushOpenTag(name);

    // If in removeMode, don't write to the output stream.
    if (context.removing === true)
      return;

    var buildType = attribs[customAttrs.build];
    if (_.isEmpty(buildType) === false) {
      context.startTagMatch(name, buildType !== options.buildType);

      if (context.removing === true)
        return;

      debugger;
      attribs[customAttrs.build] = null;
    }

    // Some tools capitalize the 'S' in stylesheet but livereload 
    // requires all lowercase.
    if (name === 'link' && attribs.rel === 'Stylesheet')
      attribs.rel = 'stylesheet';

    // Prepend asset paths if a prefix was provided. This is most often used to 
    // point static assets to a CDN.
    if (_.isEmpty(options.assetPathPrefix) === false) {
      if (name === 'link' && attribs.href)
        prependAssetPath(attribs, 'href');
      else if (_.contains(['script', 'img', 'embed'], name))
        prependAssetPath(attribs, 'src');
    }

    context.writeOutput(buildTag(name, attribs));
  }

  function onCloseTag(name, context) {
    name = name.toLowerCase();
    debug('close %s', name);

    var removing = context.removing;
    context.popTag(name);

    if (removing === true)
      return;

    // Don't close singleton tags
    if (_.contains(singletonTags, name))
      return;

    // Special blocks appended to the head
    if (name === 'head') {
      if (options.inject.head) {
        context.writeOutput(options.inject.head);
      }
    }

    // Append the livereload script at the end of the body.
    if (name === 'body') {
      if (options.inject.body)
        context.writeOutput(options.inject.body);
      if (options.liveReload === true)
        context.writeOutput('<script src="//localhost:' + options.liveReloadPort + '/livereload.js"></script>');
    }

    context.writeOutput("</" + name + ">");
  }

  function prependAssetPath(attribs, pathAttr) {
    if (_.isEmpty(attribs[pathAttr]))
      return;

    // If the path is already absolute, leave it as-is.
    if (absoluteUrlRe.test(attribs[pathAttr]))
      return;

    attribs[pathAttr] = options.assetPathPrefix + (attribs[pathAttr][0] === '/' ? '' : '/') + attribs[pathAttr];
  }
};

function buildTag(name, attribs) {
  var tag = "<" + name;
  for (var key in attribs) {
    var attrValue = attribs[key];
    if (_.isEmpty(attrValue) === false)
      tag += " " + key + "=\"" + attrValue + "\"";
  }
  tag += ">";
  return tag;
}


function VariationBuffer() {
  this._str = '';
};

VariationBuffer.prototype.push = function(str) {
  this._str += str;
}

VariationBuffer.prototype.toString = function() {
  return this._str;
}
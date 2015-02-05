var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('htmlprep');
var Parser = require('htmlparser2').Parser;

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col',
  'command', 'embed', 'hr', 'img', 'input'
]

var absoluteUrlRe = /^(\/\/|http[s]?):\/\//i

exports = module.exports = function(options) {
  options = _.defaults(options, {
    attrPrefix: null,
    buildType: 'debug',
    liveReload: false, // Should livereload script be injected
    liveReloadPort: 35729, // Port that livereload to listen on
    inject: {} // Blocks of HTML to be injected
  });

  // Map each custom attribute to the full actual attribute name with the data- prefix followed 
  // by an optional custom prefix, i.e. data-custom-build
  var customAttrs = {};
  _.each(['build', 'placeholder'], function(name) {
    customAttrs[name] = 'data-' + (options.attrPrefix ? (options.attrPrefix + '-') : '') + name;
  });

  if (options.cdnify && !options.cdnHost)
    throw new Error("If cdnify option is true, a cdnHost must be specified.");

  return through2(function(chunk, enc, callback) {
    var context = {
      output: this,
      tagMatch: null
    };

    var parser = new Parser({
      onopentag: function(name, attribs) {
        onOpenTag(name, attribs, context)
      },
      onclosetag: function(name) {
        onCloseTag(name, context);
      },
      ontext: function(text) {
        if (context.tagMatch && context.tagMatch.omitContents === true)
          return;

        context.output.push(text);
      },
      onprocessinginstruction: function(name, data) {
        context.output.push('<' + data + '>');
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

    // If there is a data-placeholder attribute, replace the tag
    // with the new contents.
    var placeholder = attribs[customAttrs.placeholder];
    if (_.isEmpty(placeholder) === false) {
      attribs[customAttrs.placeholder] = null;

      context.output.push(buildTag(name, attribs));

      if (_.isEmpty(options.inject[placeholder]) === false) {
        debug('injecting block %s', placeholder);
        context.output.push(options.inject[placeholder]);
      }

      return;
    }

    // If in removeMode, don't write to the output stream.
    if (context.tagMatch) {
      if (name === context.tagMatch.name) {
        context.tagMatch.stack++;
        debug("increment match context stack %s", JSON.stringify(context.tagMatch));
      }
      if (context.tagMatch.omitContents === true) {
        debug("in omit tag context, skipping %s tag", name);
        return;
      }
    }

    var buildType = attribs[customAttrs.build];
    if (_.isEmpty(buildType) === false) {
      context.tagMatch = {
        name: name,
        stack: 1,
        omitContents: buildType !== options.buildType
      };

      if (context.tagMatch.omitContents === false) {
        attribs[customAttrs.build] = null;
        context.output.push(buildTag(name, attribs));
      }

      debug("begin tagMatchContext %s", JSON.stringify(context.tagMatch));
      return;
    }

    // Some tools capitalize the 'S' in stylesheet but livereload 
    // requires all lowercase.
    if (name === 'link' && attribs.rel === 'Stylesheet')
      attribs.rel = 'stylesheet';

    // Rewrite asset src paths to the CDN host
    if (options.cdnify) {
      if (name === 'link' && attribs.href)
        cdnifyPath(attribs, 'href');
      else if (_.contains(['script', 'img', 'embed'], name))
        cdnifyPath(attribs, 'src');
    }

    context.output.push(buildTag(name, attribs));
  }

  function onCloseTag(name, context) {
    name = name.toLowerCase();
    debug('close %s', name);

    if (context.tagMatch) {
      var omitContents = context.tagMatch.omitContents;
      if (name === context.tagMatch.name) {
        context.tagMatch.stack--;
        debug("decrement stack for tag context %s", JSON.stringify(context.tagMatch));
        if (context.tagMatch.stack === 0) {
          debug("end of tag %s match context", context.tagMatch.name);
          context.tagMatch = null;
        }
      }
      if (omitContents === true)
        return;
    }

    // Don't close singleton tags
    if (_.contains(singletonTags, name))
      return;

    // Special blocks appended to the head
    if (name === 'head') {
      if (options.inject.head) {
        context.output.push(options.inject.head);
      }
    }

    // Append the livereload script at the end of the body.
    if (name === 'body') {
      if (options.inject.body)
        context.output.push(options.inject.body);
      if (options.liveReload === true)
        context.output.push('<script src="//localhost:' + options.liveReloadPort + '/livereload.js"></script>');
    }

    context.output.push("</" + name + ">");
  }

  function cdnifyPath(attribs, pathAttr) {
    // If the path is already absolute, leave it as-is.
    if (absoluteUrlRe.test(attribs[pathAttr]))
      return;

    attribs[pathAttr] = '//' + options.cdnHost + (attribs[pathAttr][0] === '/' ? '' : '/') + attribs[pathAttr];
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
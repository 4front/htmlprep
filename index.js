var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('htmlprep');
var Parser = require('htmlparser2').Parser;

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col', 
  'command', 'embed', 'hr', 'img', 'input']

var absoluteUrlRe = /^(\/\/|http[s]?):\/\//i

exports = module.exports = function(options) {
  options = _.defaults(options, {
    attrPrefix: null,
    buildType: 'debug',
    livereload: false,      // Should livereload script be injected
    livereloadPort: 35729,  // Port that livereload to listen on
    inject: {}   // Blocks of HTML to be injected
  });

  if (options.cdnify && !options.cdnHost)
    throw new Error("If cdnify option is true, a cdnHost must be specified.");

  return through2(function(chunk, enc, callback) {
    var self = this;
    
    // var removingTag = null;
    // var removeStack = 0;

    var tagMatchContext = null;
    var inPlaceholder = false;

    var parser = new Parser({
      onopentag: function(name, attribs) {
        name = name.toLowerCase();
        debug('open %s', name);

        // If there is a data-placeholder attribute, replace the tag
        // with the new contents.
        var placeholder = getCustomAttr(attribs, 'placeholder');
        if (_.isEmpty(placeholder) === false) {
          if (_.isEmpty(options.inject[placeholder]) === false) {
            debug('injecting block %s', placeholder);
            self.push(options.inject[placeholder]);
          }
          
          inPlaceholder = true;
          return;
        }
        
        // If in removeMode, don't write to the output stream.
        if (tagMatchContext) {
          if (name === tagMatchContext.name) {
            tagMatchContext.stack++;  
            debug("increment match context stack %s", JSON.stringify(tagMatchContext));
          }
          if (tagMatchContext.omitContents === true) {
            debug("in omit tag context, skipping %s tag", name);
            return;
          }
        }

        var buildType = getCustomAttr(attribs, 'build');
        if (_.isUndefined(buildType) === false) {
          tagMatchContext = {
            name: name, 
            stack:1, 
            omitContents:buildType !== options.buildType
          };
          debug("begin tagMatchContext %s", JSON.stringify(tagMatchContext));
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
          else if (_.contains(['script','img'], name))
            cdnifyPath(attribs, 'src');
        }

        self.push(buildTag(name, attribs));
      },
      onclosetag: function(name) {
        name = name.toLowerCase();
        debug('close %s', name);

        // Placeholders must be empty tags, i.e. <div data-placeholder="name"></div>. So the first close tag
        // encountered when inPlaceholder is true terminates the placeholder.
        if (inPlaceholder) {
          debug('close placeholder');
          inPlaceholder = false;
          return;
        }

        if (tagMatchContext) {
          // var omitContents = tagMatchContext.omitContents;
          if (name === tagMatchContext.name) {
            tagMatchContext.stack--;
            debug("decrement stack for tag context %s", JSON.stringify(tagMatchContext));
            if (tagMatchContext.stack === 0) {
              debug("end of tag %s match context", tagMatchContext.name);
              tagMatchContext = null;
              return;
            }
          } 
          if (tagMatchContext.omitContents === true)
            return;
        }

        // Don't close singleton tags
        if (_.contains(singletonTags, name))
          return;

        // Special blocks appended to the head
        if (name === 'head') {
          if (options.inject.head) {
            self.push(options.inject.head);
          }
        }

        // Append the livereload script at the end of the body.
        if (name === 'body') {
          if (options.inject.body)
            self.push(options.inject.body);
          if (options.livereload === true)
            self.push('<script src="//localhost:' + options.livereloadPort + '/livereload.js"></script>');
        }

        self.push("</" + name + ">");
      },
      ontext: function(text) {
        if (tagMatchContext && tagMatchContext.omitContents === true)
          return;

        self.push(text);
      },
      onend: function() {
        callback();
      }
    });

    parser.write(chunk);
    parser.end();
  });

  function getCustomAttr(attribs, name) {
    var attrName = 'data-' + (options.attrPrefix ? (options.attrPrefix + '-') : '') + name;
    return attribs[attrName];
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
    tag += " " + key + "=\"" + attribs[key] + "\"";
  }
  tag += ">";
  return tag;
}
var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('4front:html-preprocessor');
var Parser = require('htmlparser2').Parser;

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col', 
  'command', 'embed', 'hr', 'img', 'input']

var absoluteUrlRe = /^(\/\/|http[s]?):\/\//i

exports = module.exports = function(options) {
  options = _.defaults(options, {
    attrPrefix: '4f',
    buildType: 'debug',
    livereload: false,      // Should livereload script be injected
    livereloadPort: 35729,  // Port that livereload to listen on
    headScriptBlocks: [],   // Script blocks that should be appended to the <head>
    headCssBlocks: []       // Inline CSS blocks that should be injected into the head
  });

  if (options.cdnify && !options.cdnHost)
    throw new Error("If cdnify option is true, a cdnHost must be specified.");

  return through2(function(chunk, enc, callback) {
    var self = this;
    
    var removingTag = null;
    var removeStack = 0;

    var parser = new Parser({
      onopentag: function(name, attribs) {
        name = name.toLowerCase();

        // If in removeMode, don't write to the output stream.
        if (removingTag) {
          if (name === removingTag) {
            removeStack++;  
            debug("Increment stack for %s block to %s", removingTag, removeStack);
          }
          else
            debug("In remove block, skipping %s tag", name);

          return;
        }

        var buildType = attribs['data-' + options.attrPrefix + '-build'];
        if (_.isUndefined(buildType) === false) {
          if (buildType !== options.buildType) {
            debug("Start removing %s block", name);
            removingTag = name;
            removeStack = 1;
            return;
          }
        }

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

        if (removingTag) {
          if (name === removingTag) {
            removeStack--;
            debug("Decrement remove stack for %s block to %s", removingTag, removeStack);
            if (removeStack === 0) {
              debug("No longer removing %s block", removingTag);
              removingTag = null;
            }
          }  
          return;
        }

        // Don't close singleton tags
        if (_.contains(singletonTags, name))
          return;

        // Special blocks appended to the head
        if (name === 'head') {
          if (options.headCssBlocks.length > 0) {
            debug("injecting head css blocks");
            self.push('<style>');
            options.headCssBlocks.forEach(function(block) {
              self.push(block);
            });
            self.push('</style>');
          }

          if (options.headScriptBlocks.length > 0) {
            debug("injecting head script blocks");
            self.push('<script>');
            options.headScriptBlocks.forEach(function(block) {
              self.push(block);
              if (block[block.length-1] !== ';')
                self.push(';');
            });
            self.push("</script>");
          }
        }

        // Append the livereload script at the end of the body.
        if (name === 'body' && options.livereload === true) {
          debug("injecting livereload script");
          self.push('<script src="//localhost:' + options.livereloadPort + '/livereload.js"></script>');
        }

        self.push("</" + name + ">");
      },
      ontext: function(text) {
        self.push(text);
      },
      onend: function() {
        callback();
      }
    });

    parser.write(chunk);
    parser.end();
  });

  function cdnifyPath(attribs, pathAttr) {
    // If the path is already absolute, leave it as-is.
    if (absoluteUrlRe.test(attribs[pathAttr]))
      return;

    attribs[pathAttr] = '//' + options.cdnHost + (attribs[pathAttr][0] === '/' ? '' : '/') + attribs[pathAttr];
  }
};

function getCustomAttribute(attribs) {
  for (key in attribs) {
    var attrSplit = key.split('-');
    if (attrSplit.length === 3 && attrSplit[0] === 'data' && attrSplit[1] === options.attrPrefix)
      return attrSplit[2];
  }
  return null;
}

function buildTag(name, attribs) {
  var tag = "<" + name;
  for (var key in attribs) {
    tag += " " + key + "=\"" + attribs[key] + "\"";
  }
  tag += ">";
  return tag;
}
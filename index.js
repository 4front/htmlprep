var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('html-preprocessor');
var Parser = require('htmlparser2').Parser;

var singletonTags = ['link', 'meta', 'param', 'source', 'area', 'base', 'br', 'col', 
  'command', 'embed', 'hr', 'img', 'input']

var customAttrActions = {
  build: function(attribValue, stream, options) {
    if (attribValue !== options.buildType)
      return { remove: true };
    else return {};
  }
};

exports = module.exports = function(options) {
  options = _.defaults(options, {
    attrPrefix: '4f',
    buildType: 'debug'
  });

  return through2(function(chunk, enc, callback) {
    var self = this;
    
    var removingTag = null;
    var removeStack = 0;

    function excludeTag() {

    }

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
        
        for (key in attribs) {
          var attrSplit = key.split('-');
          if (attrSplit.length === 3 && attrSplit[0] === 'data' && attrSplit[1] === options.attrPrefix) {
            var customAction = customAttrActions[attrSplit[2]];
            if (customAction) {
              var action = customAction(attribs[key], self, options);
              if (action.remove === true) {
                debug("Start removing %s block", name);
                removingTag = name;
                removeStack = 1;
                return;
              }
            }
          }
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
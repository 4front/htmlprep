var through2 = require('through2');
var _ = require('lodash');
var debug = require('debug')('htmlprep');
var Parser = require('./lib/parser');

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

  // if (!_.isEmpty(options.variations)) {
  //   // Load the variations into a map

  // }

  var parser;
  return through2(function(chunk, enc, callback) {
    if (!parser)
      parser = new Parser(options, this);

    debug('received chunk %s', chunk);
    parser.write(chunk);
    callback();
  }, function(callback) {
    if (!parser)
      return callback();
    
    parser.on('end', function() {
      debug('parser ended');
      callback();
    });
    parser.end();
  });
};

function VariationBuffer() {
  this._str = '';
};

VariationBuffer.prototype.push = function(str) {
  this._str += str;
}

VariationBuffer.prototype.toString = function() {
  return this._str;
}
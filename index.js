var through2 = require('through2');
var defaults = require('lodash.defaults');
var endsWith = require('lodash.endswith');
var trimEnd = require('lodash.trimend');
var isString = require('lodash.isstring');
var StringDecoder = require('string_decoder').StringDecoder;
var debug = require('debug')('htmlprep');
var Parser = require('./lib/parser');

exports = module.exports = function(options) {
  options = defaults(options, {
    attrPrefix: null,
    buildType: 'debug',
    liveReload: false, // Should livereload script be injected
    liveReloadPort: 35729, // Port that livereload to listen on
    inject: {}, // Blocks of HTML to be injected
    variation: null, // The name of the variation to render. Omit for default content.
    contentVariations: null, // File with the content variations
    assetPathPrefix: null,
    cwd: process.cwd,
    fingerprintQuery: '__fp' // Name of the fingerprint query parameter
  });

  // Ensure both the baseUrl and baseUrlPlaceholder do not have trailing slashes
  ['baseUrl', 'baseUrlPlaceholder'].forEach(function(prop) {
    if (isString(options[prop]) && endsWith(options[prop], '/')) {
      options[prop] = trimEnd(options[prop], '/');
    }
  });

  // if (!_.isEmpty(options.variations)) {
  //   // Load the variations into a map

  // }

  var decoder = new StringDecoder('utf8');
  var parser;
  return through2(function(chunk, enc, callback) {
    if (!parser) {
      this.emit('start');
      parser = new Parser(options, this);
    }

    debug('received chunk %s', chunk);

    // Use the StringDecoder which will buffer up any multi-byte characters that
    // get split up.
    parser.write(decoder.write(chunk));
    callback();
  }, function(callback) {
    if (!parser) return callback();

    // Do one last purge of the StringDecoder buffer in case there's anything left.
    // parser.write(decoder.end());

    parser.on('end', function() {
      debug('parser ended');
      callback();
    });
    parser.end();
  });
};

function VariationBuffer() {
  this._str = '';
}

VariationBuffer.prototype.push = function(str) {
  this._str += str;
};

VariationBuffer.prototype.toString = function() {
  return this._str;
};

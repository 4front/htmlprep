var assert = require('assert');
var htmlPreprocessor = require('..');
var stream = require('stream');
var _ = require('lodash');

describe('htmlPreprocessor()', function() {
  it('pipes html', function(done) {
    var html = '<html tag="5"><body></body></html>';
    runProcessor(html, function(err, output) {
      if (err) return done(err);
      assert.equal(output, html);
      done();
    });
  });

  it('handles non closing tags', function(done) {
    var html = '<html><head><link rel="stylesheet" href="css/styles.css"></head></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);
      assert.equal(output, html);
      done();
    });
  });

  it('removes blocks with different buildType', function(done) {
    var html = ['<html>',
      '<div data-4f-build="debug">',
        '<div></div>',
        '<script src="debug.js"></script>',
      '</div>',
      '<div data-4f-build="release">',
        '<script src="release.js"></script>',
      '</div>',
      '</html>'];

    runProcessor(html.join('\n'), {buildType:'release'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output.replace(/\n/g, ''), html.slice(0, 1).concat(html.slice(5)).join(''));
      done();
    });
  });
});

function runProcessor(html, options, callback) {
  if (_.isFunction(options)) {
    callback = options;
    options = {};
  }

  var output = '';
  readStream(html).pipe(htmlPreprocessor(options))
    .on('data', function(chunk) {
      output += chunk.toString();
    })
    .on('error', function(err) {
      return callback(err);
    })
    .on('end', function() {
      callback(null, output);
    });
}

function readStream(str) {
  var Readable = stream.Readable;
  var rs = Readable();
  rs._read = function () {
    rs.push(str);
    rs.push(null);
  };
  return rs;
}
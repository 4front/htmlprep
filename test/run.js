var isFunction = require('lodash.isfunction');
var htmlprep = require('../');
var stream = require('stream');

module.exports = function(html, options, callback) {
  if (isFunction(options)) {
    callback = options;
    options = {};
  }

  var output = '';
  readStream(html).pipe(htmlprep(options))
    .on('data', function(chunk) {
      output += chunk.toString();
    })
    .on('error', function(err) {
      return callback(err);
    })
    .on('end', function() {
      callback(null, output);
    });
};

function readStream(str) {
  var rs = stream.Readable();
  rs._read = function() {
    rs.push(str);
    rs.push(null);
  };
  return rs;
}

var endsWith = require('lodash.endswith');

module.exports = function(options) {
  debugger;
  var cssModifier = require('./css-modifier')(options);

  var baseUrlRegex;
  if (options.baseUrlPlaceholder) {
    baseUrlRegex = new RegExp(options.baseUrlPlaceholder + '\/*', 'ig');
  }

  return function(tagName, contents) {
    var output;

    // If this is a style tag, rewrite any inline asset urls like background-images.
    if (tagName === 'style') {
      output = cssModifier(contents);
    } else if (baseUrlRegex) {
      // Replace the baseUrlPlaceholder
      output = contents.replace(baseUrlRegex, function(match) {
        if (endsWith(match, '/')) {
          return options.baseUrl + '/';
        }
        return options.baseUrl;
      });
    } else {
      output = contents;
    }

    return output;
  };
};

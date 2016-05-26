var trim = require('lodash.trim');
var rewriteAssetPath = require('./rewrite-asset-path');

var inlineCssUrlRe = /url\(["']?(.*?)["']?\)/g;

module.exports = function(options) {
  return function(cssContent) {
    // If this is a style tag, rewrite any inline asset urls like background-images.
    return cssContent.replace(inlineCssUrlRe, function(match) {
      var assetPath = trim(match.slice(4, -1), '"\'');
      return 'url(' + rewriteAssetPath(assetPath, options) + ')';
    });
  };
};

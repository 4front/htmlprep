var path = require('path');
var startsWith = require('lodash.startswith');
var isEmpty = require('lodash.isempty');
var minimatch = require('minimatch');
var urlUtils = require('./url-utils');

var absoluteUrlRe = /^http[s]?:\/\//i;

module.exports = function(assetPath, options) {
  // If this is an embedded image, leave it.
  if (assetPath.slice(0, 5) === 'data:') return assetPath;

  // Check for an absolute URL
  if (absoluteUrlRe.test(assetPath)) {
    // If the absolute URL starts with the baseUrlPlaceholder, then strip out the BaseURL
    if (!isEmpty(options.baseUrlPlaceholder) && startsWith(assetPath, options.baseUrlPlaceholder)) {
      assetPath = assetPath.slice(options.baseUrlPlaceholder.length);
      if (assetPath.substr(0, 2) === '//') {
        assetPath = assetPath.substr(1);
      } else if (assetPath[0] !== '/') {
        assetPath = '/' + assetPath;
      }
    } else {
      return assetPath;
    }
  }

  assetPath = urlUtils.stripExtraLeadingSlash(assetPath);
  if (assetPath.substr(0, 2) === '//') return assetPath;

  var assetPathFromRoot;
  if (assetPath[0] === '/') {
    assetPathFromRoot = assetPath;
  } else {
    assetPathFromRoot = path.join(options.pathFromRoot, assetPath);
  }

  // Ensure assetPathFromRoot starts with a leading slash
  if (assetPathFromRoot[0] !== '/') assetPathFromRoot = '/' + assetPathFromRoot;

  // Don't prepend the asset path to any path that matches
  // one of the noAssetPathPrefixes patterns.
  for (var i = 0; i < options.noPathPrefixPatterns.length; i++) {
    if (minimatch(assetPathFromRoot, options.noPathPrefixPatterns[i])) {
      return assetPath;
    }
  }

  return urlUtils.slashJoin(options.assetPathPrefix, assetPathFromRoot);
};

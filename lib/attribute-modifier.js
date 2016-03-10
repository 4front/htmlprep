var _ = require('lodash');

var absoluteUrlRe = /^http[s]?:\/\//i;
var validSrcAttributeTags = ['iframe', 'img', 'script', 'audio', 'video', 'embed', 'input'];

module.exports = function(options) {
  var customAttribute = require('./custom-attribute')(options.attrPrefix);

  return function(tagName, attribs) {
    // Strip off any extra leading slashes from anchor tags
    if (tagName === 'a' && attribs.href) {
      attribs.href = stripExtraLeadingSlash(attribs.href);
      return;
    }

    var srcAttr;
    if (attribs.src) {
      srcAttr = 'src';
    } else if (tagName === 'link' && attribs.href) {
      srcAttr = 'href';
    } else {
      return;
    }

    // If the tagName is not a standard src attribute tag, leave it alone.
    // For example angular2 does this: <ng-include src="\'header.html\'"></ng-include>
    if (srcAttr === 'src' && !_.contains(validSrcAttributeTags, tagName)) {
      return;
    }

    var attrValue = attribs[srcAttr];

    // If the attribute is empty, nothing to do.
    if (_.isEmpty(attrValue)) return;

    // If this is an embedded image, leave it.
    if (attrValue.slice(0, 5) === 'data:') return;

    // If the assetPathPrefix option is specified and there is not a data-src-keep
    // attribute, then prepend the assetPathPrefix. This is generally to repoint
    // static assets to an absolute CDN url.
    if (options.assetPathPrefix && !_.has(attribs, customAttribute('src-keep'))) {
      attrValue = prependAssetPath(attrValue);
    }

    // If the fingerprint option is specified and the data-fingerprint custom attribute
    // is declared on the tag, then append the fingerprint to the assetPath
    var fingerprintAttr = customAttribute('fingerprint');
    if (options.fingerprint && _.has(attribs, fingerprintAttr)) {
      attrValue += (attrValue.indexOf('?') === -1 ? '?' : '&');
      attrValue += options.fingerprintQuery + '=' + options.fingerprint;
      attribs[fingerprintAttr] = null;
    }

    attribs[srcAttr] = attrValue;
  };

  function prependAssetPath(assetPath) {
    // If the path is already absolute, leave it as-is.
    if (absoluteUrlRe.test(assetPath)) return assetPath;

    assetPath = stripExtraLeadingSlash(assetPath);
    if (assetPath.substr(0, 2) === '//') return assetPath;

    if (assetPath[0] !== '/' && !_.isEmpty(options.pathFromRoot)) {
      return slashJoin(options.assetPathPrefix, options.pathFromRoot, assetPath);
    }
    return slashJoin(options.assetPathPrefix, assetPath);
  }

  function slashJoin() {
    var items = _.toArray(arguments);
    for (var i = 0; i < items.length; i++) {
      if (i > 0 && items[i][0] === '/') {
        items[i] = items[i].slice(1);
      }
      // If not the last item and the rightmost character is a slash
      if (i < items.length - 1 && items[i].slice(-1) === '/') {
        items[i] = items[i].slice(0, -1);
      }
    }

    return items.join('/');
  }

  function stripExtraLeadingSlash(pathAttr) {
    // If there is a leading double slash, detect if this is a valid
    // non-protocol path like //fonts.google.com/ or a rogue double-slash like
    // //oops/image.jpg. If there is no '.' between the leading double slash
    // and the next slash, then strip off the first slash.
    if (pathAttr.substr(0, 2) !== '//') return pathAttr;
    if (pathAttr.slice(2, pathAttr.indexOf('/', 3)).indexOf('.') !== -1) return pathAttr;
    return pathAttr.substr(1);
  }
};

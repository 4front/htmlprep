var defaults = require('lodash.defaults');
var trimStart = require('lodash.trimstart');
var trimEnd = require('lodash.trimend');
var includes = require('lodash.includes');
var isEmpty = require('lodash.isempty');
var isString = require('lodash.isstring');
var toArray = require('lodash.toarray');
var has = require('lodash.has');
var path = require('path');
var minimatch = require('minimatch');

var absoluteUrlRe = /^http[s]?:\/\//i;
var validSrcAttributeTags = ['iframe', 'img', 'script', 'audio', 'video', 'embed', 'input'];
var linkRelAttributeUrlValues = ['alternate', 'help', 'license', 'next', 'prev', 'search'];
var inlineCssUrlRe = /url\(["']?(.*?)["']?\)/;

module.exports = function(options) {
  defaults(options, {
    noPathPrefixPatterns: []
  });

  if (isEmpty(options.pathFromRoot)) options.pathFromRoot = '/';

  var customAttribute = require('./custom-attribute')(options.attrPrefix);

  return function(tagName, attribs) {
    // Strip off any extra leading slashes from anchor tags
    if (isHrefHyperlink(tagName, attribs)) {
      attribs.href = updateHrefAttribute(attribs.href);
    }

    if (tagName === 'meta') {
      attribs.content = replaceBaseUrlPlaceholder(attribs.content);
    }

    if (attribs.onclick) {
      attribs.onclick = replaceBaseUrlPlaceholder(attribs.onclick);
    }

    if (attribs.style) {
      attribs.style = updateInlineCssUrls(attribs.style);
    }

    var srcAttr;
    if (attribs.src) {
      srcAttr = 'src';
    } else if (isResourceLink(tagName, attribs)) {
      srcAttr = 'href';
    } else {
      return;
    }

    // If the tagName is not a standard src attribute tag, leave it alone.
    // For example angular2 does this: <ng-include src="\'header.html\'"></ng-include>
    if (srcAttr === 'src' && !includes(validSrcAttributeTags, tagName)) {
      return;
    }

    var attrValue = attribs[srcAttr];

    // If the attribute is empty, nothing to do.
    if (isEmpty(attrValue)) return;

    // If the assetPathPrefix option is specified and there is not a data-src-keep
    // attribute, then prepend the assetPathPrefix. This is generally to repoint
    // static assets to an absolute CDN url.
    if (options.assetPathPrefix && !has(attribs, customAttribute('src-keep'))) {
      attrValue = prependAssetPath(attrValue);
    }

    // If the fingerprint option is specified and the data-fingerprint custom attribute
    // is declared on the tag, then append the fingerprint to the assetPath
    var fingerprintAttr = customAttribute('fingerprint');
    if (options.fingerprint && has(attribs, fingerprintAttr)) {
      attrValue += (attrValue.indexOf('?') === -1 ? '?' : '&');
      attrValue += options.fingerprintQuery + '=' + options.fingerprint;
      attribs[fingerprintAttr] = null;
    }

    attribs[srcAttr] = attrValue;
  };

  function prependAssetPath(assetPath) {
    // If this is an embedded image, leave it.
    if (assetPath.slice(0, 5) === 'data:') return assetPath;

    // Check for an absolute URL
    if (absoluteUrlRe.test(assetPath)) {
      // If the absolute URL starts with the baseUrlPlaceholder, then strip out the BaseURL
      if (usesBaseUrlPlaceholder(assetPath)) {
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

    assetPath = stripExtraLeadingSlash(assetPath);
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

    return slashJoin(options.assetPathPrefix, assetPathFromRoot);
  }

  function updateInlineCssUrls(styleAttr) {
    var match = styleAttr.match(inlineCssUrlRe);
    if (match && match.length > 1) {
      var updatedUrl = prependAssetPath(match[1]);

      return styleAttr.replace(match[1], updatedUrl);
    }
    return styleAttr;
  }

  function updateHrefAttribute(href) {
    var updated;
    if (options.baseUrl && usesBaseUrlPlaceholder(href)) {
      updated = slashJoin(options.baseUrl, href.slice(options.baseUrlPlaceholder.length));
    } else {
      updated = stripExtraLeadingSlash(href);
    }

    if (options.baseUrlPlaceholder && options.baseUrl) {
      var queryIndex = updated.indexOf('?');
      if (queryIndex !== -1) {
        var query = updated.slice(queryIndex);

        // Replace both the urlencoded and non-urlencoded baseUrl placeholders
        // Need to lowercase the urlencoded comparison because it could be all upper or lower.
        query = query.replace(encodeURIComponent(options.baseUrlPlaceholder).toLowerCase(),
          encodeURIComponent(options.baseUrl).toLowerCase());
        query = query.replace(options.baseUrlPlaceholder, options.baseUrl);

        updated = updated.substr(0, queryIndex) + query;
      }
    }

    return updated;
  }

  function replaceBaseUrlPlaceholder(attr) {
    if (!isString(attr) || !options.baseUrlPlaceholder || !options.baseUrl) return attr;
    return attr.replace(options.baseUrlPlaceholder, options.baseUrl);
  }

  function usesBaseUrlPlaceholder(urlPath) {
    if (!options.baseUrlPlaceholder) return false;
    return urlPath.substr(0, options.baseUrlPlaceholder.length) === options.baseUrlPlaceholder;
  }

  function slashJoin() {
    var items = toArray(arguments);
    for (var i = 0; i < items.length; i++) {
      // Trim off any leading slashes
      if (i > 0) {
        items[i] = trimStart(items[i], '/');
      }

      // If not the last item and the rightmost character is a slash
      if (i < items.length - 1) {
        items[i] = trimEnd(items[i], '/');
      }
    }

    return items.join('/');
  }

  function isResourceLink(tagName, attribs) {
    if (tagName !== 'link' || !attribs.href) return false;
    if (!includes(linkRelAttributeUrlValues, attribs.rel)) return true;
    return false;
  }

  // Determine if this tag has an href attribute that is a hyperlink to another URL.
  function isHrefHyperlink(tagName, attribs) {
    if (tagName === 'a' && attribs.href) return true;
    if (tagName === 'link' && includes(linkRelAttributeUrlValues, attribs.rel)) return true;
    return false;
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

var defaults = require('lodash.defaults');
var startsWith = require('lodash.startswith');
var includes = require('lodash.includes');
var isEmpty = require('lodash.isempty');
var isString = require('lodash.isstring');
var has = require('lodash.has');
var rewriteAssetPath = require('./rewrite-asset-path');
var urlUtils = require('./url-utils');

var validSrcAttributeTags = ['iframe', 'img', 'script', 'audio',
  'video', 'embed', 'input', 'amp-img', 'amp-video', 'amp-audio', 'amp-iframe'];
var linkRelAttributeUrlValues = ['alternate', 'help', 'license', 'next', 'prev', 'search'];

module.exports = function(options) {
  defaults(options, {
    noPathPrefixPatterns: [],
    baseUrlPlaceholder: ''
  });

  if (isEmpty(options.pathFromRoot)) options.pathFromRoot = '/';

  var customAttribute = require('./custom-attribute')(options.attrPrefix);
  var cssModifier = require('./css-modifier')(options);

  return function(tagName, attribs) {
    // Strip off any extra leading slashes from anchor tags
    if (isHrefHyperlink(tagName, attribs)) {
      attribs.href = updateHrefAttribute(attribs.href);
    }

    if (tagName === 'meta' && attribs.content) {
      attribs.content = replaceBaseUrlPlaceholder(attribs.content);
    }

    if (attribs.onclick) {
      attribs.onclick = replaceBaseUrlPlaceholder(attribs.onclick);
    }

    if (attribs.style) {
      attribs.style = cssModifier(attribs.style);
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
      attrValue = rewriteAssetPath(attrValue, options);
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

  // function updateInlineCssUrls(styleAttr) {
  //   var match = styleAttr.match(inlineCssUrlRe);
  //   if (match && match.length > 1) {
  //     var updatedUrl = rewriteAssetPath(match[1], options);
  //
  //     return styleAttr.replace(match[1], updatedUrl);
  //   }
  //   return styleAttr;
  // }

  function updateHrefAttribute(href) {
    var updated;
    if (options.baseUrl && startsWith(href, options.baseUrlPlaceholder)) {
      updated = urlUtils.slashJoin(options.baseUrl, href.slice(options.baseUrlPlaceholder.length));
    } else {
      updated = urlUtils.stripExtraLeadingSlash(href);
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
};

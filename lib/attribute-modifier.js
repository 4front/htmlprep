var defaults = require('lodash.defaults');
var startsWith = require('lodash.startswith');
var endsWith = require('lodash.endswith');
var includes = require('lodash.includes');
var isEmpty = require('lodash.isempty');
var isString = require('lodash.isstring');
var forEach = require('lodash.foreach');
var has = require('lodash.has');
var mapValues = require('lodash.mapvalues');
var querystring = require('querystring');
var rewriteAssetPath = require('./rewrite-asset-path');
var urlUtils = require('./url-utils');

var validSrcAttributeTags = ['iframe', 'img', 'script', 'audio',
  'video', 'embed', 'input', 'amp-img', 'amp-video', 'amp-audio', 'amp-iframe'];
var linkRelAttributeUrlValues = ['alternate', 'help', 'license', 'next', 'prev', 'search'];

module.exports = function(options) {
  defaults(options, {
    noPathPrefixPatterns: [],
    baseUrlPlaceholder: '',
    baseUrlRegex: new RegExp(options.baseUrlPlaceholder + '/*', 'ig')
  });

  // Ensure that baseUrl ends with a '/'
  if (options.baseUrl && !endsWith(options.baseUrl, '/')) {
    options.baseUrl += '/';
  }

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

    // Do baseUrl replacement on onclick and any data- attribute values
    forEach(attribs, function(value, key) {
      if (key === 'onclick' || startsWith(key, 'data-')) {
        attribs[key] = replaceBaseUrlPlaceholder(value);
      }
    });

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
        var query = querystring.parse(updated.substr(queryIndex + 1));

        // Replace both the urlencoded and non-urlencoded baseUrl placeholders
        // Need to lowercase the urlencoded comparison because it could be all upper or lower.
        // query = query.replace(encodeURIComponent(options.baseUrlPlaceholder).toLowerCase(),
        //   encodeURIComponent(options.baseUrl).toLowerCase());
        // var querquerystring.parse(query);
        query = mapValues(query, function(value) {
          return replaceBaseUrlPlaceholder(value);
        });

        updated = updated.substr(0, queryIndex) + '?' + querystring.stringify(query);
      }
    }

    return updated;
  }

  function replaceBaseUrlPlaceholder(value) {
    if (!isString(value) || !options.baseUrlPlaceholder || !options.baseUrl) return value;

    // Ensures there are no double slashes
    return value.replace(options.baseUrlRegex, options.baseUrl);
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

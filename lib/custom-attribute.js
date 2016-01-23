
// Map each custom attribute to the full actual attribute name with the data- prefix followed
// by an optional custom prefix, i.e. data-custom-build
module.exports = function(attrPrefix) {
  return function(attrName) {
    return 'data-' + (attrPrefix ? (attrPrefix + '-') : '') + attrName;
  };
};

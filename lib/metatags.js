

// The list of metatag names
var metaNames = ["autoresponse"];

module.exports = function(options) {
  return function(req, res, next) {
    // Search for meta tags whose name starts with the namespace
    var metaTags = req.$("head > meta[name^='" + options.namespace + "']");


    for (var i=0; i<metaTags; i++) {
      metaTags[i].attr("content");
    }
  }


  var processors = {
    autoresponse: function(content) {
      
    }
  }
};
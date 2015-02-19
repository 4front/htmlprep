var assert = require('assert');
var htmlprep = require('..');
var stream = require('stream');
var _ = require('lodash');
var debug = require('debug');

describe('htmlprep()', function() {
  it('pipes html', function(done) {
    var html = '<html tag="5"><body></body></html>';
    runProcessor(html, function(err, output) {
      if (err) return done(err);
      assert.equal(output, html);
      done();
    });
  });

  it('handles non closing tags', function(done) {
    var html = '<html><head><link rel="stylesheet" href="css/styles.css"></head></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);
      assert.equal(output, html);
      done();
    });
  });

  describe('removes non-matching buildTypes', function() {
    before(function() {
      this.html = [
        '<html>',
          '<div data-build="debug">',
            '<div>debug build</div>',
            '<script src="debug.js"></script>',
          '</div>',
          '<script src="release.js" data-build="release"></script>',
        '</html>'
      ].join('');
    });

    it('release build', function(done) {
      runProcessor(this.html, {buildType:'release'}, function(err, output) {
        if (err) return done(err);

        assert.equal(output, '<html><script src="release.js"></script></html>');
        done();
      });      
    });

    it('debug build', function(done) {
      runProcessor(this.html, {buildType:'debug'}, function(err, output) {
        if (err) return done(err);

        assert.equal(output, '<html><div><div>debug build</div><script src="debug.js"></script></div></html>');
        done();
      });      
    });
  });

  it('removes self-closing tags with build attribute', function(done) {
    var html = '<html><img src="debug.jpg" data-build="debug"><img src="release.jpg" data-build="release"></html>';
    var options = {
      buildType: 'release'
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><img src="release.jpg"></html>');
      done();
    });
  });

  it('works with custom attribute prefix', function(done) {
    var html = '<html><div data-4f-build="debug">debug</div><div data-4f-build="release">release</div></html>';
    var options = {
      attrPrefix: '4f',
      buildType: 'release'
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><div>release</div></html>');
      done();
    });
  });

  it('injects into placeholder within a build block', function(done) {
    var html = '<html><div data-build="debug"><div data-placeholder="block1"></div></div></html>';
    var options = {
      buildType: 'debug',
      inject: {
        block1: 'debug'
      }
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><div><div>debug</div></div></html>');
      done();
    });
  });

  it('injects head blocks', function(done) {
    var html = '<html><head><title>title</title></head></html>';
    var script = '<script>window.alert("message");</script>';

    var options = {
      inject: {
        head: script
      }
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><title>title</title><script>window.alert("message");</script></head></html>');
      done();
    });
  });

  it('injects body blocks', function(done) {
    var html = '<html><body><h1>title</h1></body></html>';
    var options = {
      inject: {
        body: '<!-- end body -->'
      }
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><h1>title</h1><!-- end body --></body></html>');
      done();
    });
  });

  it('injects custom named blocks', function(done) {
    var html = '<html><body><div data-placeholder="block-1"></div><hr><div data-placeholder="block-2"></div></body></html>';
    var options = {
      inject: {
        'block-1': '<!-- block1 -->',
        'block-2': '<!-- block2 -->'
      }
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><div><!-- block1 --></div><hr><div><!-- block2 --></div></body></html>');
      done();
    });
  });

  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><head><title>title</title><link rel="stylesheet" href="css/styles.css"></head></html>';

    runProcessor(html, {assetPathPrefix: '//cdnhost/abcd'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><title>title</title><link rel="stylesheet" href="//cdnhost/abcd/css/styles.css"></head></html>');
      done();
    });
  });

  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><body><script src="js/app.js"></script><img src="images/logo.jpg"></html>';

    runProcessor(html, {assetPathPrefix: '//cdnhost/abc'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><script src="//cdnhost/abc/js/app.js"></script><img src="//cdnhost/abc/images/logo.jpg"></body></html>');
      done();
    });
  });

  it('performs attribute processing on tags with build attribute', function(done) {
    // var html = '<html><link rel="stylesheet" data-build="debug" href="css/styles.css"></html>';
    var html = '<head>' +
      '<link data-build="release" rel="stylesheet" href="css/components.min.css">' +
      '<link data-build="release" rel="stylesheet" href="css/app.min.css">' +  
      '<link data-build="debug" rel="stylesheet" href="bower_components/bootstrap.css">' +
      '<link data-build="debug" rel="stylesheet" href="tmp/styles.css"></head>';
  
    var options = {
      assetPathPrefix: '//cdn.com',
      buildType: 'debug'
    };

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      // assert.equal(output, '<html><link rel="stylesheet" href="//cdn.com/css/styles.css"></html>');

      assert.equal(output, '<head><link rel="stylesheet" href="//cdn.com/bower_components/bootstrap.css"><link rel="stylesheet" href="//cdn.com/tmp/styles.css"></head>');
      done();
    });
  });

  it('injects livereload script', function(done) {
    var html = '<html><body><h1>title</h1></body></html>';

    runProcessor(html, {liveReload: true}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><h1>title</h1><script src="//localhost:35729/livereload.js"></script></body></html>');
      done();
    });
  });

  it('add lowercases rel=stylesheet', function(done) {
    var html = '<html><head><link rel="Stylesheet" href="app.css"></head></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><link rel="stylesheet" href="app.css"></head></html>');
      done();
    });
  });

  it('handles processing instruction', function(done) {
    var html = '<!DOCTYPE html><html></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not prefix the asset path to // leading urls', function(done) {
    var html = '<html><script src="//maxcdn.com/script.js"></script></html>';

    runProcessor(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves empty attributes', function(done) {
    var html = '<html><div ng-show></div></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });
});

function runProcessor(html, options, callback) {
  if (_.isFunction(options)) {
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
}

function readStream(str) {
  var Readable = stream.Readable;
  var rs = Readable();
  rs._read = function () {
    rs.push(str);
    rs.push(null);
  };
  return rs;
}
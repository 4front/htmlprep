/* eslint max-len: 0 */
var assert = require('assert');
var run = require('./run');

describe('htmlprep attributes', function() {
  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><head><title>title</title><link rel="stylesheet" href="css/styles.css"></head></html>';

    run(html, {assetPathPrefix: '//cdnhost/abcd'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><title>title</title><link rel="stylesheet" href="//cdnhost/abcd/css/styles.css"/></head></html>');
      done();
    });
  });

  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><body><script src="js/app.js"></script><img src="images/logo.jpg"></html>';

    run(html, {assetPathPrefix: '//cdnhost/abc'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><script src="//cdnhost/abc/js/app.js"></script><img src="//cdnhost/abc/images/logo.jpg"/></body></html>');
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

    run(html, options, function(err, output) {
      if (err) return done(err);

      // assert.equal(output, '<html><link rel="stylesheet" href="//cdn.com/css/styles.css"></html>');

      assert.equal(output, '<head><link rel="stylesheet" href="//cdn.com/bower_components/bootstrap.css"/><link rel="stylesheet" href="//cdn.com/tmp/styles.css"/></head>');
      done();
    });
  });

  it('preserves empty attributes', function(done) {
    var html = '<html><div ng-show></div></html>';

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not rewrite URLs of images with data-src-keep attribute', function(done) {
    var html = '<html><img src="/media/logo.png" data-src-keep/></html>';

    run(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not prepend path to embedded images', function(done) {
    var html = '<html><img src="data:image/png;base64,VBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAAC"/></html>';

    run(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('script tag with no src attribute', function(done) {
    var html = '<html><script>function() {}</script></html>';

    run(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('strips out tags with data-strip attribute', function(done) {
    var html = '<html><head><script data-strip>var __global={};</script></head></html>';

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head></head></html>');
      done();
    });
  });

  it('appends nested paths to relative paths', function(done) {
    var html = '<html><img src="../images/summer.png"></html>';

    run(html, {assetPathPrefix: '//cdnhost.com/site123/v1', pathFromRoot: 'blog'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><img src="//cdnhost.com/site123/v1/images/summer.png"/></html>');
      done();
    });
  });

  it('appends pathFromRoot to same directory relative paths', function(done) {
    var html = '<html><img src="images/summer.png"></html>';

    run(html, {assetPathPrefix: '//cdnhost.com/site123/v1', pathFromRoot: 'blog'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><img src="//cdnhost.com/site123/v1/blog/images/summer.png"/></html>');
      done();
    });
  });

  it('tacks on fingerprint to src attributes with data-fingerprint', function(done) {
    var html = '<html><img data-fingerprint src="images/summer.png"></html>';

    run(html, {fingerprint: '123'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><img src="images/summer.png?__fp=123"/></html>');
      done();
    });
  });

  it('preserves quotes in attributes', function(done) {
    var html = '<body class="index" data-languages="[\'angular\',\'template\']"></body>';

    run(html, {}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves entity escaped chars in attributes', function(done) {
    var html = '<body data-languages="{&quot;test&quot;:&quot;1&quot;}"></body>';
    run(html, {}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('fixes extraneous leading slash', function(done) {
    var html = '<body><script src="//js/script.js"></script></body>';
    run(html, {assetPathPrefix: '//cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><script src="//cdnhost.com/js/script.js"></script></body>');
      done();
    });
  });

  it('leaves absolute url attributes alone', function(done) {
    var html = '<body><link href="https://fonts.google.com/arial.css" rel="stylesheet"/></body>';
    run(html, {assetPathPrefix: '//cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('leaves valid scheme-less url alone', function(done) {
    var html = '<body><link href="//fonts.google.com/arial.css" rel="stylesheet"/></body>';
    run(html, {assetPathPrefix: '//cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('strips leading slashes from anchor href attributes', function(done) {
    var html = '<body><a href="https://somesite.com">ok</a><a href="//posts/about">about</a></body>';
    run(html, {assetPathPrefix: '//cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><a href="https://somesite.com">ok</a><a href="/posts/about">about</a></body>');
      done();
    });
  });

  it('does not prepend assets paths based on noAssetPathPrefixes', function(done) {
    var html = '<html><div style="background-image:url(/img/bg.jpg)"></div><img src="logo.jpg"/></html>';

    var opts = {
      noPathPrefixPatterns: ['/img/*.jpg'],
      assetPathPrefix: '//cdn.net/'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><div style="background-image:url(/img/bg.jpg)"></div><img src="//cdn.net/logo.jpg"/></html>');
      done();
    });
  });

  it('noAssetPathPrefixes handles non-leading slash', function(done) {
    var html = '<html><img src="img/bg.jpg"/></html>';

    var opts = {
      noPathPrefixPatterns: ['/img/*.jpg'],
      assetPathPrefix: '//cdn.net/'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('noAssetPathPrefixes handles non-leading slash on nested page', function(done) {
    var html = '<html><img src="../img/bg.jpg"/></html>';

    var opts = {
      noPathPrefixPatterns: ['/img/*.jpg'],
      assetPathPrefix: '//cdn.net/',
      pathFromRoot: '/blog'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not append a content attribute to meta tags', function(done) {
    var html = '<html><meta charset="UTF-8"/></html>';

    run(html, {}, function(err, output) {
      if (err) return done(err);

      assert.equal(html, output);
      done();
    });
  });

  it('fixes google amp img and video tags', function(done) {
    var html = '<span><amp-img src="//assets/logo.png"></span><span><amp-video src="//assets/video.mpg"></span>';

    var opts = {
      assetPathPrefix: '//cdn.net/'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      var expected = '<span><amp-img src="//cdn.net/assets/logo.png"></amp-img>' +
        '</span><span><amp-video src="//cdn.net/assets/video.mpg"></amp-video></span>';
      assert.equal(output, expected);
      done();
    });
  });

  it('eliminates redundant forward slashes', function(done) {
    var html = '<a href="//feed.xml">feed</a>';
    run(html, {}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<a href="/feed.xml">feed</a>');
      done();
    });
  });
});

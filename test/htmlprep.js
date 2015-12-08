var assert = require('assert');
var path = require('path');
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
      assert.equal(output, '<html><head><link rel="stylesheet" href="css/styles.css"/></head></html>');
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
      runProcessor(this.html, {buildType: 'release'}, function(err, output) {
        if (err) return done(err);

        assert.equal(output, '<html><script src="release.js"></script></html>');
        done();
      });
    });

    it('debug build', function(done) {
      runProcessor(this.html, {buildType: 'debug'}, function(err, output) {
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

      assert.equal(output, '<html><img src="release.jpg"/></html>');
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

      assert.equal(output, '<html><body><div><!-- block1 --></div><hr/><div><!-- block2 --></div></body></html>');
      done();
    });
  });

  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><head><title>title</title><link rel="stylesheet" href="css/styles.css"></head></html>';

    runProcessor(html, {assetPathPrefix: '//cdnhost/abcd'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><title>title</title><link rel="stylesheet" href="//cdnhost/abcd/css/styles.css"/></head></html>');
      done();
    });
  });

  it('replaces relative css urls with absolute urls', function(done) {
    var html = '<html><body><script src="js/app.js"></script><img src="images/logo.jpg"></html>';

    runProcessor(html, {assetPathPrefix: '//cdnhost/abc'}, function(err, output) {
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

    runProcessor(html, options, function(err, output) {
      if (err) return done(err);

      // assert.equal(output, '<html><link rel="stylesheet" href="//cdn.com/css/styles.css"></html>');

      assert.equal(output, '<head><link rel="stylesheet" href="//cdn.com/bower_components/bootstrap.css"/><link rel="stylesheet" href="//cdn.com/tmp/styles.css"/></head>');
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

      assert.equal(output, '<html><head><link rel="stylesheet" href="app.css"/></head></html>');
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

  describe('expands glob patterns', function() {
    it('expands script globs', function(done) {
      var html = "<html><body><script data-src-expand='js/**/*.js'></script></body></html>";

      runProcessor(html, {cwd: path.resolve(__dirname, './fixtures')}, function(err, output) {
        assert.equal(output, '<html><body><script src="js/app.js"></script>' +
          '<script src="js/controllers/controller1.js"></script>' +
          '<script src="js/controllers/controller2.js"></script>' +
          '</body></html>');

        done();
      });
    });

    it('expands stylesheet globs', function(done) {
      var html = "<html><head><link rel='Stylesheet' type='text/css' data-href-expand='css/**/*.css' /></body></html>";

      runProcessor(html, {cwd: path.resolve(__dirname, './fixtures')}, function(err, output) {
        assert.equal(output, '<html><head>' +
          '<link rel="stylesheet" type="text/css" href="css/styles1.css"/>' +
          '<link rel="stylesheet" type="text/css" href="css/styles2.css"/>' +
          '</head></html>');

        done();
      });
    });
  });

  it('preserves char encoding', function(done) {
    var html = '&quot;&lt;&gt;&amp;';
    // var html = "<pre>{&quot;tiddlers&quot;: 'Acknowledgements'}</pre>";

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves chinese characters', function(done) {
    var html = '<p>我通常使用Socks或者Http代理做为科学上网方案， 但仍然有很多需要全局代理的场景， 例如像Android SDK类似的各种墙外工具的更新， 或者不能使用Socks代理的手机等， 还有的时候我们希望为亲朋好友提供一个科学上网的方案， 只需要账号密码的VPN方式是最佳的选择。 如果你需要你的VPN更加安全稳定， 那我要推荐你使用OpenVPN和ShadowVPN， 他们更加高效和安全。 当然如果你使用个人的VPS做PPTP VPN， 被追踪的可能也很小， 最重要的是如果你需要这个VPN不依赖于客户端随时随地任意设备可用， PPTP VPN最佳选择之一。 阅读以下内容前，您应该拥有一个可访问的VPS(什么是VPS？)。 可选的VPS有很多，热门的有DigitalOcean, Linode, Vultr, Bandwagon(俗称‘搬瓦工’)等等。 我个人推荐Vultr和DigitalOcean，理由是便宜、稳定、SSD、机房多、有日本机房(中国访问快)， 最近维护VPS的时候出现了一些问题， 客服态度非常好， 反应也很迅速， 这个非常重要。 使用以下链接注册可以帮你立省10$， 够用两个月了。 这也是我写这篇文章的动力之一， 这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，你好我好大家好： http://www.vultr.com/?ref ...</p>';
    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not rewrite URLs of images with data-src-keep attribute', function(done) {
    var html = '<html><img src="/media/logo.png" data-src-keep/></html>';

    runProcessor(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not prepend path to embedded images', function(done) {
    var html = '<html><img src="data:image/png;base64,VBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAAC"/></html>';

    runProcessor(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('script tag with no src attribute', function(done) {
    var html = '<html><script>function() {}</script></html>';

    runProcessor(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('strips out tags with data-strip attribute', function(done) {
    var html = '<html><head><script data-strip>var __global={};</script></head></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head></head></html>');
      done();
    });
  });

  it('preserves code formatting in a code tag', function(done) {
    var html = '<html><code><SubmitButton className="button"/><Component><Button/></Component></code></html>';

    runProcessor(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('appends nested paths to relative paths', function(done) {
    var html = '<html><img src="../images/summer.png"></html>';

    runProcessor(html, {assetPathPrefix: '//cdnhost.com/site123/v1', pathFromRoot: 'blog'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><img src="//cdnhost.com/site123/v1/blog/../images/summer.png"/></html>');
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
  var rs = stream.Readable();
  rs._read = function() {
    rs.push(str);
    rs.push(null);
  };
  return rs;
}

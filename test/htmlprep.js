var assert = require('assert');
var path = require('path');
var run = require('./run');
var debug = require('debug');

describe('htmlprep()', function() {
  it('pipes html', function(done) {
    var html = '<html tag="5"><body></body></html>';
    run(html, function(err, output) {
      if (err) return done(err);
      assert.equal(output, html);
      done();
    });
  });

  it('handles non closing tags', function(done) {
    var html = '<html><head><link rel="stylesheet" href="css/styles.css"></head></html>';

    run(html, function(err, output) {
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
      run(this.html, {buildType: 'release'}, function(err, output) {
        if (err) return done(err);

        assert.equal(output, '<html><script src="release.js"></script></html>');
        done();
      });
    });

    it('debug build', function(done) {
      run(this.html, {buildType: 'debug'}, function(err, output) {
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

    run(html, options, function(err, output) {
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

    run(html, options, function(err, output) {
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

    run(html, options, function(err, output) {
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

    run(html, options, function(err, output) {
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

    run(html, options, function(err, output) {
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

    run(html, options, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><div><!-- block1 --></div><hr/><div><!-- block2 --></div></body></html>');
      done();
    });
  });

  it('injects livereload script', function(done) {
    var html = '<html><body><h1>title</h1></body></html>';

    run(html, {liveReload: true}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><body><h1>title</h1><script src="//localhost:35729/livereload.js"></script></body></html>');
      done();
    });
  });

  it('add lowercases rel=stylesheet', function(done) {
    var html = '<html><head><link rel="Stylesheet" href="app.css"></head></html>';

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><head><link rel="stylesheet" href="app.css"/></head></html>');
      done();
    });
  });

  it('handles processing instruction', function(done) {
    var html = '<!DOCTYPE html><html></html>';

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not prefix the asset path to // leading urls', function(done) {
    var html = '<html><script src="//maxcdn.com/script.js"></script></html>';

    run(html, {assetPathPrefix: 'cdnhost.com'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  describe('expands glob patterns', function() {
    it('expands script globs', function(done) {
      var html = "<html><body><script data-src-expand='js/**/*.js'></script></body></html>";

      run(html, {cwd: path.resolve(__dirname, './fixtures')}, function(err, output) {
        assert.equal(output, '<html><body><script src="js/app.js"></script>' +
          '<script src="js/controllers/controller1.js"></script>' +
          '<script src="js/controllers/controller2.js"></script>' +
          '</body></html>');

        done();
      });
    });

    it('expands stylesheet globs', function(done) {
      var html = "<html><head><link rel='Stylesheet' type='text/css' data-href-expand='css/**/*.css' /></body></html>";

      run(html, {cwd: path.resolve(__dirname, './fixtures')}, function(err, output) {
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

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves chinese characters', function(done) {
    var html = '<p>我通常使用Socks或者Http代理做为科学上网方案， 但仍然有很多需要全局代理的场景， 例如像Android SDK类似的各种墙外工具的更新， 或者不能使用Socks代理的手机等， 还有的时候我们希望为亲朋好友提供一个科学上网的方案， 只需要账号密码的VPN方式是最佳的选择。 如果你需要你的VPN更加安全稳定， 那我要推荐你使用OpenVPN和ShadowVPN， 他们更加高效和安全。 当然如果你使用个人的VPS做PPTP VPN， 被追踪的可能也很小， 最重要的是如果你需要这个VPN不依赖于客户端随时随地任意设备可用， PPTP VPN最佳选择之一。 阅读以下内容前，您应该拥有一个可访问的VPS(什么是VPS？)。 可选的VPS有很多，热门的有DigitalOcean, Linode, Vultr, Bandwagon(俗称‘搬瓦工’)等等。 我个人推荐Vultr和DigitalOcean，理由是便宜、稳定、SSD、机房多、有日本机房(中国访问快)， 最近维护VPS的时候出现了一些问题， 客服态度非常好， 反应也很迅速， 这个非常重要。 使用以下链接注册可以帮你立省10$， 够用两个月了。 这也是我写这篇文章的动力之一， 这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，这也是我写这篇文章的动力之一，你好我好大家好： http://www.vultr.com/?ref ...</p>';
    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves code formatting in a code tag', function(done) {
    var html = '<html><code><SubmitButton className="button"/><Component><Button/></Component></code></html>';

    run(html, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('preserves old IE conditional stylesheets', function(done) {
    var html = ['<html><head>',
      '<!--[if IE]>',
	    '<link rel="stylesheet" type="text/css" href="ie-only.css"/>', // eslint-disable-line
      '<![endif]-->',
      '</head></html>'].join('\n');

    run(html, {}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });

  it('does not modify src in non-standard html tags', function(done) {
    var html = '<ng-include src="\'header.html\'"></ng-include>';

    run(html, {assetPathPrefix: '//cdnhost.com/'}, function(err, output) {
      if (err) return done(err);

      assert.equal(output, html);
      done();
    });
  });
});

// function runProcessor(html, options, callback) {
//   if (_.isFunction(options)) {
//     callback = options;
//     options = {};
//   }
//
//   var output = '';
//   readStream(html).pipe(htmlprep(options))
//     .on('data', function(chunk) {
//       output += chunk.toString();
//     })
//     .on('error', function(err) {
//       return callback(err);
//     })
//     .on('end', function() {
//       callback(null, output);
//     });
// }
//
// function readStream(str) {
//   var rs = stream.Readable();
//   rs._read = function() {
//     rs.push(str);
//     rs.push(null);
//   };
//   return rs;
// }

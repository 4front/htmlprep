var assert = require('assert');
var run = require('./run');

describe('baseurl replacement', function() {
  it('updates inline background image urls', function(done) {
    var html = '<body><div style="background-image:url(https://__baseurl__/img/bg.jpg)"></div></body>';
    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://mysite.com',
      assetPathPrefix: '//cdnhost.com'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><div style="background-image:url(//cdnhost.com/img/bg.jpg)"></div></body>');
      done();
    });
  });

  it('updates baseurl embedded in querystrings', function(done) {
    var html = '<body><a href="http://www.twitter.com/share?url=https%3a%2f%2f__baseurl__%2fabout%2f" target="_blank">share</a></body>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://mysite.com'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><a href="http://www.twitter.com/share?url=https%3a%2f%2fmysite.com%2fabout%2f" target="_blank">share</a></body>');
      done();
    });
  });

  it('updates rss link attributes', function(done) {
    var html = '<html><link href="https://__baseurl__/index.xml" rel="alternate" type="application/rss+xml" title="RSS feed"/></html>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://mysite.com'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<html><link href="https://mysite.com/index.xml" rel="alternate" type="application/rss+xml" title="RSS feed"/></html>');
      done();
    });
  });

  it('replaces site base url placeholder with cdn url', function(done) {
    var html = '<body><script src="https://__baseurl__/js/site.js"></script></body>';
    var opts = {
      assetPathPrefix: '//cdnhost.com',
      baseUrlPlaceholder: 'https://__baseurl__'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><script src="//cdnhost.com/js/site.js"></script></body>');
      done();
    });
  });

  it('substitutes base url placeholder with base url', function(done) {
    var html = '<body><a href="https://__baseurl__/post/about">about</a></body>';
    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://mysite.com'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><a href="https://mysite.com/post/about">about</a></body>');
      done();
    });
  });

  it('handles double slash when subsituting base url', function(done) {
    var html = '<body><a href="https://__baseurl__//post/about">about</a></body>';
    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://mysite.com'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<body><a href="https://mysite.com/post/about">about</a></body>');
      done();
    });
  });

  it('trims leading whitespace from attributes', function(done) {
    var html = '<a href=" https://__baseurl__" class="btn btn-default"><i class="fa fa-home"></i> Home</a>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://domain.net'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<a href="https://domain.net/" class="btn btn-default"><i class="fa fa-home"></i> Home</a>');
      done();
    });
  });

  it('it update open graph urls', function(done) {
    var html = '<head><meta property="og:url" content="https://__baseurl__/path"></head>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://domain.net'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<head><meta property="og:url" content="https://domain.net/path"/></head>');
      done();
    });
  });

  it('it update open graph urls', function(done) {
    var html = '<head><meta name="twitter:image" content="https://__baseurl__/assets/logo.png"/></head>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://domain.net'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<head><meta name="twitter:image" content="https://domain.net/assets/logo.png"/></head>');
      done();
    });
  });

  it('updates baseurl in social sharing links', function(done) {
    var html = '<a href="//twitter.com/share?text=share&url=https://__baseurl__/share&via=website">twitter</a>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://domain.net'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      assert.equal(output, '<a href="//twitter.com/share?text=share&url=https://domain.net/share&via=website">twitter</a>');
      done();
    });
  });

  it('updates baseurl in onclick attributes', function(done) {
    var html = '<a href="//www.reddit.com/submit" onclick="window.location=\'//www.reddit.com/submit?url=\'' +
      'encodeURIComponent(\'https://__baseurl__/share\') + \'&title=share\'; return false">reddit</a>';

    var opts = {
      baseUrlPlaceholder: 'https://__baseurl__',
      baseUrl: 'https://domain.net'
    };

    run(html, opts, function(err, output) {
      if (err) return done(err);

      var expected = '<a href="//www.reddit.com/submit" onclick="window.location=\'//www.reddit.com/submit?url=\'' +
        'encodeURIComponent(\'https://domain.net/share\') + \'&title=share\'; return false">reddit</a>';

      assert.equal(expected, output);
      done();
    });
  });
});

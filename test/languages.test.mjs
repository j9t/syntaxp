import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSyntaxp, tokensFor, sameHighlighting } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));
const jsSource = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');

function tokenize(className, text) {
  const { highlightsByType } = runSyntaxp(jsSource, { codeSamples: [{ className, text }] });
  return tokensFor(text, highlightsByType);
}

function assertHasToken(tokens, type, text) {
  assert.ok(
    tokens.some((t) => t.type === type && t.text === text),
    `expected a ${type} token ${JSON.stringify(text)} in ${JSON.stringify(tokens)}`
  );
}

test('html', () => {
  const tokens = tokenize('language-html', '<!-- hi --><p class="a">&amp;</p>');
  assertHasToken(tokens, 'comment', '<!-- hi -->');
  assertHasToken(tokens, 'tag', '<p');
  assertHasToken(tokens, 'attribute', 'class');
  assertHasToken(tokens, 'string', '"a"');
  assertHasToken(tokens, 'entity', '&amp;');
});

test('`xml` is an alias for `html`', () => {
  assert.ok(sameHighlighting(jsSource, '<a href="x">&amp;</a>', 'language-html', 'language-xml'));
});

test('`css`', () => {
  const tokens = tokenize('language-css', '@media (min-width: 1px) { .a { color: #fff; } }');
  assertHasToken(tokens, 'keyword', '@media');
  assertHasToken(tokens, 'selector', '.a');
  assertHasToken(tokens, 'property', 'color');
});

test('`css` excludes leading whitespace from a property', () => {
  const text = '.a {\n  color: red;\n  margin: 0;\n}';
  const properties = tokenize('language-css', text).filter((t) => t.type === 'property');
  assert.deepEqual(properties.map((t) => t.text), ['color', 'margin']);
});

test('`css` does not tag values as selectors', () => {
  const tokens = tokenize('language-css', '.a { color:red; background: #fff url(a.png) }');
  const selectors = tokens.filter((t) => t.type === 'selector').map((t) => t.text);
  assert.deepEqual(selectors, ['.a']);
});

test('`css` tags compound and nested selectors, pseudo-classes included', () => {
  const tokens = tokenize('language-css', 'a:hover, .b:not(.c) { color: red; }\np.e::before { content: none; }\n.d {\n  &:focus { color: blue }\n}');
  for (const selector of [':hover', '.b', ':not', '.c', 'p', '.e', '::before', '.d', ':focus']) {
    assertHasToken(tokens, 'selector', selector);
  }
  assert.ok(!tokens.some((t) => t.type === 'property' && t.text === 'a'), 'tagged `a` in `a:hover` as a property');
});

test('`css` does not tag at-rule conditions as selectors', () => {
  const tokens = tokenize('language-css', '@media (hover:hover) { a { color: red; } }');
  assert.deepEqual(tokens.filter((t) => t.type === 'selector').map((t) => t.text), ['a']);
});

test('`css` tokenizes long inputs in linear time', () => {
  const inputs = [
    Array.from({ length: 20000 }, (_, i) => `.s${i}`).join(', ') + ' { color: red; }',
    'word.Next '.repeat(20000),
    'a' + ':b'.repeat(40) + ' x',
    'a' + '.b'.repeat(20000)
  ];
  for (const text of inputs) {
    const start = performance.now();
    tokenize('language-css', text);
    assert.ok(performance.now() - start < 1000, `took too long for ${JSON.stringify(text.slice(0, 20))}…`);
  }
});

test('`css` tags a percentage, unit included, as a number', () => {
  const tokens = tokenize('language-css', 'a { width: 50%; }');
  assertHasToken(tokens, 'number', '50%');
});

test('`javascript`', () => {
  const tokens = tokenize('language-javascript', 'const x = console.log(1); // c');
  assertHasToken(tokens, 'keyword', 'const');
  assertHasToken(tokens, 'builtin', 'console');
  assertHasToken(tokens, 'function', 'log');
  assertHasToken(tokens, 'comment', '// c');
});

test('`javascript` tags a called builtin as `builtin`, not `function`', () => {
  const tokens = tokenize('language-javascript', 'fetch(url); parseInt(x); f(1);');
  assertHasToken(tokens, 'builtin', 'fetch');
  assertHasToken(tokens, 'builtin', 'parseInt');
  assertHasToken(tokens, 'function', 'f');
});

test('`javascript` and `typescript` tag `=>` as a single operator', () => {
  for (const className of ['language-javascript', 'language-typescript']) {
    assertHasToken(tokenize(className, 'const f = (a) => a;'), 'operator', '=>');
  }
});

test('`js` is an alias for `javascript`', () => {
  assert.ok(sameHighlighting(jsSource, 'const x = 1; // c', 'language-javascript', 'language-js'));
});

test('`typescript`', () => {
  const tokens = tokenize('language-typescript', 'interface X { a: string }');
  assertHasToken(tokens, 'keyword', 'interface');
  assertHasToken(tokens, 'type', 'string');
});

test('`ts` is an alias for `typescript`', () => {
  assert.ok(sameHighlighting(jsSource, 'interface X { a: string }', 'language-typescript', 'language-ts'));
});

test('`shell`', () => {
  const tokens = tokenize('language-shell', 'npm install --save $HOME # c');
  assertHasToken(tokens, 'command', 'npm');
  assertHasToken(tokens, 'flag', '--save');
  assertHasToken(tokens, 'variable', '$HOME');
  assertHasToken(tokens, 'comment', '# c');
});

test('`bash` is an alias for `shell`', () => {
  assert.ok(sameHighlighting(jsSource, 'npm install --save $HOME # c', 'language-shell', 'language-bash'));
});

test('`sh` is an alias for `shell`', () => {
  assert.ok(sameHighlighting(jsSource, 'npm install --save $HOME # c', 'language-shell', 'language-sh'));
});

test('`json`', () => {
  const tokens = tokenize('language-json', '{"a": true, "b": 1}');
  assertHasToken(tokens, 'property', '"a"');
  assertHasToken(tokens, 'keyword', 'true');
  assertHasToken(tokens, 'number', '1');
});

test('`yaml`', () => {
  const tokens = tokenize('language-yaml', "# c\nname: 'x'\nok: true");
  assertHasToken(tokens, 'comment', '# c');
  assertHasToken(tokens, 'property', 'name');
  assertHasToken(tokens, 'string', "'x'");
  assertHasToken(tokens, 'keyword', 'true');
});

test('`yml` is an alias for `yaml`', () => {
  assert.ok(sameHighlighting(jsSource, "name: 'x'\nok: true", 'language-yaml', 'language-yml'));
});

test('`sql`', () => {
  // `COUNT` is deliberately in the keyword list (alongside
  // `SUM`/`AVG`/`MIN`/`MAX`), so it wins over the identically-spanned
  // `function` match by pattern order—`LOWER(…)` exercises a genuine
  // (non-keyword) function call
  const tokens = tokenize('language-sql', 'SELECT COUNT(id), LOWER(name) FROM t WHERE x = 1 -- c');
  assertHasToken(tokens, 'keyword', 'SELECT');
  assertHasToken(tokens, 'keyword', 'COUNT');
  assertHasToken(tokens, 'function', 'LOWER');
  assertHasToken(tokens, 'number', '1');
  assertHasToken(tokens, 'comment', '-- c');
});

test('`php`', () => {
  const tokens = tokenize('language-php', "function f($x) { return $x; } // c");
  assertHasToken(tokens, 'keyword', 'function');
  assertHasToken(tokens, 'variable', '$x');
  assertHasToken(tokens, 'comment', '// c');
});

test('`php` tags `->` and `=>` as single operators', () => {
  const tokens = tokenize('language-php', '$a->b(); $x = [1 => 2];');
  assertHasToken(tokens, 'operator', '->');
  assertHasToken(tokens, 'operator', '=>');
});

test('`python`', () => {
  const tokens = tokenize('language-python', "def f():\n    return fr'a\\d'  # c");
  assertHasToken(tokens, 'keyword', 'def');
  assertHasToken(tokens, 'string', "fr'a\\d'");
  assertHasToken(tokens, 'comment', '# c');
});

test('`python` multi-letter and prefixed triple-quoted string prefixes', () => {
  const tokens = tokenize('language-python', 'x = rf"a"\ny = f"""b"""');
  assertHasToken(tokens, 'string', 'rf"a"');
  assertHasToken(tokens, 'string', 'f"""b"""');
});

test('`python` tags the return annotation arrow `->` as a single operator', () => {
  const tokens = tokenize('language-python', 'def f(a) -> int:\n    return a');
  assertHasToken(tokens, 'operator', '->');
});

test('`py` is an alias for `python`', () => {
  assert.ok(sameHighlighting(jsSource, "def f():\n    return 1", 'language-python', 'language-py'));
});

test('`python` standalone multiplication/division, bitwise, unary tilde, and shift operators', () => {
  const tokens = tokenize(
    'language-python',
    'a * b / c & d | e ^ f\nn = ~x\na << b\na >> b\na <<= 1\na >>= 1\na &= 1\na |= 1\na ^= 1\na *= 1\na /= 1'
  );
  for (const op of ['*', '/', '&', '|', '^', '~', '<<', '>>', '<<=', '>>=', '&=', '|=', '^=', '*=', '/=']) {
    assertHasToken(tokens, 'operator', op);
  }
  // Existing compound/comparison operators must still match as before
  const preserved = tokenize('language-python', 'a == b\na != b\na <= b\na >= b\na ** b\na // b\na += 1');
  for (const op of ['==', '!=', '<=', '>=', '**', '//', '+=']) {
    assertHasToken(preserved, 'operator', op);
  }
});

test('`markdown`', () => {
  const tokens = tokenize('language-markdown', '# Title\n\n**b** and `c` and [t](https://x)');
  assertHasToken(tokens, 'keyword', '# Title');
  assertHasToken(tokens, 'attribute', '**b**');
  assertHasToken(tokens, 'string', '`c`');
  assertHasToken(tokens, 'property', 't');
  assertHasToken(tokens, 'path', 'https://x');
});

test('`markdown` does not tag an ordinary parenthetical aside as a `path`', () => {
  const tokens = tokenize('language-markdown', 'This works well (see below) in practice.');
  assert.ok(
    !tokens.some((t) => t.type === 'path'),
    `ordinary parentheses were mistaken for a path: ${JSON.stringify(tokens)}`
  );
});

test('`markdown` empty link parts do not produce zero-length tokens', () => {
  const text = '[](x.png) and [t]()';
  const { highlightsByType } = runSyntaxp(jsSource, {
    codeSamples: [{ className: 'language-markdown', text }]
  });
  for (const ranges of highlightsByType.values()) {
    for (const range of ranges) {
      assert.notEqual(range.startOffset, range.endOffset);
    }
  }
});

test('`md` is an alias for `markdown`', () => {
  assert.ok(sameHighlighting(jsSource, '# Title\n\n**b**', 'language-markdown', 'language-md'));
});

test('`diff`', () => {
  const tokens = tokenize(
    'language-diff',
    'diff --git a/x b/x\n--- a/x\n+++ b/x\n@@ -1 +1 @@\n+added\n-removed'
  );
  assertHasToken(tokens, 'comment', 'diff --git a/x b/x');
  assertHasToken(tokens, 'keyword', '@@ -1 +1 @@');
  assertHasToken(tokens, 'string', '+added');
  assertHasToken(tokens, 'tag', '-removed');
});

test('`patch` is an alias for `diff`', () => {
  assert.ok(sameHighlighting(jsSource, '+added\n-removed', 'language-diff', 'language-patch'));
});

test('`http` request', () => {
  const tokens = tokenize(
    'language-http',
    'GET /api/users/42 HTTP/1.1\nHost: example.com\nAuthorization: Bearer abc123'
  );
  assertHasToken(tokens, 'keyword', 'GET');
  assertHasToken(tokens, 'path', '/api/users/42');
  assertHasToken(tokens, 'builtin', 'HTTP/1.1');
  assertHasToken(tokens, 'property', 'Host');
  assertHasToken(tokens, 'string', 'example.com');
  assertHasToken(tokens, 'property', 'Authorization');
  assertHasToken(tokens, 'string', 'Bearer abc123');
});

test('`http` response', () => {
  const tokens = tokenize(
    'language-http',
    'HTTP/1.1 200 OK\nContent-Type: application/json'
  );
  assertHasToken(tokens, 'builtin', 'HTTP/1.1');
  assertHasToken(tokens, 'number', '200');
  assertHasToken(tokens, 'string', 'OK');
  assertHasToken(tokens, 'property', 'Content-Type');
  assertHasToken(tokens, 'string', 'application/json');
});

test('`http` standalone header line', () => {
  const tokens = tokenize('language-http', 'Set-Cookie: id=a3fWa; Secure; HttpOnly');
  assertHasToken(tokens, 'property', 'Set-Cookie');
  assertHasToken(tokens, 'string', 'id=a3fWa; Secure; HttpOnly');
});

test('`http` does not mistake a JSON body’s mid-line colon for a header value', () => {
  const tokens = tokenize(
    'language-http',
    'GET /api HTTP/1.1\nHost: example.com\n\n{"id": 42, "name": "Ada"}'
  );
  assertHasToken(tokens, 'string', 'example.com');
  assert.ok(
    !tokens.some((t) => t.type === 'string' && t.text.includes('"name"')),
    `body content leaked into a header-value string token: ${JSON.stringify(tokens)}`
  );
});

test('`nunjucks`', () => {
  const tokens = tokenize(
    'language-nunjucks',
    '{# c #}\n{% if user.age >= 18 %}\n  {{ user.name | upper }}\n{% endif %}'
  );
  assertHasToken(tokens, 'comment', '{# c #}');
  assertHasToken(tokens, 'keyword', '{%');
  assertHasToken(tokens, 'keyword', 'if');
  assertHasToken(tokens, 'operator', '>=');
  assertHasToken(tokens, 'number', '18');
  assertHasToken(tokens, 'keyword', '%}');
  assertHasToken(tokens, 'keyword', '{{');
  assertHasToken(tokens, 'punctuation', '|');
  assertHasToken(tokens, 'function', 'upper');
  assertHasToken(tokens, 'keyword', '}}');
  assertHasToken(tokens, 'keyword', 'endif');
});

test('`nunjucks` assignment `=` is tagged `operator`, distinct from `==`', () => {
  const tokens = tokenize('language-nunjucks', '{% set x = 1 %}\n{% if x == 1 %}{% endif %}');
  assertHasToken(tokens, 'operator', '=');
  assertHasToken(tokens, 'operator', '==');
});

test('`nunjucks` object-literal braces and colon are tagged `punctuation`', () => {
  const tokens = tokenize('language-nunjucks', '{% set data = {"a": 1} %}');
  assertHasToken(tokens, 'punctuation', '{');
  assertHasToken(tokens, 'punctuation', '}');
  assertHasToken(tokens, 'punctuation', ':');
});

test('`nunjucks` macro call is tagged `function` like other languages’ calls', () => {
  const tokens = tokenize('language-nunjucks', '{{ formatPrice(item.price) }}');
  assertHasToken(tokens, 'function', 'formatPrice');
});

test('`njk` is an alias for `nunjucks`', () => {
  assert.ok(sameHighlighting(jsSource, '{% if x %}{{ x }}{% endif %}', 'language-nunjucks', 'language-njk'));
});

test('`apacheconf`', () => {
  const tokens = tokenize(
    'language-apacheconf',
    '# comment\n<IfModule mod_rewrite.c>\nRewriteEngine On\nRewriteCond %{HTTP_HOST} ^www\\.example\\.com [NC]\nRewriteRule ^(.*)$ https://example.com/$1 [L,R=301]\n</IfModule>'
  );
  assertHasToken(tokens, 'comment', '# comment');
  assertHasToken(tokens, 'tag', '<IfModule');
  assertHasToken(tokens, 'tag', '</IfModule');
  assertHasToken(tokens, 'keyword', 'RewriteEngine');
  assertHasToken(tokens, 'variable', '%{HTTP_HOST}');
  assertHasToken(tokens, 'flag', '[NC]');
  assertHasToken(tokens, 'variable', '$1');
  assertHasToken(tokens, 'builtin', 'On');
});

test('`apacheconf` styles whatever directive opens a line, listed or not', () => {
  const tokens = tokenize(
    'language-apacheconf',
    'ExpiresActive On\nExpiresByType text/html A10\n\t<IfModule mod_pagespeed.c>\n\tModPagespeed on\n\t</IfModule>'
  );
  assertHasToken(tokens, 'keyword', 'ExpiresActive');
  assertHasToken(tokens, 'keyword', 'ExpiresByType');
  // Indented, and from a third-party module—still a directive
  assertHasToken(tokens, 'keyword', 'ModPagespeed');
  assertHasToken(tokens, 'builtin', 'on');
  // A section is markup, not a directive
  assert.ok(!tokens.some((t) => t.type === 'keyword' && t.text === 'IfModule'));
});

test('`apacheconf` leaves slashes inside MIME types and paths alone', () => {
  const tokens = tokenize('language-apacheconf', 'AddOutputFilterByType DEFLATE image/svg+xml text/css\nErrorDocument 404 /errors/on.html');
  assert.ok(!tokens.some((t) => t.type === 'punctuation'));
  // `on` only reads as a value in value position, not inside a path
  assert.ok(!tokens.some((t) => t.type === 'builtin'));
});

test('`apacheconf` tags mod_expires periods as numbers, but not digits inside identifiers', () => {
  const tokens = tokenize('language-apacheconf', 'ExpiresByType text/css A129600\nAddCharset utf-8 .css\nErrorDocument 404 /404.html');
  assertHasToken(tokens, 'number', 'A129600');
  assertHasToken(tokens, 'number', '404');
  assert.ok(!tokens.some((t) => t.type === 'number' && t.text === '8'));
  // The `404` of `/404.html` is part of a filename
  assert.equal(tokens.filter((t) => t.type === 'number' && t.text === '404').length, 1);
});
test('Every token type has a `::highlight()` rule and a custom property in both palettes', () => {
  const css = readFileSync(`${dirRoot}/syntaxp.css`, 'utf8');
  const [light, dark] = css.split('@media');
  const types = new Set([...jsSource.matchAll(/\btype: '(\w+)'/g)].map((match) => match[1]));
  for (const type of types) {
    assert.match(css, new RegExp(`::highlight\\(${type}\\)\\s*\\{\\s*color: var\\(--s5p-${type}\\);`), `no rule for ${type}`);
    assert.match(light, new RegExp(`--s5p-${type}:`), `no light color for ${type}`);
    assert.match(dark, new RegExp(`--s5p-${type}:`), `no dark color for ${type}`);
  }
});

test('Every language tokenizes adversarial input in linear time', () => {
  const languages = ['html', 'markdown', 'css', 'javascript', 'typescript', 'python', 'php', 'shell', 'json', 'yaml', 'sql', 'nunjucks', 'diff', 'http', 'apacheconf'];
  for (const unit of ['\n', ' \n', '  ', '[', '](', '{%']) {
    const text = unit.repeat(80000 / unit.length);
    for (const language of languages) {
      const start = performance.now();
      tokenize(`language-${language}`, text);
      assert.ok(performance.now() - start < 1000, `${language} took too long for ${JSON.stringify(unit)}`);
    }
  }
});

test('Highlights a block with more ranges than fit in a call’s arguments', () => {
  assert.doesNotThrow(() => tokenize('language-css', '{'.repeat(300000)));
});

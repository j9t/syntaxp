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
  // Note: a leading space is part of the `property` match (consistent with
  // this tokenizer's handling of leading whitespace elsewhere, e.g. YAML/
  // Markdown—harmless for rendering since whitespace carries no color), and
  // a `#rrggbb` color value is matched by the `selector` pattern (same shape
  // as an ID selector)—a pre-existing quirk of this grammar, not something
  // introduced here.
  const tokens = tokenize('language-css', '@media (min-width: 1px) { .a { color: #fff; } }');
  assertHasToken(tokens, 'keyword', '@media');
  assertHasToken(tokens, 'selector', '.a');
  assertHasToken(tokens, 'property', ' color');
});

test('`js`', () => {
  // `console.log(…)` rather than a bare builtin call like `fetch(…)`: when a
  // builtin is called directly, `function`’s pattern (listed first) and
  // `builtin`’s pattern match the identical span, and `function` wins by
  // pattern order—so `builtin` only surfaces for non-called references like
  // `console` here.
  const tokens = tokenize('language-js', 'const x = console.log(1); // c');
  assertHasToken(tokens, 'keyword', 'const');
  assertHasToken(tokens, 'builtin', 'console');
  assertHasToken(tokens, 'function', 'log');
  assertHasToken(tokens, 'comment', '// c');
});

test('`ts`', () => {
  const tokens = tokenize('language-ts', 'interface X { a: string }');
  assertHasToken(tokens, 'keyword', 'interface');
  assertHasToken(tokens, 'type', 'string');
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

test('`sql`', () => {
  // `COUNT` is deliberately in the keyword list (alongside
  // `SUM`/`AVG`/`MIN`/`MAX`), so it wins over the identically-spanned
  // `function` match by pattern order—`LOWER(…)` exercises a genuine
  // (non-keyword) function call.
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
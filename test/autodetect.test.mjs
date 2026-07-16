import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSyntaxp, tokensFor } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));
const jsSource = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');

test('unclassed `pre > code` is left untouched without `data-autodetect`', () => {
  const text = 'SELECT * FROM users WHERE id = 1';
  const { highlightsByType } = runSyntaxp(jsSource, { autoSamples: [{ text }] });
  assert.equal(highlightsByType.size, 0);
});

test('`data-autodetect` highlights an unclassed `pre > code` it recognizes', () => {
  const text = 'SELECT * FROM users WHERE id = 1';
  const { highlightsByType } = runSyntaxp(jsSource, { autoSamples: [{ text }], autodetect: true });
  const tokens = tokensFor(text, highlightsByType);
  assert.ok(tokens.some((t) => t.type === 'keyword' && t.text === 'SELECT'));
});

test('`data-autodetect` leaves prose-like text unhighlighted', () => {
  const text = 'This is just a short note, not code.';
  const { highlightsByType } = runSyntaxp(jsSource, { autoSamples: [{ text }], autodetect: true });
  assert.equal(highlightsByType.size, 0);
});

test('`data-autodetect` does not touch already-classed `code[class*="language-"]` elements twice', () => {
  const text = 'const x = 1;';
  const { highlightsByType } = runSyntaxp(jsSource, {
    codeSamples: [{ className: 'language-js', text }],
    autodetect: true
  });
  const tokens = tokensFor(text, highlightsByType);
  assertHasOne(tokens, 'keyword', 'const');
});

test('`detectLanguage` is exposed on `window.syntaxp` for offline/bulk use', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('SELECT * FROM users'), 'sql');
  assert.equal(window.syntaxp.detectLanguage('This is just a short note, not code.'), null);
});

test('`detectLanguage` does not mistake HTML full of `<`/`>` for `ts`/`js`', () => {
  const { window } = runSyntaxp(jsSource);
  const html = '<p>My awesome <a href="https://example.com/?a=b">thing</a>…<br>\nNothing better.';
  assert.equal(window.syntaxp.detectLanguage(html), 'html');
});

test('`detectLanguage` does not mistake ordinary config/prose for `ts`/`js` on keyword collisions alone', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage(':set encoding=utf-8\n:set number'), null);
});

test('`detectLanguage` still recognizes real `ts`/`js` via a strong keyword', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('const greeting = "hi";\nconsole.log(greeting);'), 'js');
  assert.equal(window.syntaxp.detectLanguage('interface X { a: string }\nconst x: X = { a: "y" };'), 'ts');
});

test('`detectLanguage` does not mistake a keyword-free call expression for `js`/`ts`', () => {
  const { window } = runSyntaxp(jsSource);
  // A bare `identifier(args)` call, with no `js`/`ts`-distinctive keyword,
  // is generic enough to plausibly be many languages—not distinctive enough
  // to guess on its own.
  assert.equal(window.syntaxp.detectLanguage('foo(1); bar(2);'), null);
});

test('`detectLanguage` recognizes a plain CSS ruleset with a bare type selector', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('p {\n  margin-inline-start: 1rem;\n}'), 'css');
});

test('`detectLanguage` prefers `html` over `js` when real markup embeds a real `<script>`', () => {
  const { window } = runSyntaxp(jsSource);
  const source = [
    '<script async src="https://www.googletagmanager.com/gtag/js?id=UA-209576-1"></script>',
    '<script>',
    '  window.dataLayer = window.dataLayer || [];',
    '  function gtag(){dataLayer.push(arguments);}',
    "  gtag('js', new Date());",
    '</script>'
  ].join('\n');
  assert.equal(window.syntaxp.detectLanguage(source), 'html');
});

test('`detectLanguage` does not mistake a quoted config value for `js`/`ts` on a bare string alone', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('some_setting = "hello world"'), null);
});

test('`detectLanguage` still recognizes real `sql` written in lowercase', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('select id, name from users where active = 1'), 'sql');
});

test('`detectLanguage` recognizes `apacheconf`/`.htaccess` directives, including the CSP case that used to be mistaken for `python`', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(
    window.syntaxp.detectLanguage('AddCharset utf-8 .css\nAddCharset utf-8 .js\nAddCharset utf-8 .txt'),
    'apacheconf'
  );
  assert.equal(
    window.syntaxp.detectLanguage('Header always set Content-Security-Policy "default-src \'self\'"'),
    'apacheconf'
  );
});

test('`detectLanguage` prefers `apacheconf` over `html` for `<IfModule>`/`<Directory>` sections', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('<IfModule mod_rewrite.c>\nRewriteEngine On\n</IfModule>'), 'apacheconf');
});

test('`detectLanguage` does not mistake vi commands for CSS pseudo-selectors', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage(':set encoding=utf-8\n:set number\n:syntax on'), null);
});

test('`detectLanguage` recognizes an RSS/XML document as `xml`, not `html`', () => {
  const { window } = runSyntaxp(jsSource);
  const rss = [
    '<?xml version="1.0" encoding="utf-8" ?>',
    '<rss version="2.0">',
    '  <channel>',
    '    <title>Example</title>',
    '    <link>https://example.com</link>',
    '  </channel>',
    '</rss>'
  ].join('\n');
  assert.equal(window.syntaxp.detectLanguage(rss), 'xml');
});

test('`detectLanguage` does not mistake a JS property-access chain (`values.slice().sort()`) for CSS selectors', () => {
  const { window } = runSyntaxp(jsSource);
  const source = [
    "eleventyConfig.addFilter('sortByTitle', values => {",
    '  return values.slice().sort((a, b) => a.data.title.localeCompare(b.data.title))',
    '})'
  ].join('\n');
  assert.equal(window.syntaxp.detectLanguage(source), 'js');
});

test('`detectLanguage` does not mistake a colon inside a quoted JS string (`\'lighthouse:default\'`) for a CSS pseudo-selector', () => {
  const { window } = runSyntaxp(jsSource);
  const source = [
    'module.exports = {',
    "  extends: 'lighthouse:default',",
    '};'
  ].join('\n');
  assert.notEqual(window.syntaxp.detectLanguage(source), 'css');
});

test('`detectLanguage` still recognizes real compound CSS selectors (`.card.active`, `p.button:hover`)', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('.card.active {\n  color: red;\n}\np.button:hover {\n  background: blue;\n}'), 'css');
});

test('`detectLanguage` does not mistake prose immediately before a tag (“word <tag”) for a `ts` generic call', () => {
  const { window } = runSyntaxp(jsSource);
  const source = '<p>My awesome <a href="https://example.com/?a=b">gadget thingy</a>…<br>\nNothing better.';
  assert.equal(window.syntaxp.detectLanguage(source), 'html');
});

test('`detectLanguage` still recognizes real `ts` generics (`getUsers<T>(…)`, tight, no space)', () => {
  const { window } = runSyntaxp(jsSource);
  const source = 'async function getUsers<T extends User>(limit: number): Promise<T[]> {\n  return fetch(url);\n}';
  assert.equal(window.syntaxp.detectLanguage(source), 'ts');
});

test('`detectLanguage` recognizes `nunjucks` template tags', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(
    window.syntaxp.detectLanguage('{% for item in items %}\n  {{ item.name }}\n{% endfor %}'),
    'nunjucks'
  );
});

test('`detectLanguage` does not mistake ordinary prose containing “for”/“in”/“is” for `nunjucks`', () => {
  const { window } = runSyntaxp(jsSource);
  assert.equal(window.syntaxp.detectLanguage('This is a note for you, in case it matters.'), null);
});

function assertHasOne(tokens, type, text) {
  const matches = tokens.filter((t) => t.type === type && t.text === text);
  assert.equal(matches.length, 1, `expected exactly one ${type} token ${JSON.stringify(text)}, got ${matches.length}`);
}

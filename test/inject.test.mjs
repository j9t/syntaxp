import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSyntaxp } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));

test('source syntaxp.js does not inject a stylesheet (placeholder unresolved)', () => {
  const jsSource = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 0);
});

test('built dist/syntaxp.js injects a stylesheet with real CSS', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('built dist/syntaxp.min.js injects a stylesheet with real CSS', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('propagates the host script’s CSP nonce to the injected style element', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { currentScriptNonce: 'abc123' });
  assert.equal(styleElements[0].nonce, 'abc123');
});

test('does not set a nonce when the host script has none', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements[0].nonce, '');
});

test('`data-theme=light` strips the dark-mode block entirely', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
  // Light values (the base `:root` block) remain intact
  assert.match(styleElements[0].textContent, /--s5p-background: #f5f5f7/);
});

test('`data-theme=light` also works on the minified build', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
});

test('`data-theme=dark` forces the dark-mode block to always apply', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
  // The dark values are still present, now under the always-true query
  assert.match(css, /--s5p-background: #1e1e2e/);
});

test('`data-theme=dark` also works on the minified build', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\{/);
});

test('an unrecognized `data-theme` value leaves the CSS untouched', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'sepia' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('no `data-theme` attribute leaves the CSS untouched (default OS-driven behavior)', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('auto-detects `color-scheme: light` on the page when `data-theme` is absent', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
  assert.match(styleElements[0].textContent, /--s5p-background: #f5f5f7/);
});

test('auto-detects `color-scheme: dark` on the page when `data-theme` is absent', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
});

test('does not act on `color-scheme: light dark` (page supports both, defers to OS)', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'light dark' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('does not act on the unset/`normal` color-scheme default', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'normal' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('an explicit `data-theme` overrides a conflicting auto-detected page color-scheme', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark', colorScheme: 'light' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
});

test('a present-but-empty `data-theme=""` still counts as explicit and is not overridden by auto-detection', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: '', colorScheme: 'dark' });
  // Neither the (empty, unrecognized) `data-theme` nor the page’s
  // auto-detected `color-scheme: dark` should end up forcing a theme—an
  // explicit attribute, even an empty one, takes precedence over
  // auto-detection and then falls through `applyThemeOverride`’s
  // unrecognized-value branch, leaving the default OS-driven CSS intact
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSyntaxp } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));

test('Does not inject a stylesheet from the source syntaxp.js (placeholder unresolved)', () => {
  const jsSource = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 0);
});

test('Injects a stylesheet with real CSS from the built dist/syntaxp.js', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('Injects a stylesheet with real CSS from the built dist/syntaxp.min.js', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('Propagates the host script’s CSP nonce to the injected style element', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { currentScriptNonce: 'abc123' });
  assert.equal(styleElements[0].nonce, 'abc123');
});

test('Does not set a nonce when the host script has none', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.equal(styleElements[0].nonce, '');
});

test('Strips the dark-mode block entirely with `data-theme=light`', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
  // Light values (the base `:root` block) remain intact
  assert.match(styleElements[0].textContent, /--s5p-background: #f5f5f7/);
});

test('Supports `data-theme=light` in the minified build', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
});

test('Forces the dark-mode block to always apply with `data-theme=dark`', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
  // The dark values are still present, now under the always-true query
  assert.match(css, /--s5p-background: #1e1e2e/);
});

test('Supports `data-theme=dark` in the minified build', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.min.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\{/);
});

test('Leaves the CSS untouched for an unrecognized `data-theme` value', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'sepia' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('Leaves the CSS untouched without a `data-theme` attribute (default OS-driven behavior)', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource);
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('Auto-detects `color-scheme: light` on the page when `data-theme` is absent', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'light' });
  assert.doesNotMatch(styleElements[0].textContent, /prefers-color-scheme/);
  assert.match(styleElements[0].textContent, /--s5p-background: #f5f5f7/);
});

test('Auto-detects `color-scheme: dark` on the page when `data-theme` is absent', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'dark' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
});

test('Does not act on `color-scheme: light dark` (page supports both, defers to OS)', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'light dark' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('Does not act on the unset/`normal` color-scheme default', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { colorScheme: 'normal' });
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});

test('Lets an explicit `data-theme` override a conflicting auto-detected page color-scheme', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: 'dark', colorScheme: 'light' });
  const css = styleElements[0].textContent;
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /@media all\s*\{/);
});

test('Treats a present-but-empty `data-theme=""` as explicit, not overriding it by auto-detection', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntaxp.js`, 'utf8');
  const { styleElements } = runSyntaxp(jsSource, { theme: '', colorScheme: 'dark' });
  // Neither the (empty, unrecognized) `data-theme` nor the page’s
  // auto-detected `color-scheme: dark` should end up forcing a theme—an
  // explicit attribute, even an empty one, takes precedence over
  // auto-detection and then falls through `applyThemeOverride`’s
  // unrecognized-value branch, leaving the default OS-driven CSS intact
  assert.match(styleElements[0].textContent, /prefers-color-scheme/);
});
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { runSyntaxDemon } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));

test('source syntax-demon.js does not inject a stylesheet (placeholder unresolved)', () => {
  const jsSource = readFileSync(`${dirRoot}/syntax-demon.js`, 'utf8');
  const { styleElements } = runSyntaxDemon(jsSource);
  assert.equal(styleElements.length, 0);
});

test('built dist/syntax-demon.js injects a stylesheet with real CSS', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntax-demon.js`, 'utf8');
  const { styleElements } = runSyntaxDemon(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('built dist/syntax-demon.min.js injects a stylesheet with real CSS', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntax-demon.min.js`, 'utf8');
  const { styleElements } = runSyntaxDemon(jsSource);
  assert.equal(styleElements.length, 1);
  assert.match(styleElements[0].textContent, /::highlight\(keyword\)/);
});

test('propagates the host script’s CSP nonce to the injected style element', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntax-demon.min.js`, 'utf8');
  const { styleElements } = runSyntaxDemon(jsSource, { currentScriptNonce: 'abc123' });
  assert.equal(styleElements[0].nonce, 'abc123');
});

test('does not set a nonce when the host script has none', () => {
  const jsSource = readFileSync(`${dirRoot}/dist/syntax-demon.min.js`, 'utf8');
  const { styleElements } = runSyntaxDemon(jsSource);
  assert.equal(styleElements[0].nonce, '');
});
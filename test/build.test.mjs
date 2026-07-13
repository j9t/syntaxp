// Runs the real scripts/build.mjs, redirected (via SYNTAX_DEMON_DIST_DIR) to
// a throwaway temp directory instead of the repo’s own dist/, so this can
// run concurrently with other test files (e.g. inject.test.mjs, which reads
// the repo`s real dist/) without racing over the same output directory.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { runSyntaxDemon } from './helpers/dom.mjs';

const dirRoot = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${dirRoot}/package.json`, 'utf8'));

let dirDist;
let result;

before(() => {
  dirDist = mkdtempSync(join(tmpdir(), 'syntax-demon-build-test-'));
  result = spawnSync(process.execPath, [`${dirRoot}/scripts/build.mjs`], {
    encoding: 'utf8',
    env: { ...process.env, SYNTAX_DEMON_DIST_DIR: dirDist }
  });
});

after(() => {
  rmSync(dirDist, { recursive: true, force: true });
});

test('build script exits cleanly', () => {
  assert.equal(result.status, 0, result.stderr);
});

test('dist contains exactly the four expected files', () => {
  const files = readdirSync(dirDist).sort();
  assert.deepEqual(files, [
    'syntax-demon.js',
    'syntax-demon.js.hash',
    'syntax-demon.min.js',
    'syntax-demon.min.js.hash'
  ]);
});

test('placeholder is fully resolved in both JS builds', () => {
  for (const name of ['syntax-demon.js', 'syntax-demon.min.js']) {
    const content = readFileSync(`${dirDist}/${name}`, 'utf8');
    assert.ok(
      !content.includes('/*__SYNTAX_DEMON_CSS_PLACEHOLDER__*/'),
      `${name} still contains the unresolved CSS placeholder`
    );
  }
});

test('real CSS landed in both JS builds', () => {
  for (const name of ['syntax-demon.js', 'syntax-demon.min.js']) {
    const content = readFileSync(`${dirDist}/${name}`, 'utf8');
    assert.match(content, /::highlight\(keyword\)/, `${name} is missing embedded CSS`);
  }
});

test('min.js is meaningfully smaller than the unminified build', () => {
  const unminified = readFileSync(`${dirDist}/syntax-demon.js`, 'utf8');
  const minified = readFileSync(`${dirDist}/syntax-demon.min.js`, 'utf8');
  assert.ok(minified.length < unminified.length * 0.8, 'min.js is not meaningfully smaller');
});

test('both dist files carry the version banner', () => {
  const banner = `/*! Syntax Demon ${version}, https://github.com/j9t/syntax-demon */`;
  for (const name of ['syntax-demon.js', 'syntax-demon.min.js']) {
    const content = readFileSync(`${dirDist}/${name}`, 'utf8');
    assert.ok(content.startsWith(banner), `${name} is missing the version banner`);
  }
});

test('published .hash exactly matches the hash of what actually gets injected at runtime', () => {
  for (const name of ['syntax-demon.js', 'syntax-demon.min.js']) {
    const jsSource = readFileSync(`${dirDist}/${name}`, 'utf8');
    const { styleElements } = runSyntaxDemon(jsSource);
    const injectedCss = styleElements[0].textContent;
    const expected = `'sha256-${createHash('sha256').update(injectedCss, 'utf8').digest('base64')}'`;
    const published = readFileSync(`${dirDist}/${name}.hash`, 'utf8').trim();
    assert.equal(published, expected, `${name}.hash does not match the injected style’s actual hash`);
  }
});
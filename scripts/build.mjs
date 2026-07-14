#!/usr/bin/env node

// Replaces syntaxp.js’s leading comment with a version-stamped banner
// in the built copies, then produces a minified copy. The source file keeps
// its own descriptive header untouched—only dist/ gets the banner.
// package.json’s `version` field is the single source of truth for a
// release—see .github/workflows/release.yml, which tags and publishes
// automatically when it changes.
//
// syntaxp.css’s content is embedded in place of the `CSS_PLACEHOLDER`
// (see syntaxp.js) in both dist files, so each is a single self-hosted
// file—no separate stylesheet to include or keep in sync. syntaxp.css
// remains the actual source of truth for styles (edit it, not the embedded
// copy) and isn’t emitted to dist/ on its own.
//
// Also writes a .hash file alongside each dist JS file, containing the
// exact `style-src` hash-source (e.g. `'sha256-…'`) for that file’s embedded
// CSS—for sites under a host-based Content Security Policy that can’t use
// the auto-injected <style> via a nonce; see the README’s Content Security
// Policies section. .hash files are picked up by release.yml’s
// `dist/*` glob and attached to the GitHub release like the JS files.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';

function cspHash(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

const dirRoot = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${dirRoot}/package.json`, 'utf8'));
const LEADING_COMMENT = /^\/\*[\s\S]*?\*\//;
const CSS_PLACEHOLDER = "'/*__SYNTAXP_CSS_PLACEHOLDER__*/'";
// Overridable so the test suite can build into a throwaway directory
// instead of the real dist/—see test/build.test.mjs.
const dirDist = process.env.SYNTAXP_DIST_DIR || `${dirRoot}/dist`;

mkdirSync(dirDist, { recursive: true });

const rawCss = readFileSync(`${dirRoot}/syntaxp.css`, 'utf8');
const rawJs = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');

if (!LEADING_COMMENT.test(rawJs)) {
  throw new Error('Expected syntaxp.js to start with a /* … */ comment.');
}
if (!rawJs.includes(CSS_PLACEHOLDER)) {
  throw new Error(`Expected syntaxp.js to contain the ${CSS_PLACEHOLDER} embed placeholder.`);
}

const stampedJs = rawJs.replace(
  LEADING_COMMENT,
  `/*! syntaxp ${version}, https://github.com/j9t/syntaxp */`
);

writeFileSync(
  `${dirDist}/syntaxp.js`,
  stampedJs.replace(CSS_PLACEHOLDER, JSON.stringify(rawCss))
);
const hashUnminified = cspHash(rawCss);
writeFileSync(`${dirDist}/syntaxp.js.hash`, `${hashUnminified}\n`);

const { code: minifiedCss } = await esbuild.transform(rawCss, {
  loader: 'css',
  minify: true
});

const { code: minifiedJs } = await esbuild.transform(
  stampedJs.replace(CSS_PLACEHOLDER, JSON.stringify(minifiedCss)),
  { minify: true, legalComments: 'inline' }
);
writeFileSync(`${dirDist}/syntaxp.min.js`, minifiedJs);
const hashMinified = cspHash(minifiedCss);
writeFileSync(`${dirDist}/syntaxp.min.js.hash`, `${hashMinified}\n`);

console.log(`Built dist/ for v${version}`);
console.log(`  \`style-src\` hash for syntaxp.js: ${hashUnminified}`);
console.log(`  \`style-src\` hash for syntaxp.min.js: ${hashMinified}`);
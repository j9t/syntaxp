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
// Also writes three .hash files for syntaxp.min.js, each containing the
// exact `style-src` hash-source (e.g., `'sha256-…'`) for how its embedded
// CSS looks under a given theme—for sites under a host-based Content
// Security Policy that can’t use the auto-injected `<style>` via a nonce.
// .hash files are picked up by release.yml’s `dist/*` glob and attached to
// the GitHub release like the JS files.
//
// syntaxp.min.js.hash covers the CSS as shipped (no theme override).
// syntaxp.min.js.light.hash and .dark.hash cover it as it looks once a
// `data-theme` override (or its auto-detected equivalent) has stripped or
// force-applied the dark-mode block at runtime—without these, a
// site combining a theme override with a host-based hash CSP would have no
// published hash that actually matches what gets injected, forcing a
// hand-computed one. Only the minified build gets hashes at all; the
// unminified build is meant for reading/auditing, not production hosting
// under a hash-based CSP.
//
// `forceLight`/`forceDark` below mirror `applyThemeOverride`’s two regexes
// in syntaxp.js exactly—kept as a separate copy rather than shared via
// import so syntaxp.js stays a self-contained, dependency-free single
// file. test/build.test.mjs cross-checks these hashes against what the
// built script actually injects at runtime for each theme, so the two
// copies can’t silently drift out of sync.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import * as esbuild from 'esbuild';

function cspHash(text) {
  return `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;
}

// See the file-level comment above for why these are duplicated here
// instead of imported from syntaxp.js
const DARK_QUERY = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/;
const DARK_BLOCK = new RegExp(`${DARK_QUERY.source}\\s*\\{[^{}]*\\{[^{}]*\\}\\s*\\}`);

function forceLight(css) {
  return css.replace(DARK_BLOCK, '');
}

function forceDark(css) {
  return css.replace(DARK_QUERY, '@media all');
}

const dirRoot = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${dirRoot}/package.json`, 'utf8'));
const LEADING_COMMENT = /^\/\*[\s\S]*?\*\//;
const CSS_PLACEHOLDER = "'/*__SYNTAXP_CSS_PLACEHOLDER__*/'";
// Overridable so the test suite can build into a throwaway directory
// instead of the real dist/—see test/build.test.mjs
const dirDist = process.env.SYNTAXP_DIST_DIR || `${dirRoot}/dist`;

mkdirSync(dirDist, { recursive: true });

const rawCss = readFileSync(`${dirRoot}/syntaxp.css`, 'utf8');
const rawJs = readFileSync(`${dirRoot}/syntaxp.js`, 'utf8');

if (!LEADING_COMMENT.test(rawJs)) {
  throw new Error('Expected syntaxp.js to start with a `/* … */` comment.');
}
if (!rawJs.includes(CSS_PLACEHOLDER)) {
  throw new Error(`Expected syntaxp.js to contain the ${CSS_PLACEHOLDER} embed placeholder.`);
}

const stampedJs = rawJs.replace(
  LEADING_COMMENT,
  `/*! syntaxp ${version}, https://github.com/j9t/syntaxp */`
);

// No .hash file for this one—see the file-level comment above
writeFileSync(
  `${dirDist}/syntaxp.js`,
  stampedJs.replace(CSS_PLACEHOLDER, JSON.stringify(rawCss))
);

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

const hashMinifiedLight = cspHash(forceLight(minifiedCss));
writeFileSync(`${dirDist}/syntaxp.min.js.light.hash`, `${hashMinifiedLight}\n`);

const hashMinifiedDark = cspHash(forceDark(minifiedCss));
writeFileSync(`${dirDist}/syntaxp.min.js.dark.hash`, `${hashMinifiedDark}\n`);

console.log(`Built dist/ for v${version}`);
console.log(`  \`style-src\` hash for syntaxp.min.js: ${hashMinified}`);
console.log(`  \`style-src\` hash for syntaxp.min.js (data-theme=light): ${hashMinifiedLight}`);
console.log(`  \`style-src\` hash for syntaxp.min.js (data-theme=dark): ${hashMinifiedDark}`);
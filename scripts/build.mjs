#!/usr/bin/env node

// Replaces each source file’s leading comment with a version-stamped banner
// in the built copies, then produces minified copies. The source files keep
// their own descriptive header untouched—only dist/ gets the banner.
// package.json’s `version` field is the single source of truth for a
// release—see .github/workflows/release.yml, which tags and publishes
// automatically when it changes.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const { version } = JSON.parse(readFileSync(`${root}/package.json`, 'utf8'));
const LEADING_COMMENT = /^\/\*[\s\S]*?\*\//;

mkdirSync(`${root}/dist`, { recursive: true });

for (const name of ['syntax-demon.js', 'syntax-demon.css']) {
  const raw = readFileSync(`${root}/${name}`, 'utf8');
  if (!LEADING_COMMENT.test(raw)) {
    throw new Error(`Expected ${name} to start with a /* … */ comment.`);
  }
  const stamped = raw.replace(
    LEADING_COMMENT,
    `/*! Syntax Demon ${version}, https://github.com/j9t/syntax-demon */`
  );
  writeFileSync(`${root}/dist/${name}`, stamped);
}

await esbuild.build({
  entryPoints: [`${root}/dist/syntax-demon.js`],
  outfile: `${root}/dist/syntax-demon.min.js`,
  minify: true,
  legalComments: 'inline'
});

await esbuild.build({
  entryPoints: [`${root}/dist/syntax-demon.css`],
  outfile: `${root}/dist/syntax-demon.min.css`,
  minify: true,
  legalComments: 'inline'
});

console.log(`Built dist/ for v${version}`);
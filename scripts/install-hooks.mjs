#!/usr/bin/env node

// Installs a pre-commit hook that runs the contrast check whenever
// syntax-demon.css is staged, so contributors find out about a contrast
// failure locally instead of in CI. Runs automatically via the npm
// “prepare” lifecycle script, so `npm install` sets it up for every
// contributor without an extra tool/dependency.

import { writeFileSync, chmodSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

if (!existsSync(`${root}/.git`)) {
  process.exit(0);
}

const hooksDir = `${root}/.git/hooks`;
mkdirSync(hooksDir, { recursive: true });

writeFileSync(
  `${hooksDir}/pre-commit`,
  `#!/bin/sh
if git diff --cached --name-only | grep -q '^syntax-demon\\.css$'; then
  npm run --silent check-contrast || exit 1
fi
`
);
chmodSync(`${hooksDir}/pre-commit`, 0o755);
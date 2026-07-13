#!/usr/bin/env node

// Validates every `--sd-*` token color in syntax-demon.css against the
// `--sd-background` reference color for the same palette (light/dark), at a
// self-imposed minimum of 5:1—stricter than WCAG AA’s 4.5:1 for normal text,
// as a safety margin since token colors are reused as-is on arbitrary sites.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MIN_CONTRAST = 5;
const cssPath = fileURLToPath(new URL('../syntax-demon.css', import.meta.url));
const css = readFileSync(cssPath, 'utf8');

function extractPalette(block) {
  const palette = {};
  const re = /--sd-([\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    palette[match[1]] = match[2];
  }
  return palette;
}

function hexToRgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) {
    h = [...h].map((c) => c + c).join('');
  }
  const num = parseInt(h.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]) {
  const [rl, gl, bl] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

function contrastRatio(hexA, hexB) {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

// Light palette: the first `:root { ... }` block, before any @media block.
const lightBlock = css.slice(0, css.indexOf('@media'));
// Dark palette: the `:root { ... }` block nested inside prefers-color-scheme: dark.
const darkBlock = css.slice(css.indexOf('@media'));

const palettes = {
  light: extractPalette(lightBlock),
  dark: extractPalette(darkBlock)
};

let failed = false;

for (const [scheme, palette] of Object.entries(palettes)) {
  const background = palette.background;
  if (!background) {
    console.error(`No --sd-background found for ${scheme} palette.`);
    failed = true;
    continue;
  }

  console.log(`\n${scheme} palette (background ${background}):`);

  for (const [name, color] of Object.entries(palette)) {
    if (name === 'background') {
      continue;
    }
    const ratio = contrastRatio(color, background);
    const pass = ratio >= MIN_CONTRAST;
    if (!pass) {
      failed = true;
    }
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  --sd-${name.padEnd(12)} ${color}  ${ratio.toFixed(2)}:1`
    );
  }
}

console.log(`\nMinimum required: ${MIN_CONTRAST}:1 (WCAG AA is 4.5:1; this project targets a safety margin above that).`);

if (failed) {
  console.error('\nContrast check failed.');
  process.exit(1);
}

console.log('\nAll token colors pass.');
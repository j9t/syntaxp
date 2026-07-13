# Syntax Demon

Code highlighting via the [CSS Custom Highlight API](https://drafts.csswg.org/css-highlight-api-1/). Zero runtime dependencies. No `<span>` elements in the DOM.

## How It Works

1. Finds all `<code>` elements with a `class=language-*` attribute
2. Tokenizes the text content using regex-based per-language tokenizers
3. Creates `StaticRange` objects for each token
4. Registers them as `Highlight` objects in `CSS.highlights`
5. Styles them via `::highlight()` CSS rules

## Usage

Include the CSS and JS on your page:

```html
<link rel=stylesheet href=syntax-demon.css>
<script src=syntax-demon.js defer></script>
```

Then write normal code blocks:

```html
<pre><code class=language-js>
const greeting = 'Hello';
console.log(greeting);
</code></pre>
```

Inline code works, too:

```html
<p>Run <code class=language-shell>npm install</code> to get started.</p>
```

The script auto-discovers all `<code class=language-*>` elements on `DOMContentLoaded`.

### A Note on Markdown

If your code blocks come from Markdown, `class=language-x` on `<code>` is the _de facto_ (not officially mandated) output of fenced code blocks with an info string—it’s what [CommonMark](https://spec.commonmark.org/)’s reference implementation and illustrative examples use, and what markdown-it (Eleventy’s default engine), Goldmark (Hugo), and the remark/rehype ecosystem all produce out of the box. Two notable exceptions: Pandoc puts an unprefixed class on `<pre>` instead of `<code>` by default, and Jekyll’s default kramdown/Rouge setup pre-highlights code into its own `<span>` elements before this script would see it. Check your generated HTML if you’re not on one of the toolchains above.

## Installing

Download a versioned release from the [releases page](https://github.com/j9t/syntax-demon/releases) and self-host `syntax-demon.css`/`syntax-demon.js` (or the minified `.min.css`/`.min.js`) on your own site. Each release is immutable and version-stamped in the file header, so upgrading is a deliberate, explicit step—nothing changes underfoot.

## Supported Languages

First batch—more languages are to follow. Contributions are welcome!

* `language-html`
* `language-css`
* `language-js`
* `language-ts`
* `language-shell`

## Browser Support

Requires support for [the CSS Custom Highlight API](https://caniuse.com/wf-highlight).

Unsupported browsers show plain uncolored code (graceful fallback, no errors).

## Token Types

| Type | Example |
| --- | --- |
| `keyword` | `const`, `function`, `@media` |
| `string` | `"hello"`, `'world'` |
| `comment` | `// comment`, `/* block */`, `# shell comment` |
| `number` | `42`, `3.14` |
| `function` | `fetchUser()`, `rgb()` |
| `operator` | `===`, `=>`, `&&` |
| `tag` | `<div>`, `</span>` |
| `attribute` | `class=`, `href=` |
| `property` | `color:`, `margin:` |
| `selector` | `.container`, `#app` |
| `builtin` | `console`, `Promise`, `Math` |
| `variable` | `$HOME`, `${name}` |
| `command` | `npm`, `git`, `ssh` |
| `flag` | `--port`, `-v` |
| `path` | `./src/index.js` |

## Customizing Colors

Override the CSS custom properties:

```css
:root {
  --sd-background: #f5f5f7;
  --sd-keyword: #7c3aed;

  /* #107636 */
  --sd-string: #107636;
  --sd-flag: #107636;

  /* … */
}
```

In `syntax-demon.css`, the custom properties are grouped by shared color value (most to least visually prominent, comments last since they’re deliberately the quietest color)—several token types intentionally reuse the same color, e.g. `--sd-function`/`--sd-property`/`--sd-command`.

Light and dark mode palettes are included via `prefers-color-scheme` media queries.

`--sd-background` is the reference background each palette is validated against (see below); it isn’t applied by this stylesheet itself, so set your own `pre`/`code` background to match if you rely on the contrast guarantee.

### Contrast

Every `--sd-*` token color is checked in CI against `--sd-background` for its palette, at a self-imposed minimum of 5:1—stricter than [WCAG AA’s 4.5:1](https://www.w3.org/WAI/WCAG22/Techniques/general/G18) for normal text, as a margin for real-world rendering variance. Run it yourself with:

```shell
npm run check-contrast
```

If you override the default colors or background, you’re responsible for re-checking contrast for your combination; `npm run check-contrast` reads directly from `syntax-demon.css`, so it works against your edits too.

## Development

`syntax-demon.css` and `syntax-demon.js` are the source of truth and have no build step of their own—the tooling below only produces minified files and releases, and is a dev-time dependency only. Run `npm install` once to fetch it and set up a pre-commit hook that runs the contrast check whenever `syntax-demon.css` is staged.

* `npm run check-contrast`—check every token color against its palette’s `--sd-background` (also runs automatically before each commit that touches `syntax-demon.css`)
* `npm run build`—produce version-stamped, minified files in `dist/`

### Releases

Version is tracked in `package.json`, not tagged manually. To cut a release, bump the `version` field and push (or merge a PR that does) to `main`. A [GitHub Actions workflow](https://github.com/j9t/syntax-demon/actions/workflows/release.yml) then automatically:

1. Checks contrast and builds `dist/`
2. Tags the commit `vX.Y.Z`
3. Publishes a GitHub release with the built files (including `.min.js`/`.min.css`) attached

Pushing to `main` without a `package.json` version change is a no-op—no tag or release is created.
# Syntax Demon

Code highlighting via the [CSS Custom Highlight API](https://drafts.csswg.org/css-highlight-api-1/). Zero runtime dependencies. No `<span>` elements in the DOM.

## How It Works

1. Finds all `<code>` elements with a `class=language-*` attribute
2. Tokenizes the text content using regex-based per-language tokenizers
3. Creates `StaticRange` objects for each token
4. Registers them as `Highlight` objects in `CSS.highlights`
5. Styles them via `::highlight()` CSS rules

## Usage

Include [the Syntax Demon script](https://github.com/j9t/syntax-demon/releases) on your page:

```html
<script src=syntax-demon.js defer></script>
```

That is, self-host `syntax-demon.js` (or the minified `syntax-demon.min.js`) on your own site—one file, CSS included. Each release is immutable and version-stamped in the file header.

Then write normal code blocks:

```html
<pre><code class=language-js>
const greeting = 'Hello';
console.log(greeting);
</code></pre>
```

Inline code works, too:

```html
<p>Run <code class=language-shell>npm install</code> to get started.
```

The script auto-discovers all `<code class=language-*>` elements on `DOMContentLoaded`.

### Markdown Fences

Markdown fences should work, too:

If your code blocks come from Markdown, `class=language-x` on `<code>` is the _de facto_ (not officially mandated) output of fenced code blocks with an info string—it’s what [CommonMark](https://spec.commonmark.org/)’s reference implementation and illustrative examples use, and what markdown-it (Eleventy’s default engine), Goldmark (Hugo), and the remark/rehype ecosystem all produce out of the box.

Two notable exceptions: Pandoc puts an unprefixed class on `<pre>` instead of `<code>` by default, and Jekyll’s default kramdown/Rouge setup pre-highlights code into its own `<span>` elements before this script would see it. Check your generated HTML if you’re not on one of the toolchains above.

### Content Security Policies

The style sheet injected by Syntax Demon is a `<style>` element, which, if you run a Content Security Policy, is governed by your `style-src` policy (specifically `style-src-elem`, if set). This may require one of the following:

* **Nonce-based CSP:** Add a `nonce` attribute to the `<script src=syntax-demon.js>` element, same as you would for any other script under a nonce-based policy. The library automatically reads its own script’s nonce via `document.currentScript.nonce` and applies it to the `<style>` element it creates—no separate configuration needed.

* **Host-based CSP without nonces** (e.g., just `style-src 'self'`, no `'unsafe-inline'`): add a hash source instead—`style-src 'sha256-…'`. Every Syntax Demon release also publishes the correct hash as a .hash file—syntax-demon.js.hash for syntax-demon.js, syntax-demon.min.js.hash for syntax-demon.min.js—on the [releases page](https://github.com/j9t/syntax-demon/releases). Copy the value matching whichever file you self-host (the two differ, since minification changes the exact bytes) into your `style-src` directive. Since the embedded CSS is versioned and immutable per release, that hash only needs updating when you deliberately upgrade to a release whose CSS actually changed—not on every upgrade, and never silently.

* **Don’t want to touch your CSP?** Reach out about any pain points you may have, so that I can look into additional options. In the worst case, copy and host syntax-demon.css yourself.

## Supported Languages

* `language-html`/`language-xml`
* `language-css`
* `language-js`
* `language-ts`
* `language-shell` (alias: `language-bash`)
* `language-markdown` (alias: `language-md`)
* `language-json`
* `language-yaml`
* `language-sql`
* `language-php`
* `language-python` (alias: `language-py`)
* `language-diff` (alias: `language-patch`)

Do you miss an important language or alias? Contributions are welcome!

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

## Browser Support

Syntax Demon requires support for [the CSS Custom Highlight API](https://caniuse.com/wf-highlight).

Unsupported browsers show plain uncolored code (graceful fallback, no errors).

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

If you override the default colors or background, you’re responsible for re-checking contrast for your combination; `npm run check-contrast` reads directly from `syntax-demon.css`, so it works against your edits, too.

## Development

`syntax-demon.css` and `syntax-demon.js` are the source of truth and have no build step of their own—the tooling below only produces version-stamped release files in `dist/`, and is a dev-time dependency only. Run `npm install` once to fetch it and set up a pre-commit hook that runs the contrast check whenever `syntax-demon.css` is staged.

* `npm run check-contrast`: Check every token color against its palette’s `--sd-background` (also runs automatically before each commit that touches `syntax-demon.css`)
* `npm run build`: Produce `dist/syntax-demon.js` and `dist/syntax-demon.min.js`, each with `syntax-demon.css`’s content embedded (unminified and minified, respectively), plus a `.hash` file next to each containing its `style-src` hash-source (see [note on Content Security Policies](#content-security-policies))
* `npm test`: Run the test suite

### Releases

Version is tracked in `package.json`, not tagged manually. To cut a release, bump the `version` field and push (or merge a PR that does) to `main`. A [GitHub Actions workflow](https://github.com/j9t/syntax-demon/actions/workflows/release.yml) then automatically:

1. Checks contrast and builds `dist/`
2. Tags the commit `vX.Y.Z`
3. Publishes a GitHub release with the built files (`syntax-demon.js`, `syntax-demon.min.js`, and their `.hash` files) attached

Pushing to `main` without a `package.json` version change is a no-op—no tag or release is created.
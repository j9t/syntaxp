# syntaxp Syntax Highlighter

syntaxp—“syntax paint”—provides code highlighting via the [CSS Custom Highlight API](https://drafts.csswg.org/css-highlight-api-1/). Zero runtime dependencies. No extra elements in the DOM.

## How It Works

1. Finds all `<code>` elements with a `class=language-*` attribute
2. Tokenizes the text content using regex-based per-language tokenizers
3. Creates `StaticRange` objects for each token
4. Registers them as `Highlight` objects in `CSS.highlights`
5. Styles them via `::highlight()` CSS rules

## Usage

Add [the syntaxp script (~16 KB minified)](https://github.com/j9t/syntaxp/releases) to your site or page (for privacy and performance reasons, _you_ decide on hosting):

```html
<script src=/path/to/syntaxp.js defer></script>
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
<p>Run <code class=language-shell>npm install</code> to get started.
```

The script auto-discovers all `<code class=language-*>` elements on `DOMContentLoaded`.

### Markdown Fences Support

Markdown fences that emit `class=language-x` on `<code>` elements work with syntaxp:

If your code blocks come from Markdown and contain language information, `class=language-x` on `<code>` is often the output—it’s what [CommonMark](https://spec.commonmark.org/)’s reference implementation and illustrative examples use, and what markdown-it (Eleventy’s default engine), Goldmark (Hugo), and the remark/rehype ecosystem all produce out of the box.

Two notable exceptions: Pandoc puts an unprefixed class on `<pre>` instead of `<code>` by default, and Jekyll’s default kramdown/Rouge setup pre-highlights code into its own `<span>` elements before this script would see it. Check your generated HTML if you’re not on one of the toolchains above.

### Language Auto-Detection (Opt-In)

For older content with code blocks not using `language-*` classes, add `data-autodetect` to the script element:

```html
<script src=/path/to/syntaxp.js defer data-autodetect></script>
```

With this set, syntaxp also guesses a language for any `pre > code` element that has no `language-*` class, using the same tokenizers as regular highlighting, and skips elements it isn’t reasonably confident about (left as plain code, same graceful fallback as an unsupported browser). This is a heuristic, not real language detection, so expect the occasional miss—tagging code blocks with an explicit `class=language-x` is the most reliable option and is unaffected by this setting either way. (The option is off by default, since a wrong guess is a worse outcome than no highlighting.)

### Forcing a Color Scheme

By default, syntaxp’s token colors follow the visitor’s OS/browser `prefers-color-scheme` setting on their own. However, this happens regardless of whether the host page itself renders in both light and dark mode. On a site that only renders in one mode, that’s a mismatch: A light-only page’s code colors will shift to the dark palette (tuned for a dark background) whenever a visitor’s OS is set to dark, and the reverse for a dark-only page.

**Automatic, no setup needed:** If the page declares a light _or_ dark [`color-scheme`](https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme) on `:root`/`html`, syntaxp picks that up on its own and pins its palette to match. This only fires on that one unambiguous, standardized signal—`color-scheme: light dark`, or the property being unset entirely (its default), both leave the OS-driven behavior in place, since neither actually tells syntaxp whether the page is single-mode. In particular, a page that supports dark mode purely through its own `prefers-color-scheme` media queries, without ever setting `color-scheme`, looks identical, script-wise, to a page that didn’t think about dark mode; syntaxp can’t tell those two apart.

**Manual override, for everything else:** If your page doesn’t or can’t declare `color-scheme`, add `data-theme=light` or `data-theme=dark` to the script element instead:

```html
<script src=/path/to/syntaxp.js defer data-theme=light></script>
```

`data-theme`, when present with a recognized value, always wins over the auto-detected page color-scheme. Any other value, or the attribute being absent (with no usable `color-scheme` on the page either), leaves the default OS-driven behavior in place.

### Content Security Policy Management

The style sheet injected by syntaxp is a `<style>` element, which, if you run a Content Security Policy, is governed by your `style-src` policy (specifically `style-src-elem`, if set). This may require one of the following:

* **Nonce-based CSP:** Add a `nonce` attribute to the `<script src=syntaxp.js>` element, same as you would for any other script under a nonce-based policy. The library automatically reads its own script’s nonce via `document.currentScript.nonce` and applies it to the `<style>` element it creates. This only covers the library’s own side, though: Your CSP header still needs to authorize that same nonce value under `style-src` (or `style-src-elem`), not just `script-src`—the usual case if you generate one nonce per request and reuse it across both directives, but worth checking if your policy issues separate nonces per directive.

* **Host-based CSP without nonces** (e.g., just `style-src 'self'`, no `'unsafe-inline'`): add a hash source instead—`style-src 'sha256-…'`. Every syntaxp release publishes three .hash files for `syntaxp.min.js` on the [releases page](https://github.com/j9t/syntaxp/releases), one per possible injected result: `syntaxp.min.js.hash` (no theme override), `syntaxp.min.js.light.hash` (`data-theme=light`, or a page whose own `color-scheme` auto-detects as light), and `syntaxp.min.js.dark.hash` (the same for dark). Copy whichever one matches your actual configuration into your `style-src` directive—no computation needed, even with a theme override in effect. Since the embedded CSS is versioned and immutable per release, that hash only needs updating when you deliberately upgrade to a release whose CSS actually changed—not on every upgrade, and never silently. Only `syntaxp.min.js` gets published hashes; self-hosting the unminified `syntaxp.js` build (meant for reading/auditing, not typical production hosting) under a host-based hash CSP means computing your own.

* **Don’t want to touch your CSP?** Reach out about any pain points you may have, so that I can look into additional options. In the worst case, copy and host syntaxp.css yourself.

### Updating

Given syntaxp’s ownership-minded approach (self-hosting for privacy and performance reasons), there is no automatic update process. Each script file ships with a version comment (e.g., `/*! syntaxp 2.1.0, https://github.com/j9t/syntaxp */`) that you can use to compare with [the latest release](https://github.com/j9t/syntaxp/releases). (If using a Content Security Policy, [take note on CSP management](#content-security-policy-management).)

## Supported Languages

* HTML (`language-html`)
* XML (`language-xml`)
* Markdown (`language-markdown`; alias: `language-md`)
* CSS (`language-css`)
* JavaScript (`language-javascript`; alias: `language-js`)
* TypeScript (`language-typescript`; alias: `language-ts`)
* Python (`language-python`; alias: `language-py`)
* PHP (`language-php`)
* Shell (`language-shell`; aliases: `language-bash`, `language-sh`)
* JSON (`language-json`)
* YAML (`language-yaml`; alias: `language-yml`)
* SQL (`language-sql`)
* Nunjucks (`language-nunjucks`; alias: `language-njk`)
* Diff (`language-diff`; alias: `language-patch`)
* HTTP (`language-http`)
* Apache configuration (`language-apacheconf`)

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

syntaxp requires support for [the CSS Custom Highlight API](https://caniuse.com/wf-highlight).

Unsupported browsers show plain uncolored code (graceful fallback, no errors).

## Development

`syntaxp.css` and `syntaxp.js` are the source of truth and have no build step of their own—the tooling below only produces version-stamped release files in `dist/`, and is a dev-time dependency only. Run `npm install` once to fetch it and set up a pre-commit hook that runs the contrast check whenever `syntaxp.css` is staged.

* `npm run check-contrast`: Check every token color against its palette’s `--s5p-background` (also runs automatically before each commit that touches `syntaxp.css`)
* `npm run build`: Produce `dist/syntaxp.js` and `dist/syntaxp.min.js`, each with `syntaxp.css`’s content embedded (unminified and minified, respectively), plus three `.hash` files for `syntaxp.min.js` (default, `data-theme=light`, `data-theme=dark`) containing their `style-src` hash-sources (see [note on Content Security Policies](#content-security-policy-management))
* `npm test`: Run the test suite

### Releasing

Version is tracked in `package.json`, not tagged manually. To issue a release, bump the `version` field and push (or merge a PR that does) to `main`. A [GitHub Actions workflow](https://github.com/j9t/syntaxp/actions/workflows/release.yml) then automatically:

1. checks contrast and builds `dist/`,
2. tags the commit `vX.Y.Z`, and
3. publishes a GitHub release with the built files (`syntaxp.js`, `syntaxp.min.js`, and `syntaxp.min.js`’s three `.hash` files) attached.

Pushing to `main` without a `package.json` version change is a no-op—no tag or release is created.
# syntaxp Syntax Highlighter

syntaxp—“syntax paint”—provides code highlighting via the [CSS Custom Highlight API](https://drafts.csswg.org/css-highlight-api-1/). Zero runtime dependencies. No extra elements in the DOM.

## How It Works

1. Finds all `<code>` elements with a `class=language-*` attribute
2. Tokenizes the text content using regex-based per-language tokenizers
3. Creates `StaticRange` objects for each token
4. Registers them as `Highlight` objects in `CSS.highlights`
5. Styles them via `::highlight()` CSS rules

## Usage

Add [the syntaxp script (~15 KB minified)](https://github.com/j9t/syntaxp/releases) to your site or page (for privacy and performance reasons, _you_ decide on hosting):

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

### Forcing a Color Scheme (Opt-In)

By default, syntaxp’s token colors follow the visitor’s OS/browser `prefers-color-scheme` setting on their own, regardless of whether the host page itself renders in both light and dark mode. On a site that only ever renders in one mode, that’s a mismatch: a light-only page’s code colors will shift to the dark palette (tuned for a dark background) whenever a visitor’s OS is set to dark, and the reverse for a dark-only page.

If that applies to your site, add `data-theme=light` or `data-theme=dark` to the script element to pin the palette instead of following the OS setting:

```html
<script src=/path/to/syntaxp.js defer data-theme=light></script>
```

Any other value, or the attribute being absent, leaves the default OS-driven behavior in place.

### Content Security Policy Management

The style sheet injected by syntaxp is a `<style>` element, which, if you run a Content Security Policy, is governed by your `style-src` policy (specifically `style-src-elem`, if set). This may require one of the following:

* **Nonce-based CSP:** Add a `nonce` attribute to the `<script src=syntaxp.js>` element, same as you would for any other script under a nonce-based policy. The library automatically reads its own script’s nonce via `document.currentScript.nonce` and applies it to the `<style>` element it creates—no separate configuration needed.

* **Host-based CSP without nonces** (e.g., just `style-src 'self'`, no `'unsafe-inline'`): add a hash source instead—`style-src 'sha256-…'`. Every syntaxp release also publishes the correct hash as a .hash file—syntaxp.js.hash for syntaxp.js, syntaxp.min.js.hash for syntaxp.min.js—on the [releases page](https://github.com/j9t/syntaxp/releases). Copy the value matching whichever file you self-host (the two differ, since minification changes the exact bytes) into your `style-src` directive. Since the embedded CSS is versioned and immutable per release, that hash only needs updating when you deliberately upgrade to a release whose CSS actually changed—not on every upgrade, and never silently. **Exception:** if you also use `data-theme` (above), the injected `<style>` content is no longer byte-identical to the release build—the published `.hash` won’t match, and a host-based CSP will block it. Either compute your own hash for the actual injected content, or use a nonce-based policy instead when combining `data-theme` with a host-based CSP.

* **Don’t want to touch your CSP?** Reach out about any pain points you may have, so that I can look into additional options. In the worst case, copy and host syntaxp.css yourself.

### Updating

Given syntaxp’s ownership-minded approach (self-hosting for privacy and performance reasons), there is no automatic update process. Each script file ships with a version comment (e.g., `/*! syntaxp 2.1.0, https://github.com/j9t/syntaxp */`) that you can use to compare with [the latest release](https://github.com/j9t/syntaxp/releases). (If using a Content Security Policy, [take note on CSP management](#content-security-policy-management).)

## Supported Languages

* HTML (`language-html`)
* XML (`language-xml`)
* CSS (`language-css`)
* JavaScript (`language-js`)
* TypeScript (`language-ts`)
* Shell (`language-shell`; alias: `language-bash`)
* Markdown (`language-markdown`; alias: `language-md`)
* JSON (`language-json`)
* YAML (`language-yaml`)
* SQL (`language-sql`)
* PHP (`language-php`)
* Python (`language-python`; alias: `language-py`)
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
* `npm run build`: Produce `dist/syntaxp.js` and `dist/syntaxp.min.js`, each with `syntaxp.css`’s content embedded (unminified and minified, respectively), plus a `.hash` file next to each containing its `style-src` hash-source (see [note on Content Security Policies](#content-security-policy-management))
* `npm test`: Run the test suite

### Releasing

Version is tracked in `package.json`, not tagged manually. To issue a release, bump the `version` field and push (or merge a PR that does) to `main`. A [GitHub Actions workflow](https://github.com/j9t/syntaxp/actions/workflows/release.yml) then automatically:

1. checks contrast and builds `dist/`,
2. tags the commit `vX.Y.Z`, and
3. publishes a GitHub release with the built files (`syntaxp.js`, `syntaxp.min.js`, and their `.hash` files) attached.

Pushing to `main` without a `package.json` version change is a no-op—no tag or release is created.
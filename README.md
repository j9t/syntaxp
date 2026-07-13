# Syntax Demon

Code highlighting via the [CSS Custom Highlight API](https://drafts.csswg.org/css-highlight-api-1/). Zero dependencies. No `<span>` elements in the DOM.

## How it works

1. Finds all `<code>` elements with a `class=language-*` attribute
2. Tokenizes the text content using regex-based per-language tokenizers
3. Creates `StaticRange` objects for each token
4. Registers them as `Highlight` objects in `CSS.highlights`
5. Styles them via `::highlight()` CSS rules

The text node stays clean—no DOM manipulation, no wrapper elements.

## Usage

Include the CSS and JS on your page:

```html
<link rel=stylesheet href=syntax-demon.css>
<script src=syntax-demon.js></script>
```

Then write normal code blocks:

```html
<pre><code class=language-js>
const greeting = 'Hello';
console.log(greeting);
</code></pre>
```

Inline code works too:

```html
<p>Run <code class=language-shell>npm install</code> to get started.</p>
```

The JS auto-discovers all `<code class=language-*>` elements on `DOMContentLoaded`.

## Supported languages

* `language-html`
* `language-css`
* `language-js`
* `language-ts`
* `language-shell`

(Contributions are welcome to extend this—please send a PR!)

## Browser support

Requires support for [the CSS Custom Highlight API](https://caniuse.com/wf-highlight).

Unsupported browsers show plain uncolored code (graceful fallback, no errors).

## Token types

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

## Customizing colors

Override the CSS custom properties:

```css
:root {
  --sd-keyword: #7c3aed;
  --sd-string: #16a34a;
  --sd-comment: #6b7280;
  /* ... */
}
```

Light and dark mode palettes are included via `prefers-color-scheme` media queries.
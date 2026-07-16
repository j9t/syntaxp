/**
 * syntaxp: Code Highlighting via the CSS Custom Highlight API.
 * Zero-dependency syntax highlighting. No extra HTML elements, no DOM manipulation.
 * Falls back gracefully in unsupported browsers.
 */

(function () {
  'use strict';

  if (!CSS.highlights) {
    return;
  }

  // `document.currentScript` is only valid during this script’s own
  // synchronous execution, so it’s captured once, up front, for both the CSP
  // nonce (below) and the `data-autodetect` opt-in (see `highlightAll`)
  const currentScript = document.currentScript;

  // Replaced with the actual contents of syntaxp.css at build time (see
  // scripts/build.mjs), so dist/syntaxp.js is a single self-hosted file.
  // Left as a placeholder here; the source setup (see index.html) loads
  // syntaxp.css separately instead.
  const CSS_EMBEDDED = '/*__SYNTAXP_CSS_PLACEHOLDER__*/';

  // Matches the embedded CSS’s dark-mode block regardless of formatting
  // since neither form nests further braces inside it (custom property
  // declarations only, no rules)
  const DARK_QUERY = /@media\s*\(\s*prefers-color-scheme\s*:\s*dark\s*\)/;
  const DARK_BLOCK = new RegExp(`${DARK_QUERY.source}\\s*\\{[^{}]*\\{[^{}]*\\}\\s*\\}`);

  // Applies a `data-theme=light|dark` override to the embedded CSS before
  // it’s injected. By default, syntaxp’s token colors follow the
  // visitor’s OS `prefers-color-scheme`, independent of whether the host
  // page itself renders in both modes—a mismatch on single-mode sites
  // (e.g., a light-only page whose code colors shift to the dark palette,
  // tuned for a dark background, whenever a visitor’s OS is set to dark).
  // `light` drops the dark block outright, so the base (light) values can
  // never be overridden. `dark` keeps the block but swaps its condition for
  // one that’s always true, so its values apply unconditionally instead of
  // the base ones. Any other value—including the attribute being absent—
  // leaves the CSS untouched.
  function applyThemeOverride(css, theme) {
    if (theme === 'light') {
      return css.replace(DARK_BLOCK, '');
    }
    if (theme === 'dark') {
      return css.replace(DARK_QUERY, '@media all');
    }
    return css;
  }

  // Falls back to the page’s own `color-scheme` when `data-theme` isn’t
  // set, but only acts on it when the page unambiguously declares a single
  // mode (`color-scheme: light` or `color-scheme: dark` alone)—the one
  // standardized, spec-defined signal for “this page only renders in one
  // mode.” `color-scheme: light dark` (both) or the unset default
  // (`normal`) both leave this returning `null`, since neither tells us
  // anything: `normal` in particular can’t be told apart from a page that
  // supports dark entirely through undeclared `prefers-color-scheme` media
  // queries in its CSS—the common pattern—so guessing there would be as
  // likely to be wrong as right. Pages in that position still need an
  // explicit `data-theme`.
  function detectPageTheme() {
    if (typeof getComputedStyle !== 'function' || !document.documentElement) {
      return null;
    }
    const colorScheme = getComputedStyle(document.documentElement).colorScheme;
    return (colorScheme === 'light' || colorScheme === 'dark') ? colorScheme : null;
  }

  if (!CSS_EMBEDDED.includes('__SYNTAXP_CSS_PLACEHOLDER__')) {
    const style = document.createElement('style');
    // Propagates this script’s own CSP nonce (if any) to the `style` element,
    // so a nonce-based Content Security Policy covers it automatically
    const nonce = currentScript && currentScript.nonce;
    if (nonce) {
      style.nonce = nonce;
    }
    // An explicit `data-theme`—even present but empty/unrecognized—always
    // wins over the auto-detected one; `hasAttribute` (not a truthiness
    // check on the value) is what makes that hold for `data-theme=""`
    const theme = (currentScript && currentScript.hasAttribute('data-theme'))
      ? currentScript.getAttribute('data-theme')
      : detectPageTheme();
    style.textContent = applyThemeOverride(CSS_EMBEDDED, theme);
    document.head.appendChild(style);
  }

  // Token patterns per language
  const languages = {

    html: [
      { type: 'comment', regex: /<!--[\s\S]*?-->/g },
      { type: 'doctype', regex: /<!DOCTYPE\s+[^>]*>/gi },
      { type: 'tag', regex: /<\/?[a-zA-Z][a-zA-Z0-9]*/g },
      { type: 'attribute', regex: /\b[a-zA-Z-]+(?==)/g },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'entity', regex: /&[a-zA-Z]+;|&#\d+;/g },
      { type: 'punctuation', regex: /[<>/=]/g }
    ],

    markdown: [
      { type: 'comment', regex: /<!--[\s\S]*?-->|^>.*$/gm },
      { type: 'keyword', regex: /^#{1,6}\s.*$/gm },
      { type: 'string', regex: /`[^`]+`/g },
      { type: 'attribute', regex: /\*\*[^*]+\*\*|__[^_]+__/g },
      { type: 'entity', regex: /(?<!\*)\*[^*\n]+\*(?!\*)|(?<!_)_[^_\n]+_(?!_)/g },
      { type: 'property', regex: /(?<=\[)[^\]]+(?=\])/g },
      { type: 'path', regex: /(?<=\()[^)]+(?=\))/g },
      { type: 'punctuation', regex: /^(?:-{3,}|\*{3,}|_{3,})$|^\s*[-*+](?=\s)|^\s*\d+\.(?=\s)|[[\]()]/gm }
    ],

    css: [
      { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'number', regex: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/g },
      { type: 'keyword', regex: /@(media|import|keyframes|font-face|supports|charset|namespace|layer|property)\b/g },
      { type: 'selector', regex: /[.#:][a-zA-Z_-][a-zA-Z0-9_-]*/g },
      // A bare type selector (`p`, `h1`, `body`…) has no punctuation prefix
      // to key off, unlike `.class`/`#id`/`:pseudo` above—the one thing
      // that reliably marks it as a selector rather than, say, a property
      // value is sitting directly before a rule’s opening `{`
      { type: 'selector', regex: /[a-zA-Z][a-zA-Z0-9-]*(?=\s*\{)/g },
      { type: 'property', regex: /(?<=^|[{;])\s*[a-zA-Z-]+(?=\s*:)/gm },
      { type: 'function', regex: /(?:rgba?|hsla?|linear-gradient|radial-gradient|calc|var|env|clamp|min|max|url)\s*(?=\()/g },
      { type: 'punctuation', regex: /[{}();:,]/g }
    ],

    js: [
      { type: 'comment', regex: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
      { type: 'string', regex: /`[\s\S]*?`|"[^"]*"|'[^']*'/g },
      { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|super|this|import|from|export|default|async|await|try|catch|finally|throw|yield|static|get|set)\b/g },
      { type: 'number', regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g },
      { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\()/g },
      { type: 'builtin', regex: /\b(console|document|window|Math|Array|Object|String|Number|Boolean|Promise|Map|Set|RegExp|Error|JSON|Proxy|Reflect|Symbol|WeakMap|WeakSet|Intl|URL|URLSearchParams|FormData|Headers|Request|Response|fetch|setTimeout|setInterval|clearTimeout|clearInterval|parseInt|parseFloat|isNaN|isFinite|encodeURI|decodeURI|encodeURIComponent|decodeURIComponent|alert|confirm|prompt|requestAnimationFrame|cancelAnimationFrame|structuredClone)\b/g },
      { type: 'operator', regex: /[=!<>]=?=?|&&|\|\||[+\-*/%]=?|\?\?|\.\.\.|=>/g },
      { type: 'punctuation', regex: /[{}[\]();:,.]/g }
    ],

    ts: [
      { type: 'comment', regex: /\/\/.*$|\/\*[\s\S]*?\*\//gm },
      { type: 'string', regex: /`[\s\S]*?`|"[^"]*"|'[^']*'/g },
      { type: 'keyword', regex: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|delete|typeof|instanceof|in|of|class|extends|super|this|import|from|export|default|async|await|try|catch|finally|throw|yield|static|get|set|interface|type|enum|implements|abstract|declare|namespace|module|as|is|keyof|readonly|private|protected|public|override|satisfies|infer|never|unknown|any|void|null|undefined|true|false)\b/g },
      { type: 'number', regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g },
      // `<` is only accepted immediately adjacent (no whitespace)—real
      // generics (`getUsers<T>`, `Array<number>`) are always written tight;
      // allowing a space too made ordinary prose immediately before a tag
      // (“word <tag”) register as a fake generic call, e.g., inside an HTML
      // example this tokenizer was asked to score during language detection
      { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\(|<)/g },
      { type: 'type', regex: /\b(string|number|boolean|bigint|symbol|object|Array|Promise|Record|Partial|Required|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|ConstructorParameters|InstanceType)\b/g },
      { type: 'operator', regex: /[=!<>]=?=?|&&|\|\||[+\-*/%]=?|\?\?|\.\.\.|=>/g },
      { type: 'punctuation', regex: /[{}[\]();:,.]/g }
    ],

    python: [
      { type: 'comment', regex: /#.*$/gm },
      { type: 'string', regex: /(?:[rRbBfFuU]{1,2})?("""[\s\S]*?"""|'''[\s\S]*?''')|(?:[rRbBfFuU]{1,2})?"(?:[^"\\]|\\.)*"|(?:[rRbBfFuU]{1,2})?'(?:[^'\\]|\\.)*'/g },
      { type: 'keyword', regex: /^\s*@[a-zA-Z_][a-zA-Z0-9_.]*|\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/gm },
      { type: 'builtin', regex: /\b(?:print|len|range|str|int|float|bool|list|dict|set|tuple|type|isinstance|super|self|enumerate|zip|map|filter|sorted|reversed|open|input|format|repr|iter|next|abs|min|max|sum|any|all|Exception|ValueError|TypeError|KeyError|IndexError|StopIteration)\b/g },
      { type: 'number', regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?[jJ]?\b/g },
      { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g },
      { type: 'operator', regex: /<<=|>>=|<<|>>|[=!<>]=?|\*\*=?|\/\/=?|[+\-%]=?|[*/&|^]=?|~|->|:=/g },
      { type: 'punctuation', regex: /[{}[\]();,:.]/g }
    ],

    php: [
      { type: 'comment', regex: /\/\/.*$|#.*$|\/\*[\s\S]*?\*\//gm },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g },
      { type: 'keyword', regex: /<\?php\b|\?>|\b(?:abstract|and|array|as|break|callable|case|catch|class|clone|const|continue|declare|default|do|echo|else|elseif|empty|enddeclare|endfor|endforeach|endif|endswitch|endwhile|extends|final|finally|fn|for|foreach|function|global|goto|if|implements|include|include_once|instanceof|insteadof|interface|isset|list|match|namespace|new|or|print|private|protected|public|readonly|require|require_once|return|static|switch|throw|trait|try|unset|use|var|while|xor|yield|null|true|false|self|parent)\b/gi },
      { type: 'variable', regex: /\$[a-zA-Z_][a-zA-Z0-9_]*/g },
      { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
      { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g },
      { type: 'operator', regex: /[=!<>]=?=?|&&|\|\||[+\-*/%.]=?|->|=>|::|\?\?/g },
      { type: 'punctuation', regex: /[{}[\]();,]/g }
    ],

    shell: [
      { type: 'comment', regex: /#.*$/gm },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'variable', regex: /\$[{(]?[a-zA-Z_][a-zA-Z0-9_]*[})]?/g },
      { type: 'flag', regex: /(?<=^|\s)--?[a-zA-Z-]+/g },
      { type: 'path', regex: /(?:\.{0,2}\/)[^\s;|&<>"]+/g },
      { type: 'command', regex: /^(?:sudo|cd|ls|cat|grep|find|mkdir|rm|cp|mv|chmod|chown|ssh|scp|rsync|npm|npx|node|git|docker|docker-compose|curl|wget|tar|zip|unzip|make|cmake|brew|apt|yum|dnf|pacman|kill|ps|top|htop|df|du|mount|umount|echo|export|source|alias|unalias|which|whereis|man|tail|head|less|more|sort|uniq|wc|awk|sed|cut|tr|tee|xargs|chmod|chown|ln|touch|date|cal|env|history|clear|exit)\b/gm },
      { type: 'operator', regex: /[|;&><]/g }
    ],

    json: [
      { type: 'property', regex: /"(?:[^"\\]|\\.)*"(?=\s*:)/g },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"/g },
      { type: 'keyword', regex: /\b(?:true|false|null)\b/g },
      { type: 'number', regex: /-?\b\d+(\.\d+)?([eE][+-]?\d+)?\b/g },
      { type: 'punctuation', regex: /[{}[\]:,]/g }
    ],

    yaml: [
      { type: 'comment', regex: /#.*$/gm },
      { type: 'property', regex: /^\s*(?:-\s*)?[a-zA-Z_][\w.-]*(?=\s*:(?:\s|$))/gm },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'keyword', regex: /\b(?:true|false|null)\b/g },
      { type: 'number', regex: /-?\b\d+(\.\d+)?\b/g },
      { type: 'punctuation', regex: /^---$|^\.\.\.$|[:,[\]{}]|^\s*-(?=\s)/gm }
    ],

    sql: [
      { type: 'comment', regex: /--.*$|\/\*[\s\S]*?\*\//gm },
      { type: 'string', regex: /'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g },
      { type: 'keyword', regex: /\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|JOIN|INNER|LEFT|RIGHT|OUTER|ON|AND|OR|NOT|NULL|IS|IN|LIKE|BETWEEN|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|AS|DISTINCT|COUNT|SUM|AVG|MIN|MAX|UNION|ALL|EXISTS|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|UNIQUE|INDEX|CONSTRAINT|CHECK|VIEW|TRIGGER|PROCEDURE|FUNCTION|RETURNS|BEGIN|DECLARE|IF|WHILE|LOOP|FOR)\b/gi },
      { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
      { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g },
      { type: 'operator', regex: /[=<>!]=?|\|\|/g },
      { type: 'punctuation', regex: /[(),;.*]/g }
    ],

    nunjucks: [
      { type: 'comment', regex: /\{#[\s\S]*?#\}/g },
      { type: 'string', regex: /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g },
      // Delimiters (with optional `-` whitespace-control markers) share the
      // `keyword` type with the tag/expression keywords below, the same way
      // `php`’s `<?php`/`?>` delimiters do—both mark where template syntax
      // starts and ends, not ordinary punctuation
      { type: 'keyword', regex: /\{\{-?|-?\}\}|\{%-?|-?%\}|\b(?:if|elif|else|endif|for|endfor|asyncEach|endeach|asyncAll|endall|macro|endmacro|call|endcall|set|endset|extends|block|endblock|include|import|from|as|filter|endfilter|raw|endraw|verbatim|endverbatim|with|without|and|or|not|in|is|true|false|none)\b/g },
      { type: 'number', regex: /\b\d+(\.\d+)?\b/g },
      // A filter name (`{{ value | upper }}`) is only ever a bare word right
      // after `|`—no fixed filter list is kept here since templates commonly
      // add their own—while a called macro/function still needs the usual
      // name-before-`(` pattern
      { type: 'function', regex: /(?<=\|\s*)[a-zA-Z_][a-zA-Z0-9_]*|\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g },
      { type: 'operator', regex: /={2,3}|!={1,2}|<=|>=|<|>|\*\*|\/\/|[+\-*/%~]/g },
      { type: 'punctuation', regex: /[()[\].,|]/g }
    ],

    diff: [
      { type: 'comment', regex: /^(?:diff --git .*|index [0-9a-f]+\.\.[0-9a-f]+.*|--- .*|\+\+\+ .*)$/gm },
      { type: 'keyword', regex: /^@@.*@@.*$/gm },
      { type: 'string', regex: /^\+.*$/gm },
      { type: 'tag', regex: /^-.*$/gm }
    ],

    http: [
      { type: 'keyword', regex: /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\b/gm },
      { type: 'number', regex: /(?<=^HTTP\/[0-9.]+\s)\d{3}\b/gm },
      { type: 'string', regex: /(?<=^HTTP\/[0-9.]+\s\d{3}\s).+$/gm },
      { type: 'path', regex: /(?<=^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|CONNECT|TRACE)\s)\S+/gm },
      { type: 'builtin', regex: /\bHTTP\/[0-9.]+\b/g },
      { type: 'property', regex: /^[A-Za-z][A-Za-z0-9-]*(?=:)/gm },
      { type: 'string', regex: /(?<=^[A-Za-z][A-Za-z0-9-]*:\s).+$/gm },
      { type: 'punctuation', regex: /[:/]/g }
    ],

    apacheconf: [
      { type: 'comment', regex: /#.*$/gm },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'tag', regex: /<\/?[A-Za-z][A-Za-z0-9]*/g },
      { type: 'variable', regex: /[$%]\{[^}]*\}|\$\d+|%\d+/g },
      { type: 'flag', regex: /\[[^\]\n]*\]/g },
      { type: 'keyword', regex: /^\s*(?:AddCharset|AddDefaultCharset|AddEncoding|AddHandler|AddLanguage|AddOutputFilter|AddOutputFilterByType|AddType|Allow|AllowOverride|AuthName|AuthType|AuthUserFile|CheckSpelling|ContentDigest|Deny|DefaultLanguage|Deflate|DirectoryIndex|DocumentRoot|ErrorDocument|ErrorLog|FileETag|Header|IndexIgnore|Listen|LoadModule|Options|Order|Redirect|RedirectMatch|Require|RewriteBase|RewriteCond|RewriteEngine|RewriteRule|SSLEngine|ServerAdmin|ServerAlias|ServerName|SetEnv|SetEnvIf|SetEnvIfNoCase)\b/gm },
      { type: 'number', regex: /\b\d+\b/g },
      { type: 'punctuation', regex: /[<>/=]/g }
    ]
  };

  // Aliases: same tokenizer, different `language-*` class name
  languages.xml = languages.html;
  languages.md = languages.markdown;
  languages.py = languages.python;
  languages.bash = languages.shell;
  languages.njk = languages.nunjucks;
  languages.patch = languages.diff;

  // Tokenize source code and return flat token list
  function tokenize(source, lang) {
    const patterns = languages[lang];
    if (!patterns) {
      return [];
    }

    // Collect all matches with positions
    const matches = [];

    for (const { type, regex } of patterns) {
      const re = new RegExp(regex.source, regex.flags);
      let match;

      while ((match = re.exec(source)) !== null) {
        matches.push({
          type,
          start: match.index,
          end: match.index + match[0].length
        });
      }
    }

    // Sort by start position, then by longer match first
    matches.sort((a, b) => a.start - b.start || b.end - a.end);

    // Remove overlapping matches (keep first/longest)
    const tokens = [];
    let lastEnd = 0;

    for (const m of matches) {
      if (m.start >= lastEnd) {
        tokens.push(m);
        lastEnd = m.end;
      }
    }

    return tokens;
  }

  // Languages considered by `detectLanguage`—canonical names only (aliases
  // share a tokenizer with one of these, so scoring them separately would
  // just duplicate a result already covered here).
  //
  // `html` and `apacheconf` are deliberately absent: `detectLanguage` checks
  // both ahead of this list, and returns immediately on a match—by the time
  // this list is consulted, both have already scored below threshold.
  const DETECTABLE_LANGUAGES = [
    'markdown', 'css', 'js', 'ts', 'python', 'php', 'shell', 'json', 'yaml', 'sql', 'nunjucks', 'diff', 'http'
  ];

  // A guess only counts if tokens cover at least this fraction of the
  // source—low enough to catch short snippets, high enough to leave
  // prose-like text (where a stray symbol or two might match) alone
  const MIN_DETECTION_SCORE = 0.3;

  // `operator`/`punctuation`/`number` tokens are common to nearly any text
  // (a bare `<`/`>`/`=`—needed so real comparisons like `a < b` highlight—
  // matches constantly inside HTML’s angle brackets; digits show up
  // everywhere) and carry little language-specific signal on their own, so
  // they only count for a quarter of their length toward a detection score
  const WEAK_DETECTION_TYPES = new Set(['operator', 'punctuation', 'number']);

  // Many token types are themselves common to more than one language (an
  // `attribute`-looking `word=value` shows up in shell/ini/vi syntax too, not
  // just HTML) and several keyword lists include short, ordinary English
  // words (`set`, `get`, `is`, `as`, `type`, `def`…) that collide with prose
  // or other languages’ syntax. So a language is only eligible for detection
  // if the source also contains at least one token from a narrower,
  // far-less-ambiguous set—either a distinctive token type, or (for
  // languages whose keyword lists are prose-prone) a specific keyword text.
  // `types` trusts any token of that type as strong evidence (safe for
  // types whose pattern is already symbol-anchored—`$var`, `HTTP/1.1`,
  // `"key":`—rather than a bare word). `words` is for token types whose
  // full list is prose-prone (Python’s builtins include ordinary words like
  // `set`, `list`, `open`) but that still have a distinctive core subset.
  // Real, unambiguous CSS pseudo-classes/elements—used to gate `:word`
  // selector matches, since the bare pattern also matches vi commands
  // (`:set`) and colons inside unrelated quoted strings
  // (`'lighthouse:default'`).
  const CSS_PSEUDO = new Set([
    'hover', 'focus', 'focus-visible', 'focus-within', 'active', 'visited', 'link', 'target',
    'disabled', 'enabled', 'checked', 'indeterminate', 'required', 'optional', 'valid', 'invalid',
    'read-only', 'read-write', 'placeholder-shown', 'default', 'first', 'last', 'only', 'empty',
    'root', 'before', 'after', 'first-line', 'first-letter', 'selection', 'placeholder', 'marker',
    'backdrop', 'host', 'not', 'is', 'where', 'has', 'first-child', 'last-child', 'only-child',
    'nth-child', 'nth-last-child', 'first-of-type', 'last-of-type', 'only-of-type', 'nth-of-type',
    'nth-last-of-type', 'lang', 'dir', 'scope', 'defined', 'fullscreen', 'in-range', 'out-of-range'
  ]);

  // A `.`/`#`-prefixed match is only trustworthy as a selector when
  // nothing that looks like an identifier sits directly before it—real CSS
  // selectors are preceded by whitespace, a combinator, or nothing, never by
  // a bare word character. Left unguarded, this pattern matches JS/Python
  // property/method-access chains identically (`values.slice`, `a.data`),
  // which is what mistagged two real ESLint/Eleventy config snippets as CSS.
  function isStrongCssSelector(token, source) {
    const text = source.slice(token.start, token.end);
    if (text[0] === ':') {
      return CSS_PSEUDO.has(text.slice(1).toLowerCase());
    }
    if (text[0] === '.' || text[0] === '#') {
      // `)`/`]` also disqualify: A chained call/index like `.slice().sort()`
      // or `arr[0].sort()` puts one of those directly before the next dot,
      // same as `values.slice` does—still a property-access chain, not a
      // selector (a real compound selector like `a[href].active` immediately
      // after `]` exists but is markedly rarer than JS chaining in practice)
      const before = token.start > 0 ? source[token.start - 1] : '';
      return !/[a-zA-Z0-9_)\]]/.test(before);
    }
    // No prefix character: the bare-type-selector-before-`{` pattern,
    // already gated by requiring a real `{` to follow
    return true;
  }

  const STRONG_SIGNAL = {
    html: { types: ['tag', 'entity', 'doctype'] },
    markdown: { types: ['keyword'] },
    css: { custom: (tokens, source) => tokens.some((t) => t.type === 'selector' && isStrongCssSelector(t, source)) },
    // No bare `string` or `function` type here: A quoted value alone is far
    // too common outside JS/TS (HTML attributes, config values, …) to count
    // as distinctive on its own—see the `.htaccess` `Header … "default-src
    // 'self'"` case this guarded against—and neither is a bare call
    // expression (`foo(1); bar(2);`), which is generic enough to appear in
    // many languages. A curated keyword remains the signal.
    js: { words: { keyword: new Set([
      'function', 'const', 'let', 'var', 'class', 'import', 'export', 'async', 'await',
      'return', 'typeof', 'instanceof', 'extends'
    ]) } },
    ts: { words: { keyword: new Set([
      'function', 'const', 'let', 'var', 'interface', 'class', 'import', 'export',
      'async', 'await', 'return', 'typeof', 'instanceof', 'extends', 'implements'
    ]) } },
    python: { words: {
      keyword: new Set(['def', 'import', 'class', 'lambda', 'elif', 'except', 'yield', 'raise', 'nonlocal', 'assert']),
      builtin: new Set(['isinstance', 'enumerate', 'StopIteration', 'ValueError', 'TypeError', 'KeyError', 'IndexError'])
    } },
    php: { types: ['variable'] },
    shell: { types: ['command', 'flag', 'variable'] },
    json: { types: ['property'] },
    yaml: { types: ['property'] },
    // SQL’s keyword pattern matches case-insensitively (real SQL is often
    // written in lowercase), so a naive “the keyword list is already
    // distinctive” assumption missed that several entries are ordinary
    // English/config words too (e.g., an Apache `Header always SET …`
    // directive). `caseInsensitiveWords` compares both sides upper-cased so
    // this still matches real lowercase SQL.
    sql: { words: { keyword: new Set([
      'SELECT', 'INSERT', 'DELETE', 'CREATE', 'ALTER', 'DROP', 'JOIN', 'DISTINCT',
      'UNION', 'PRIMARY', 'FOREIGN', 'REFERENCES', 'CONSTRAINT', 'PROCEDURE', 'TRIGGER', 'DECLARE'
    ]) }, caseInsensitiveWords: true },
    // `nunjucks`’s `keyword` type also carries plain English words (`for`,
    // `in`, `and`…), so it can’t be trusted wholesale like `diff`/`markdown`
    // above—only a comment, or a `keyword` token that’s actually one of the
    // `{{`/`}}`/`{%`/`%}` delimiters, is distinctive enough to count
    nunjucks: { custom: (tokens, source) => tokens.some((t) => (
      t.type === 'comment' || (t.type === 'keyword' && source.slice(t.start, t.end).startsWith('{'))
    )) },
    diff: { types: ['comment', 'keyword'] },
    http: { types: ['builtin'] },
    // `types: ['keyword']` is safe here (unlike js/python) because the
    // `keyword` pattern is the curated directive list already, not a
    // broad word list. `tag` is narrowed to actual Apache section names—
    // left as a bare type, it’d match any `<word>`, including a real
    // `<script>`, and win detection away from genuinely embedded HTML.
    apacheconf: { types: ['keyword'], words: { tag: new Set([
      'IfModule', 'Directory', 'Files', 'FilesMatch', 'Location', 'VirtualHost', 'LimitExcept'
    ]) } }
  };

  function hasStrongSignal(tokens, source, lang) {
    const spec = STRONG_SIGNAL[lang];
    if (!spec) {
      return true;
    }
    if (spec.custom) {
      return spec.custom(tokens, source);
    }
    return tokens.some((t) => {
      if (spec.types && spec.types.includes(t.type)) {
        return true;
      }
      if (spec.words && spec.words[t.type]) {
        // `tag` matches include the leading `<`/`</`—strip it so curated
        // tag-name sets (e.g., apacheconf’s section names) can list bare names
        const text = source.slice(t.start, t.end).replace(t.type === 'tag' ? /^<\/?/ : /^/, '');
        return spec.words[t.type].has(spec.caseInsensitiveWords ? text.toUpperCase() : text);
      }
      return false;
    });
  }

  // Scores how much of `source` a language’s tokenizer accounts for, as a
  // weighted fraction of its length—reuses `tokenize` rather than a separate
  // detection grammar, so detection can’t drift out of sync with highlighting
  function scoreLanguage(source, lang) {
    const tokens = tokenize(source, lang);
    if (tokens.length === 0 || !hasStrongSignal(tokens, source, lang)) {
      return 0;
    }

    const covered = tokens.reduce((sum, t) => {
      const length = t.end - t.start;
      return sum + (WEAK_DETECTION_TYPES.has(t.type) ? length * 0.25 : length);
    }, 0);
    return covered / source.length;
  }

  // Guesses a language for `source`, or returns `null` if nothing clears
  // `MIN_DETECTION_SCORE`. Only used for `pre > code` elements that don’t
  // already carry a `language-*` class—see `highlightAll`’s `data-autodetect`
  // opt-in
  function detectLanguage(source) {
    // An Apache directive keyword (`RewriteEngine`, `AddCharset`…) is a much
    // more specific signal than a generic angle-bracket tag—and Apache’s
    // `<IfModule>`/`<Directory>` sections are themselves angle-bracket
    // syntax indistinguishable from HTML tags by this tokenizer—so
    // `apacheconf` is checked, and wins outright, before `html`’s own
    // priority check below gets a chance to claim the tags as HTML
    if (scoreLanguage(source, 'apacheconf') >= MIN_DETECTION_SCORE) {
      return 'apacheconf';
    }

    // Real markup tags are decisive: A `<script>`/`<style>` element commonly
    // embeds genuine JS/CSS, which can otherwise out-score `html` on raw
    // token coverage—but the source is still fundamentally HTML, elements and
    // all, so `html` wins outright whenever it clears its own bar, before
    // comparing it against anything else
    if (scoreLanguage(source, 'html') >= MIN_DETECTION_SCORE) {
      // `html`/`xml` share a tokenizer (same markup, same tags/attributes/
      // entities), so scoring can’t tell them apart—but an XML declaration
      // is something HTML never has, so it settles which class name is the
      // more accurate one to write (e.g., an RSS feed, an SVG document)
      return /<\?xml\s/.test(source) ? 'xml' : 'html';
    }

    let best = null;
    // Starts below `MIN_DETECTION_SCORE` (rather than at it) so a language
    // scoring exactly the threshold still qualifies here
    let bestScore = MIN_DETECTION_SCORE - Number.EPSILON;

    for (const lang of DETECTABLE_LANGUAGES) {
      const score = scoreLanguage(source, lang);
      if (score > bestScore) {
        bestScore = score;
        best = lang;
      }
    }

    return best;
  }

  // Collect `StaticRanges` by token type for a single element into a shared map
  function collectRanges(element, rangesByType, langOverride) {
    const textNode = element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const lang = langOverride || (element.className.match(/language-(\w+)/) || [])[1];
    if (!lang || !languages[lang]) {
      return;
    }

    const source = textNode.textContent;
    const tokens = tokenize(source, lang);

    for (const token of tokens) {
      const range = new StaticRange({
        startContainer: textNode,
        startOffset: token.start,
        endContainer: textNode,
        endOffset: token.end
      });

      if (!rangesByType.has(token.type)) {
        rangesByType.set(token.type, []);
      }
      rangesByType.get(token.type).push(range);
    }
  }

  // Highlight all code elements with a language class, plus—if the host
  // script carries a `data-autodetect` attribute—`pre > code` elements that
  // don’t (opt-in: unlike class-based highlighting, a guess can be wrong,
  // so this shouldn’t change behavior for existing adopters by default)
  function highlightAll() {
    CSS.highlights.clear();

    const rangesByType = new Map();
    document.querySelectorAll('code[class*="language-"]').forEach((element) => {
      collectRanges(element, rangesByType);
    });

    const autoDetect = currentScript && currentScript.hasAttribute('data-autodetect');
    if (autoDetect) {
      document.querySelectorAll('pre > code:not([class*="language-"])').forEach((element) => {
        const textNode = element.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
          return;
        }
        const lang = detectLanguage(textNode.textContent);
        if (lang) {
          collectRanges(element, rangesByType, lang);
        }
      });
    }

    for (const [type, ranges] of rangesByType) {
      CSS.highlights.set(type, new Highlight(...ranges));
    }
  }

  // Run on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', highlightAll);
  } else {
    highlightAll();
  }

  // Expose for manual use (e.g., re-highlighting after dynamic content
  // changes, or reusing the same heuristic to tag a backlog of code blocks
  // with an explicit `language-*` class ahead of time instead of relying on
  // `data-autodetect` at runtime)
  window.syntaxp = { highlightAll, detectLanguage };
})();
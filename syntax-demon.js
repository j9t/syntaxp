/**
 * Syntax Demon: Code Highlighting via the CSS Custom Highlight API.
 * Zero-dependency syntax highlighting. No `<span>` elements, no DOM manipulation.
 * Falls back gracefully in unsupported browsers.
 */

(function () {
  'use strict';

  if (!CSS.highlights) {
    return;
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

    css: [
      { type: 'comment', regex: /\/\*[\s\S]*?\*\//g },
      { type: 'string', regex: /"[^"]*"|'[^']*'/g },
      { type: 'number', regex: /\b\d+(\.\d+)?(px|em|rem|%|vh|vw|s|ms|deg|fr)?\b/g },
      { type: 'keyword', regex: /@(media|import|keyframes|font-face|supports|charset|namespace|layer|property)\b/g },
      { type: 'selector', regex: /[.#:][a-zA-Z_-][a-zA-Z0-9_-]*/g },
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
      { type: 'function', regex: /\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*[<(])/g },
      { type: 'type', regex: /\b(string|number|boolean|bigint|symbol|object|Array|Promise|Record|Partial|Required|Pick|Omit|Exclude|Extract|NonNullable|ReturnType|Parameters|ConstructorParameters|InstanceType)\b/g },
      { type: 'operator', regex: /[=!<>]=?=?|&&|\|\||[+\-*/%]=?|\?\?|\.\.\.|=>/g },
      { type: 'punctuation', regex: /[{}[\]();:,.]/g }
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

    python: [
      { type: 'comment', regex: /#.*$/gm },
      { type: 'string', regex: /(?:[rRbBfFuU]{1,2})?("""[\s\S]*?"""|'''[\s\S]*?''')|(?:[rRbBfFuU]{1,2})?"(?:[^"\\]|\\.)*"|(?:[rRbBfFuU]{1,2})?'(?:[^'\\]|\\.)*'/g },
      { type: 'keyword', regex: /^\s*@[a-zA-Z_][a-zA-Z0-9_.]*|\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b/gm },
      { type: 'builtin', regex: /\b(?:print|len|range|str|int|float|bool|list|dict|set|tuple|type|isinstance|super|self|enumerate|zip|map|filter|sorted|reversed|open|input|format|repr|iter|next|abs|min|max|sum|any|all|Exception|ValueError|TypeError|KeyError|IndexError|StopIteration)\b/g },
      { type: 'number', regex: /\b\d+(\.\d+)?([eE][+-]?\d+)?[jJ]?\b/g },
      { type: 'function', regex: /\b[a-zA-Z_][a-zA-Z0-9_]*(?=\s*\()/g },
      { type: 'operator', regex: /[=!<>]=?|\*\*=?|\/\/=?|[+\-%]=?|->|:=/g },
      { type: 'punctuation', regex: /[{}[\]();,:.]/g }
    ],

    diff: [
      { type: 'comment', regex: /^(?:diff --git .*|index [0-9a-f]+\.\.[0-9a-f]+.*|--- .*|\+\+\+ .*)$/gm },
      { type: 'keyword', regex: /^@@.*@@.*$/gm },
      { type: 'string', regex: /^\+.*$/gm },
      { type: 'tag', regex: /^-.*$/gm }
    ]
  };

  // Aliases: same tokenizer, different `language-*` class name
  languages.bash = languages.shell;
  languages.xml = languages.html;
  languages.py = languages.python;
  languages.md = languages.markdown;
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

  // Collect `StaticRanges` by token type for a single element into a shared map
  function collectRanges(element, rangesByType) {
    const textNode = element.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
      return;
    }

    const lang = (element.className.match(/language-(\w+)/) || [])[1];
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

  // Highlight all code elements with a language class
  function highlightAll() {
    CSS.highlights.clear();

    const rangesByType = new Map();
    document.querySelectorAll('code[class*="language-"]').forEach((element) => {
      collectRanges(element, rangesByType);
    });

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

  // Expose for manual use (e.g., re-highlighting after dynamic content changes)
  window.SyntaxDemon = { highlightAll };
})();
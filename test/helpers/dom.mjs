// A minimal fake of the browser APIs syntax-demon.js touches (CSS Custom
// Highlight API, a handful of DOM methods), just enough to run the real
// script in Node via vm and inspect what it did.

import vm from 'node:vm';

export function runSyntaxDemon(jsSource, { codeSamples = [], currentScriptNonce } = {}) {
  const elements = codeSamples.map(({ className, text }) => ({
    className,
    firstChild: { nodeType: 3, textContent: text }
  }));

  const styleElements = [];
  const highlightsByType = new Map();
  const listeners = {};

  const sandbox = {
    CSS: {
      highlights: {
        clear() {
          highlightsByType.clear();
        },
        set(type, highlight) {
          highlightsByType.set(type, highlight.ranges);
        }
      }
    },
    document: {
      readyState: 'complete',
      currentScript: currentScriptNonce ? { nonce: currentScriptNonce } : null,
      head: {
        appendChild(el) {
          styleElements.push(el);
        }
      },
      createElement(tag) {
        return { tagName: tag, textContent: '', nonce: '' };
      },
      querySelectorAll(selector) {
        return selector.includes('language-') ? elements : [];
      },
      addEventListener(name, fn) {
        listeners[name] = fn;
      }
    },
    window: {},
    Node: { TEXT_NODE: 3 },
    StaticRange: class {
      constructor(options) {
        Object.assign(this, options);
      }
    },
    Highlight: class {
      constructor(...ranges) {
        this.ranges = ranges;
      }
    },
    console
  };

  vm.createContext(sandbox);
  vm.runInContext(jsSource, sandbox);

  return { styleElements, highlightsByType, window: sandbox.window, listeners };
}

// Flattens the {type -> StaticRange[]} map from one `runSyntaxDemon` call
// into a single array of {type, text} tokens, in source order, given the
// source text they were tokenized from.
export function tokensFor(text, highlightsByType) {
  const tokens = [];
  for (const [type, ranges] of highlightsByType) {
    for (const range of ranges) {
      tokens.push({
        type,
        start: range.startOffset,
        text: text.slice(range.startOffset, range.endOffset)
      });
    }
  }
  tokens.sort((a, b) => a.start - b.start);
  return tokens.map(({ type, text }) => ({ type, text }));
}

// True if `text` produces the exact same `{type, text}` token sequence under
// both language classes—used to verify aliases behave identically without
// reaching into the module’s private `languages` table.
export function sameHighlighting(jsSource, text, classNameA, classNameB) {
  const a = runSyntaxDemon(jsSource, { codeSamples: [{ className: classNameA, text }] });
  const b = runSyntaxDemon(jsSource, { codeSamples: [{ className: classNameB, text }] });
  const tokensA = tokensFor(text, a.highlightsByType);
  const tokensB = tokensFor(text, b.highlightsByType);
  return JSON.stringify(tokensA) === JSON.stringify(tokensB);
}
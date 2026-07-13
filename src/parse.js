// Source: https://github.com/eurosky-social/eurosky-social-app/blob/eurosky/fork/src/lib/code/parse.ts

/**
 * Splits a run of post text into plain text, inline code (`code`) and fenced
 * code blocks (```lang\n...```). Used by `#/components/RichTextCode` to render
 * Markdown-style code in post bodies.
 *
 * Intentionally small and forgiving: only balanced delimiters become code, so
 * stray or unmatched backticks render as literal text. A single-line triple
 * fence (```code```) is treated as inline code, since highlighting one line adds
 * nothing; only multi-line fences become highlighted blocks.
 */

// Order matters: the multi-line fence alternative must precede the single-line
// one so a fenced block is never mis-split.
//   1. ```lang\n body \n```   -> multi-line block (group 1 = lang, group 2 = body)
//   2. ```inline```           -> single-line triple (group 3)
//   3. `inline`               -> inline (group 4)
// The info string (group 1) is everything up to the first newline, so labels
// with non-word chars or trailing space (`c++`, `c#`, `ts `) still match and
// render as a block; the label is trimmed before language lookup.
const CODE_RE = /```([^\n`]*)\n([\s\S]*?)\n?```|```([^\n`]+?)```|`([^`\n]+?)`/g;

export function parseCodeParts(text) {
  const parts = [];
  let last = 0;
  let match;
  CODE_RE.lastIndex = 0;
  while ((match = CODE_RE.exec(text))) {
    if (match.index > last) {
      parts.push({
        type: "text",
        value: text.slice(last, match.index),
        start: last,
        end: match.index,
      });
    }
    if (match[2] !== undefined) {
      parts.push({
        type: "fence",
        value: match[2],
        lang: match[1]?.trim() || undefined,
        start: match.index,
        end: CODE_RE.lastIndex,
      });
    } else {
      // Single-line triple (match[3]) and inline (match[4]) both render as
      // inline code.
      parts.push({
        type: "inline",
        value: match[3] ?? match[4],
        start: match.index,
        end: CODE_RE.lastIndex,
      });
    }
    last = CODE_RE.lastIndex;
  }
  if (last < text.length) {
    parts.push({
      type: "text",
      value: text.slice(last),
      start: last,
      end: text.length,
    });
  }
  return parts;
}

/** True if `text` contains at least one inline or fenced code span. */
export function hasCode(text) {
  CODE_RE.lastIndex = 0;
  const found = CODE_RE.test(text);
  CODE_RE.lastIndex = 0;
  return found;
}

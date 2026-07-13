// Source: https://github.com/eurosky-social/eurosky-social-app/blob/eurosky/fork/src/lib/code/highlight.ts

/**
 * Syntax highlighting via `lowlight` (highlight.js grammars).
 *
 * Lowlight returns a hast tree; we flatten that into lines
 * of scoped spans so the renderer owns all layout and theming. The `scope`
 * on each span is the highlight.js class with the `hljs-` prefix stripped
 * (e.g. `keyword`, `string`, `title.function_`).
 */

import { common, createLowlight } from "lowlight";

const lowlight = createLowlight(common);

const EXT_TO_LANG = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  c: "c",
  h: "c",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  cs: "csharp",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  php: "php",
  css: "css",
  scss: "scss",
  less: "less",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  json: "json",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  sql: "sql",
  md: "markdown",
  markdown: "markdown",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  lua: "lua",
  r: "r",
  pl: "perl",
  diff: "diff",
  patch: "diff",
  graphql: "graphql",
  gql: "graphql",
};

// Maps a code-fence info string (the bit after the opening ```, e.g. `ts`,
// `typescript`, `bash`) to a registered highlight.js language name, or undefined
// for auto-detection. Accepts both our extension aliases (`ts`) and full
// language names (`typescript`).
export function languageFromName(name) {
  const normalized = name?.trim().toLowerCase();
  if (!normalized) return undefined;
  const mapped = EXT_TO_LANG[normalized];
  if (mapped && lowlight.registered(mapped)) return mapped;
  if (lowlight.registered(normalized)) return normalized;
  return undefined;
}

function scopeFromClassName(className) {
  if (!Array.isArray(className)) return undefined;
  const parts = className.map(String);
  const hljs = parts.find((part) => part.startsWith("hljs-"));
  if (!hljs) return undefined;
  // e.g. ['hljs-title', 'function_'] -> 'title.function_'
  return [hljs.slice(5), ...parts.filter((part) => part !== hljs)].join(".");
}

function flatten(nodes, inherited, out) {
  for (const node of nodes) {
    if (node.type === "text") {
      out.push({ scope: inherited, value: node.value });
    } else if (node.type === "element") {
      const scope = scopeFromClassName(node.properties?.className) ?? inherited;
      flatten(node.children, scope, out);
    }
  }
}

// Candidate languages for auto-detection (no fence language given). Limiting
// the subset makes highlight.js's relevance scoring far more reliable on the
// short snippets typical of posts - without it, auto-detection over all ~37
// common grammars frequently mis-tags ordinary JS/TS as an obscure language.
// Ordered loosely by how common they are in posts.
const AUTO_SUBSET = [
  "typescript",
  "javascript",
  "python",
  "bash",
  "json",
  "yaml",
  "rust",
  "go",
  "java",
  "c",
  "cpp",
  "csharp",
  "ruby",
  "php",
  "sql",
  "xml",
  "css",
  "scss",
  "markdown",
  "kotlin",
  "swift",
  "lua",
  "diff",
  "graphql",
].filter((l) => lowlight.registered(l));

// Highlighting is pure in (code, language) and can run on the feed render path
// (a post with a fenced block re-highlights on every theme/layout/selection
// change). Cache results so repeated renders are a map lookup. Bounded with
// simple LRU eviction so long-lived sessions don't grow unbounded. Returned
// arrays are shared - callers must treat them as read-only (current ones do).
const CACHE_MAX = 128;
const cache = new Map();

/** Highlights `code` and splits it into lines of `{ scope, value }` spans. */
export function highlightToLines(rawCode, language) {
  // Normalize line endings so a stray \r doesn't survive into rendered lines
  // (we split on \n below); also collapses the cache key across CRLF/LF.
  const code = rawCode.replace(/\r\n?/g, "\n");
  const key = `${language ?? ""} ${code}`;
  const cached = cache.get(key);
  if (cached) {
    // Refresh recency.
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }

  let tree;
  try {
    tree =
      language && lowlight.registered(language)
        ? lowlight.highlight(language, code)
        : lowlight.highlightAuto(code, { subset: AUTO_SUBSET });
  } catch {
    // Unknown language or highlighter error: render as plain text.
    tree = { type: "root", children: [{ type: "text", value: code }] };
  }

  const spans = [];
  flatten(tree.children, undefined, spans);

  const lines = [[]];
  for (const span of spans) {
    const parts = span.value.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part)
        lines[lines.length - 1].push({ scope: span.scope, value: part });
    });
  }

  cache.set(key, lines);
  if (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  return lines;
}

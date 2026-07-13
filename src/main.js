import { Plugin, VirtualEl, flattenForScan } from "@impro.social/impro-plugin";
import { parseCodeParts, hasCode } from "./parse.js";
import { highlightToLines, languageFromName } from "./highlight.js";

function scopeClass(scope) {
  // 'title.function_' -> 'ch-title'; theme colors key off the top-level
  // highlight.js scope.
  return `ch-${scope.split(".")[0].replace(/[^a-z0-9_-]/gi, "")}`;
}

function inlineCodeNode(code) {
  return new VirtualEl("code").addClass("code-highlight-inline").setText(code);
}

function fenceNode(code, langName) {
  const pre = new VirtualEl("pre").addClass("code-highlight-fence");
  const codeEl = pre.createEl("code", { cls: "code-highlight-fence-code" });
  const lines = highlightToLines(code, languageFromName(langName));
  for (const line of lines) {
    const lineEl = codeEl.createDiv({ cls: "code-highlight-line" });
    for (const span of line) {
      const spanEl = lineEl.createSpan({ text: span.value });
      if (span.scope) spanEl.addClass(scopeClass(span.scope));
    }
  }
  return pre;
}

function transform(tokens, context) {
  const flat = flattenForScan(tokens);
  if (!hasCode(flat.text)) return tokens;

  // Truncated previews keep fences inline so line caps still apply.
  const blockMode = context.surface !== "truncated";
  const out = [];
  for (const part of parseCodeParts(flat.text)) {
    if (part.type === "text") {
      // Re-emit the original tokens covering this range unchanged, so
      // facets outside code spans stay live.
      out.push(...flat.tokensFor(part.start, part.end));
      continue;
    }
    // part.value comes from the flattened text, so any facet covered by the
    // code span is already demoted to its literal text (a URL in a fence
    // renders as inert source, not a link).
    if (part.type === "fence" && blockMode) {
      out.push({ type: "block", node: fenceNode(part.value, part.lang) });
    } else {
      out.push({ type: "inline", node: inlineCodeNode(part.value) });
    }
  }
  return out;
}

export default class CodeHighlightPlugin extends Plugin {
  onload() {
    this.registerRichTextTransform(transform);
  }
}

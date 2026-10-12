"use client";

import { useEffect, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";
import { fillTemplate, type TemplateVariable } from "@/lib/documentTemplates";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Variables offered in the "Insert variable" menu. */
  variableGroups: { title: string; variables: TemplateVariable[] }[];
  /** Values substituted into the live preview. Unfilled variables are highlighted. */
  previewValues: Record<string, string | undefined>;
  previewLabel?: string;
  minHeight?: number;
}

/** Highlights any {{variable}} left in rendered preview HTML. */
function highlightUnresolved(html: string) {
  return html.replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    '<mark style="background:rgba(199,154,59,0.22); color:#8a6416; border-radius:4px; padding:0 3px;">{{$1}}</mark>'
  );
}

export function MarkdownEditor({
  value,
  onChange,
  variableGroups,
  previewValues,
  previewLabel = "Preview",
  minHeight = 360,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isVariableMenuOpen, setIsVariableMenuOpen] = useState(false);

  useEffect(() => {
    if (!isVariableMenuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsVariableMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isVariableMenuOpen]);

  /** Replaces the current selection, keeping the textarea focused with the new selection. */
  function replaceSelection(build: (selected: string) => { text: string; selectFrom: number; selectTo: number }) {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const { text, selectFrom, selectTo } = build(value.slice(start, end));
    onChange(value.slice(0, start) + text + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + selectFrom, start + selectTo);
    });
  }

  function wrap(marker: string, placeholder: string) {
    replaceSelection((selected) => {
      const inner = selected || placeholder;
      return { text: `${marker}${inner}${marker}`, selectFrom: marker.length, selectTo: marker.length + inner.length };
    });
  }

  function prefixLines(prefixFor: (index: number) => string) {
    const el = textareaRef.current;
    if (!el) return;
    // Expand the selection to whole lines before prefixing.
    const lineStart = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    el.setSelectionRange(lineStart, el.selectionEnd);
    replaceSelection((selected) => {
      const text = (selected || "").split("\n").map((line, i) => `${prefixFor(i)}${line}`).join("\n");
      return { text, selectFrom: text.length, selectTo: text.length };
    });
  }

  function insertLink() {
    replaceSelection((selected) => {
      const label = selected || "link text";
      const text = `[${label}](https://)`;
      return { text, selectFrom: label.length + 3, selectTo: text.length - 1 };
    });
  }

  function insertVariable(key: string) {
    setIsVariableMenuOpen(false);
    replaceSelection(() => {
      const text = `{{${key}}}`;
      return { text, selectFrom: text.length, selectTo: text.length };
    });
  }

  const previewHtml = highlightUnresolved(renderMarkdown(fillTemplate(value, previewValues)));

  const toolButton = "h-8 min-w-8 px-2 rounded-md text-sm text-text-muted hover:bg-black/[0.05] hover:text-text transition-colors";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: "1.5px solid rgba(0,0,0,0.1)" }}>
        <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5" style={{ borderBottom: "1px solid rgba(0,0,0,0.08)", backgroundColor: "#F8F8F6" }}>
          <button type="button" className={`${toolButton} font-bold`} onClick={() => wrap("**", "bold text")} title="Bold" aria-label="Bold">B</button>
          <button type="button" className={`${toolButton} italic`} onClick={() => wrap("*", "italic text")} title="Italic" aria-label="Italic">I</button>
          <button type="button" className={toolButton} onClick={() => prefixLines(() => "## ")} title="Heading" aria-label="Heading">H</button>
          <button type="button" className={toolButton} onClick={() => prefixLines(() => "- ")} title="Bulleted list" aria-label="Bulleted list">• List</button>
          <button type="button" className={toolButton} onClick={() => prefixLines((i) => `${i + 1}. `)} title="Numbered list" aria-label="Numbered list">1. List</button>
          <button type="button" className={toolButton} onClick={insertLink} title="Link" aria-label="Link">Link</button>
          <div ref={menuRef} className="relative ml-auto">
            <button
              type="button"
              onClick={() => setIsVariableMenuOpen((v) => !v)}
              aria-expanded={isVariableMenuOpen}
              className="h-8 px-3 rounded-md text-xs font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#114E3B", color: "#fff" }}
            >
              {"{ }"} Insert variable
            </button>
            {isVariableMenuOpen && (
              <div
                className="absolute right-0 mt-1.5 w-80 max-h-80 overflow-y-auto bg-white rounded-xl shadow-lg z-20 py-1"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
              >
                {variableGroups.map((group) => (
                  <div key={group.title}>
                    <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "#999" }}>{group.title}</p>
                    {group.variables.map((v) => (
                      <button
                        key={v.key}
                        type="button"
                        onClick={() => insertVariable(v.key)}
                        className="w-full text-left px-3 py-1.5 hover:bg-black/[0.03] transition-colors"
                      >
                        <span className="block text-xs font-mono" style={{ color: "#114E3B" }}>{`{{${v.key}}}`}</span>
                        <span className="block text-xs" style={{ color: "#888" }}>{v.label}</span>
                      </button>
                    ))}
                  </div>
                ))}
                <p className="px-3 py-2 text-[11px] leading-snug" style={{ color: "#999", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                  You can also type your own, e.g. <span className="font-mono">{"{{dressCode}}"}</span> — staff fill it in before sending.
                </p>
              </div>
            )}
          </div>
        </div>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck
          className="flex-1 w-full px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none text-text resize-y"
          style={{ minHeight, backgroundColor: "#fff" }}
          aria-label="Document body (Markdown)"
        />
        <p className="px-3 py-1.5 text-[11px]" style={{ color: "#999", borderTop: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          **bold** · *italic* · ## heading · - list · [text](https://link) · links are detected automatically
        </p>
      </div>

      <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: "1.5px solid rgba(0,0,0,0.06)" }}>
        <p className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest" style={{ color: "#999", borderBottom: "1px solid rgba(0,0,0,0.06)", backgroundColor: "#F8F8F6" }}>
          {previewLabel}
        </p>
        <div
          className="flex-1 px-5 py-4 overflow-y-auto"
          style={{ minHeight, color: "#222", fontSize: 15, lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: previewHtml || '<p style="color:#aaa;">Nothing to preview yet.</p>' }}
        />
      </div>
    </div>
  );
}

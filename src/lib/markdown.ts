/**
 * Minimal, escape-first Markdown renderer for document templates.
 *
 * All input is HTML-escaped before any formatting is applied, so the output can
 * only ever contain the tags generated here — safe to use with
 * dangerouslySetInnerHTML and in outbound emails. Styles are inline so the same
 * HTML renders consistently in email clients and in the in-app preview.
 *
 * Supported: # / ## / ### headings, **bold**, *italic* / _italic_, [text](url),
 * bare http(s) URLs, - / * bullet lists, 1. numbered lists, --- rules, and
 * paragraphs (single newlines become line breaks).
 */

const LINK_STYLE = "color:#00733F; text-decoration:underline;";
const HEADING_STYLES: Record<number, string> = {
  1: "margin:0 0 16px 0; font-size:22px; line-height:1.3; color:#054B37;",
  2: "margin:24px 0 12px 0; font-size:18px; line-height:1.3; color:#054B37;",
  3: "margin:20px 0 8px 0; font-size:16px; line-height:1.3; color:#222222;",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(rawUrl: string): string | null {
  // rawUrl is already HTML-escaped; only allow web and mail links.
  return /^(https?:\/\/|mailto:)/i.test(rawUrl) ? rawUrl : null;
}

function renderInline(text: string): string {
  // Links are swapped for placeholders first so the bare-URL pass and the
  // emphasis passes can't rewrite their markup.
  const tokens: string[] = [];
  const stash = (html: string) => `\u0000${tokens.push(html) - 1}\u0000`;

  let out = escapeHtml(text);

  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, url: string) => {
    const href = safeHref(url);
    return href ? stash(`<a href="${href}" style="${LINK_STYLE}">${label}</a>`) : match;
  });

  out = out.replace(/\bhttps?:\/\/[^\s<]+[^\s<.,;:!?)]/g, (url) =>
    stash(`<a href="${url}" style="${LINK_STYLE}">${url}</a>`)
  );

  out = out
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/(^|[^\w])_(?!\s)(.+?)_(?!\w)/g, "$1<em>$2</em>");

  return out.replace(/\u0000(\d+)\u0000/g, (_, i: string) => tokens[Number(i)]);
}

export function renderMarkdown(markdown: string): string {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const html: string[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p style="margin:0 0 14px 0;">${paragraph.map(renderInline).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    const tag = list.ordered ? "ol" : "ul";
    html.push(
      `<${tag} style="margin:0 0 14px 0; padding-left:22px;">${list.items
        .map((item) => `<li style="margin:0 0 4px 0;">${renderInline(item)}</li>`)
        .join("")}</${tag}>`
    );
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      html.push(`<h${level} style="${HEADING_STYLES[level]}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flushParagraph();
      flushList();
      html.push(`<hr style="border:none; border-top:1px solid #e5e5e5; margin:20px 0;" />`);
      continue;
    }

    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const ordered = !!numbered;
      if (list && list.ordered !== ordered) flushList();
      if (!list) list = { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flushParagraph();
  flushList();
  return html.join("\n");
}

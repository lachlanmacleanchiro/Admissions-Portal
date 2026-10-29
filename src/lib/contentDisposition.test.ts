import { test } from "node:test";
import assert from "node:assert/strict";
import { buildContentDisposition, safeContentType } from "./contentDisposition";

test("SVG (which can carry script) is never served inline", () => {
  assert.match(buildContentDisposition("x.svg", "image/svg+xml"), /^attachment;/);
  assert.match(buildContentDisposition("x.html", "text/html"), /^attachment;/);
});

test("safeContentType ignores an untrusted declared type outside the allowlist", () => {
  assert.equal(safeContentType("image/svg+xml", "x.svg"), "application/octet-stream");
  assert.equal(safeContentType("text/html", "x.pdf"), "application/pdf");
  assert.equal(safeContentType("image/png", "x.png"), "image/png");
  assert.equal(safeContentType(undefined, "x.docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.equal(safeContentType(undefined, "x.exe"), "application/octet-stream");
});

test("PDF and images are inline", () => {
  assert.match(buildContentDisposition("a.pdf", "application/pdf"), /^inline;/);
  assert.match(buildContentDisposition("a.png", "image/png"), /^inline;/);
});

test("Word documents download as attachments with their real name", () => {
  const v = buildContentDisposition("Acceptance receipt YR 13 (UE note).docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  assert.match(v, /^attachment;/);
  assert.ok(v.includes('filename="Acceptance receipt YR 13 (UE note).docx"'));
  assert.ok(v.includes("filename*=UTF-8''Acceptance%20receipt%20YR%2013%20%28UE%20note%29.docx"));
});

test("quotes and non-ASCII are made safe in the fallback but kept in filename*", () => {
  const v = buildContentDisposition('Māori "essay".docx', "application/msword");
  assert.ok(v.includes('filename="M_ori _essay_.docx"'));
  assert.ok(v.includes("filename*=UTF-8''M%C4%81ori%20%22essay%22.docx"));
});

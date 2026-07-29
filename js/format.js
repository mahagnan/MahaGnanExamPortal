// ============================================
// TEXT FORMAT HELPER
// Safely renders admin-authored question text:
// - Preserves line breaks (use CSS white-space: pre-wrap alongside this)
// - Supports **bold** markdown-style syntax
// - Escapes HTML first so nothing unsafe gets injected
// ============================================

export function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

export function formatQuestionText(raw) {
  const escaped = escapeHtml(raw);
  // **bold** -> <strong>bold</strong>
  return escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

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

/**
 * Normalizes a question doc to the { category, label, text } shape.
 * Supports old docs saved with the original fixed `type` field
 * ("interview" | "coding-easy" | "coding-hard") for backward compatibility.
 */
export function normalizeQuestion(q) {
  if (q.category && q.label) return q;
  if (q.type === "interview") return { ...q, category: "interview", label: "Interview" };
  if (q.type === "coding-easy") return { ...q, category: "coding", label: "Easy" };
  if (q.type === "coding-hard") return { ...q, category: "coding", label: "Hard" };
  return { ...q, category: q.category || "interview", label: q.label || "General" };
}

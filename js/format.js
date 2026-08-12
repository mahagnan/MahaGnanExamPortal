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
  let escaped = escapeHtml(raw);

  // Fenced code blocks: ```code``` (multi-line). Must run before everything else.
  escaped = escaped.replace(/```([\s\S]+?)```/g, (m, code) => `<pre class="q-code-block"><code>${code}</code></pre>`);

  // Note callouts: consecutive lines starting with "> " become a highlighted box.
  escaped = escaped.replace(/(^|\n)((?:&gt; ?.*(?:\n|$))+)/g, (m, lead, block) => {
    const lines = block.split("\n").filter(l => l.trim() !== "");
    const content = lines.map(l => l.replace(/^&gt; ?/, "")).join("<br>");
    return `${lead}<div class="q-note">${content}</div>`;
  });

  // Inline code: `code`
  escaped = escaped.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // Highlight: ==text==
  escaped = escaped.replace(/==(.+?)==/g, '<mark class="q-highlight">$1</mark>');

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  return escaped;
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

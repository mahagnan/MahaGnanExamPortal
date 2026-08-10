// ============================================
// CSV UTILS — tiny dependency-free CSV parser + MCQ row validator
// Handles quoted fields (with commas/newlines inside "...") and CRLF/LF.
// ============================================

/**
 * Parses raw CSV text into an array of row-arrays (strings).
 * Supports double-quoted fields, escaped quotes (""), commas/newlines inside quotes.
 */
export function parseCsv(rawText) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') { inQuotes = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
    field += c;
  }
  // flush trailing field/row (file may or may not end with newline)
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

  // drop fully-empty trailing rows
  return rows.filter(r => r.some(cell => String(cell).trim() !== ""));
}

/**
 * Expected header (case-insensitive, order-flexible):
 * question, option1, option2, option3, option4, correct
 * "correct" may be 1-4, A-D/a-d, or the exact text of the correct option.
 *
 * Returns { questions: [{text, options, correctIndex}], errors: ["Row 3: ..."] }
 */
export function parseMcqCsv(rawText) {
  const rows = parseCsv(rawText);
  const errors = [];
  const questions = [];

  if (rows.length === 0) {
    return { questions, errors: ["The file is empty."] };
  }

  const header = rows[0].map(h => h.trim().toLowerCase());
  const looksLikeHeader = header.some(h => h.includes("question")) && header.some(h => h.includes("correct"));
  const dataRows = looksLikeHeader ? rows.slice(1) : rows;
  const startRowNum = looksLikeHeader ? 2 : 1;

  let colIdx = { question: 0, option1: 1, option2: 2, option3: 3, option4: 4, correct: 5 };
  if (looksLikeHeader) {
    const find = (name) => header.findIndex(h => h === name || h.replace(/\s+/g, "") === name);
    colIdx = {
      question: find("question"),
      option1: find("option1") !== -1 ? find("option1") : find("optiona"),
      option2: find("option2") !== -1 ? find("option2") : find("optionb"),
      option3: find("option3") !== -1 ? find("option3") : find("optionc"),
      option4: find("option4") !== -1 ? find("option4") : find("optiond"),
      correct: find("correct") !== -1 ? find("correct") : find("correctanswer") !== -1 ? find("correctanswer") : find("answer")
    };
  }

  dataRows.forEach((r, i) => {
    const rowNum = startRowNum + i;
    const text = (r[colIdx.question] || "").trim();
    const options = [colIdx.option1, colIdx.option2, colIdx.option3, colIdx.option4].map(idx => (r[idx] || "").trim());
    const correctRaw = (r[colIdx.correct] || "").trim();

    if (!text) { errors.push(`Row ${rowNum}: missing question text — skipped.`); return; }
    if (options.some(o => !o)) { errors.push(`Row ${rowNum}: needs exactly 4 non-empty options — skipped.`); return; }
    if (!correctRaw) { errors.push(`Row ${rowNum}: missing correct-answer column — skipped.`); return; }

    let correctIndex = -1;
    if (/^[1-4]$/.test(correctRaw)) {
      correctIndex = Number(correctRaw) - 1;
    } else if (/^[a-dA-D]$/.test(correctRaw)) {
      correctIndex = correctRaw.toUpperCase().charCodeAt(0) - 65;
    } else {
      correctIndex = options.findIndex(o => o.toLowerCase() === correctRaw.toLowerCase());
    }

    if (correctIndex < 0 || correctIndex > 3) {
      errors.push(`Row ${rowNum}: correct answer "${correctRaw}" doesn't match 1-4, A-D, or one of the option texts — skipped.`);
      return;
    }

    questions.push({ text, options, correctIndex });
  });

  return { questions, errors };
}

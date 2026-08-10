// ============================================
// MCQ MODULE — question CRUD, exam duration setting, submission review
// ============================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ---------- Questions ----------

export async function addMcqQuestion({ text, options, correctIndex }) {
  await addDoc(collection(db, "mcqQuestions"), {
    text, options, correctIndex, createdAt: new Date().toISOString()
  });
}

export async function getAllMcqQuestions() {
  const snap = await getDocs(collection(db, "mcqQuestions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function updateMcqQuestion(id, { text, options, correctIndex }) {
  await updateDoc(doc(db, "mcqQuestions", id), { text, options, correctIndex });
}

export async function deleteMcqQuestion(id) {
  await deleteDoc(doc(db, "mcqQuestions", id));
}

/**
 * Deletes every MCQ question. Firestore batches are capped at 500 writes,
 * so this chunks the deletes automatically for large question banks.
 * Returns the number of questions deleted.
 */
export async function deleteAllMcqQuestions() {
  const snap = await getDocs(collection(db, "mcqQuestions"));
  const docs = snap.docs;
  const CHUNK = 450;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

/**
 * Bulk-adds MCQ questions (e.g. parsed from a CSV upload).
 * Each item: { text, options: [4 strings], correctIndex: 0-3 }.
 * Chunked into batches of 450 writes to stay under Firestore's 500 limit.
 * Returns the number of questions added.
 */
export async function bulkAddMcqQuestions(questions) {
  const CHUNK = 450;
  const now = new Date().toISOString();
  for (let i = 0; i < questions.length; i += CHUNK) {
    const batch = writeBatch(db);
    questions.slice(i, i + CHUNK).forEach(q => {
      const ref = doc(collection(db, "mcqQuestions"));
      batch.set(ref, {
        text: q.text,
        options: q.options,
        correctIndex: q.correctIndex,
        createdAt: now
      });
    });
    await batch.commit();
  }
  return questions.length;
}

// ---------- Duration setting (minutes) ----------

export async function getMcqDurationMinutes() {
  const snap = await getDoc(doc(db, "settings", "mcqDuration"));
  return snap.exists() ? Number(snap.data().minutes) || 30 : 30;
}

export async function setMcqDurationMinutes(minutes) {
  await setDoc(doc(db, "settings", "mcqDuration"), { minutes: Number(minutes) });
}

// ---------- Submissions ----------

export async function getAllMcqSubmissions() {
  const snap = await getDocs(collection(db, "mcqSubmissions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteMcqSubmission(studentId) {
  await deleteDoc(doc(db, "mcqSubmissions", studentId));
}

export async function clearMcqViolationImages(studentId) {
  await updateDoc(doc(db, "mcqSubmissions", studentId), { violationImages: [] });
}

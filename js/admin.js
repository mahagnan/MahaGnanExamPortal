// ============================================
// ADMIN HELPERS — question bank CRUD + submission review/grading
// ============================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, where
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function updateQuestion(id, { type, text }) {
  await updateDoc(doc(db, "questions", id), { type, text });
}

export async function deleteSubmission(studentId) {
  await deleteDoc(doc(db, "submissions", studentId));
}

// ---------- Questions ----------

export async function addQuestion({ type, text }) {
  await addDoc(collection(db, "questions"), { type, text, createdAt: new Date().toISOString() });
}

export async function getAllQuestions() {
  const snap = await getDocs(collection(db, "questions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteQuestion(id) {
  await deleteDoc(doc(db, "questions", id));
}

// ---------- Submissions ----------

export async function getAllSubmissions() {
  const snap = await getDocs(collection(db, "submissions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveGrade(studentId, questionId, marks, remarks) {
  await updateDoc(doc(db, "submissions", studentId), {
    [`grades.${questionId}`]: { marks, remarks }
  });
}

/** Removes the violationImages array from a submission (frees up space bookkeeping; delete actual files in Cloudinary dashboard). */
export async function clearViolationImages(studentId) {
  await updateDoc(doc(db, "submissions", studentId), { violationImages: [] });
}

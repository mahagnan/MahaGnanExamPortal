// ============================================
// ADMIN HELPERS — question bank CRUD + submission review/grading
// ============================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc, query, where, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export async function updateQuestion(id, { category, label, text, language }) {
  const data = { category, label, text };
  if (category === "coding") data.language = language || "any";
  else data.language = null;
  await updateDoc(doc(db, "questions", id), data);
}

export async function deleteSubmission(studentId) {
  await deleteDoc(doc(db, "submissions", studentId));
}

// ---------- Global results-publish switch ----------

export async function getResultsPublished() {
  const snap = await getDoc(doc(db, "settings", "resultsPublished"));
  return snap.exists() ? !!snap.data().value : false;
}

export async function setResultsPublished(value) {
  await setDoc(doc(db, "settings", "resultsPublished"), { value, updatedAt: new Date().toISOString() });
}

// ---------- Questions ----------

export async function addQuestion({ category, label, text, language }) {
  const data = { category, label, text, createdAt: new Date().toISOString() };
  if (category === "coding") data.language = language || "any";
  await addDoc(collection(db, "questions"), data);
}

/** Bulk-adds interview questions (e.g. parsed from a CSV upload). Each item: { label, text }. */
export async function bulkAddQuestions(items) {
  const CHUNK = 450;
  const now = new Date().toISOString();
  for (let i = 0; i < items.length; i += CHUNK) {
    const batch = writeBatch(db);
    items.slice(i, i + CHUNK).forEach(item => {
      const ref = doc(collection(db, "questions"));
      batch.set(ref, { category: "interview", label: item.label || "Interview", text: item.text, createdAt: now });
    });
    await batch.commit();
  }
  return items.length;
}

export async function getAllQuestions() {
  const snap = await getDocs(collection(db, "questions"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteQuestion(id) {
  await deleteDoc(doc(db, "questions", id));
}

/** Deletes every interview/coding question from the question bank. Returns the count deleted. */
export async function deleteAllQuestions() {
  const snap = await getDocs(collection(db, "questions"));
  const docs = snap.docs;
  const CHUNK = 450;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
}

// ---------- Allowed students (signup allowlist for bulk student management) ----------

export async function getAllowedStudents() {
  const snap = await getDocs(collection(db, "allowedStudents"));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addAllowedStudent(email) {
  await addDoc(collection(db, "allowedStudents"), { email: email.trim().toLowerCase(), addedAt: new Date().toISOString() });
}

export async function bulkAddAllowedStudents(emails) {
  const CHUNK = 450;
  const now = new Date().toISOString();
  for (let i = 0; i < emails.length; i += CHUNK) {
    const batch = writeBatch(db);
    emails.slice(i, i + CHUNK).forEach(email => {
      const ref = doc(collection(db, "allowedStudents"));
      batch.set(ref, { email: email.trim().toLowerCase(), addedAt: now });
    });
    await batch.commit();
  }
  return emails.length;
}

export async function deleteAllowedStudent(id) {
  await deleteDoc(doc(db, "allowedStudents", id));
}

export async function deleteAllAllowedStudents() {
  const snap = await getDocs(collection(db, "allowedStudents"));
  const docs = snap.docs;
  const CHUNK = 450;
  for (let i = 0; i < docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return docs.length;
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

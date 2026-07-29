// ============================================
// MCQ MODULE — question CRUD, exam duration setting, submission review
// ============================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc
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

// ============================================
// MCQ MODULE — question CRUD, exam duration setting, submission review
// ============================================
import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc, writeBatch, serverTimestamp
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

// ---------- Questions per attempt (randomized subset) ----------

/** Returns 0 if unset/disabled, meaning "use the full question bank". */
export async function getMcqQuestionsPerAttempt() {
  const snap = await getDoc(doc(db, "settings", "mcqQuestionsPerAttempt"));
  return snap.exists() ? Number(snap.data().count) || 0 : 0;
}

export async function setMcqQuestionsPerAttempt(count) {
  await setDoc(doc(db, "settings", "mcqQuestionsPerAttempt"), { count: Number(count) || 0 });
}

// ---------- Pass percentage (used for certificate wording + analytics) ----------

export async function getMcqPassPercent() {
  const snap = await getDoc(doc(db, "settings", "mcqPassPercent"));
  return snap.exists() ? Number(snap.data().value) || 50 : 50;
}

export async function setMcqPassPercent(value) {
  await setDoc(doc(db, "settings", "mcqPassPercent"), { value: Number(value) || 50 });
}

// ---------- Exam scheduling window ----------
// { enabled: bool, startTime: ISOString|null, endTime: ISOString|null }

export async function getMcqSchedule() {
  const snap = await getDoc(doc(db, "settings", "mcqSchedule"));
  return snap.exists() ? snap.data() : { enabled: false, startTime: null, endTime: null };
}

export async function setMcqSchedule({ enabled, startTime, endTime }) {
  await setDoc(doc(db, "settings", "mcqSchedule"), {
    enabled: !!enabled,
    startTime: startTime || null,
    endTime: endTime || null
  });
}

/** Checks the current window against `now`. Returns { open: bool, reason: "before"|"after"|null }. */
export function checkScheduleWindow(schedule, now = new Date()) {
  if (!schedule || !schedule.enabled) return { open: true, reason: null };
  if (schedule.startTime && now < new Date(schedule.startTime)) return { open: false, reason: "before" };
  if (schedule.endTime && now > new Date(schedule.endTime)) return { open: false, reason: "after" };
  return { open: true, reason: null };
}

let cachedClockOffsetMs = null;

/**
 * Estimates (Firestore server time - local device time) once per session, by writing
 * and immediately reading back a serverTimestamp(). This makes the schedule check much
 * harder to bypass just by changing a student's system clock — there's still some
 * network-latency jitter, but it's no longer trivially spoofable.
 * Requires a Firestore rule allowing signed-in users to write settings/_clockSync.
 */
export async function getServerTimeOffsetMs() {
  if (cachedClockOffsetMs !== null) return cachedClockOffsetMs;
  try {
    const ref = doc(db, "settings", "_clockSync");
    const before = Date.now();
    await setDoc(ref, { pingedAt: serverTimestamp() });
    const snap = await getDoc(ref);
    const after = Date.now();
    const serverMs = snap.data()?.pingedAt?.toMillis?.() ?? after;
    cachedClockOffsetMs = serverMs - (before + after) / 2;
  } catch (err) {
    console.warn("Clock sync failed — falling back to the device's local clock for scheduling.", err);
    cachedClockOffsetMs = 0;
  }
  return cachedClockOffsetMs;
}

/** Convenience wrapper: current time adjusted by the estimated server offset. */
export async function getTrustedNow() {
  const offset = await getServerTimeOffsetMs();
  return new Date(Date.now() + offset);
}

// ---------- Leaderboard toggle ----------

export async function getMcqLeaderboardEnabled() {
  const snap = await getDoc(doc(db, "settings", "mcqLeaderboardEnabled"));
  return snap.exists() ? !!snap.data().value : false;
}

export async function setMcqLeaderboardEnabled(value) {
  await setDoc(doc(db, "settings", "mcqLeaderboardEnabled"), { value: !!value });
}

/** Top N scorers among submitted (or auto-submitted) attempts, ranked by percentage then raw score. */
export async function getMcqLeaderboard(limitN = 10) {
  const subs = await getAllMcqSubmissions();
  return subs
    .filter(s => (s.status === "submitted" || s.status === "auto-submitted") && s.totalQuestions > 0)
    .map(s => ({ ...s, percent: (Number(s.score) || 0) / s.totalQuestions * 100 }))
    .sort((a, b) => b.percent - a.percent || (b.score || 0) - (a.score || 0))
    .slice(0, limitN);
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

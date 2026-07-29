// ============================================
// MCQ EXAM ENGINE
// Same proctoring model as exam.js (camera, fullscreen, strikes, snapshots)
// but auto-graded instantly — no manual grading needed.
// ============================================
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStudentProfile } from "./auth.js";
import { buildSessionFolder, uploadSnapshot, captureFrameAsBlob } from "./cloudinary.js";
import { loadFaceModels, monitorFrame } from "./face-detection.js";
import { formatQuestionText } from "./format.js";
import { getAllMcqQuestions, getMcqDurationMinutes } from "./mcq.js";

const MAX_STRIKES = 3;
const ROUTINE_CAPTURE_MS = 60 * 1000;
const MONITOR_INTERVAL_MS = 4000;
const EVENT_CAPTURE_COOLDOWN_MS = 15000;

let strikes = 0;
let uid, profile, sessionFolder;
let timeRemaining = 30 * 60;
let examTimerInterval, routineCaptureInterval, monitorInterval;
let videoEl;
let lastEventCaptureAt = 0;
let examEnded = false;
let questions = []; // { id, text, options: [4], correctIndex, displayOptions, indexMap }
let selectedAnswers = {}; // qid -> original option index
let submissionRef;

const els = {};

function cacheEls() {
  els.timer = document.getElementById("timer");
  els.strikeDots = document.querySelectorAll(".strike-dot");
  els.questionsContainer = document.getElementById("questionsContainer");
  els.alertOverlay = document.getElementById("alertOverlay");
  els.alertMessage = document.getElementById("alertMessage");
  els.submitBtn = document.getElementById("submitBtn");
  els.camMonitor = document.getElementById("camMonitor");
}

export async function initMcqExam() {
  cacheEls();
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "student-login.html"; return; }
    uid = user.uid;
    profile = await getStudentProfile(uid);
    sessionFolder = buildSessionFolder((profile?.name || "student") + "-mcq", uid);

    timeRemaining = (await getMcqDurationMinutes()) * 60;

    await startCamera();
    await loadFaceModels();
    await loadQuestionsShuffled();
    await initSubmissionDoc();
    renderQuestions();
    enterFullscreen();
    attachViolationListeners();
    startTimer();
    startRoutineCapture();
    startFaceMonitoring();
    attachAntiCheatBasics();
  });
}

async function startCamera() {
  videoEl = document.createElement("video");
  videoEl.autoplay = true;
  videoEl.muted = true;
  videoEl.playsInline = true;
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  videoEl.srcObject = stream;
  els.camMonitor.querySelector("video")?.remove();
  els.camMonitor.prepend(videoEl);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadQuestionsShuffled() {
  const all = await getAllMcqQuestions();
  const shuffledQuestions = shuffle(all);
  questions = shuffledQuestions.map(q => {
    const order = shuffle([0, 1, 2, 3]); // order[k] = original index shown at position k
    return {
      ...q,
      displayOptions: order.map(origIdx => q.options[origIdx]),
      indexMap: order
    };
  });
}

function renderQuestions() {
  els.questionsContainer.innerHTML = "";
  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    card.innerHTML = `
      <div class="q-meta">
        <span class="q-number">Q${idx + 1}</span>
        <span class="badge badge-green">MCQ</span>
      </div>
      <div class="q-text">${formatQuestionText(q.text)}</div>
      <div class="mcq-options">
        ${q.displayOptions.map((opt, k) => `
          <label style="display:flex; align-items:center; gap:10px; padding:10px 12px; border:1px solid var(--gray-line); border-radius:8px; margin-bottom:8px; cursor:pointer;">
            <input type="radio" name="mcq_${q.id}" value="${q.indexMap[k]}" style="width:auto;" />
            <span>${opt}</span>
          </label>
        `).join("")}
      </div>
    `;
    els.questionsContainer.appendChild(card);

    card.querySelectorAll(`input[name="mcq_${q.id}"]`).forEach(radio => {
      radio.addEventListener("change", async () => {
        selectedAnswers[q.id] = Number(radio.value);
        await updateDoc(submissionRef, { [`answers.${q.id}`]: Number(radio.value) });
      });
    });
  });
}

async function initSubmissionDoc() {
  submissionRef = doc(db, "mcqSubmissions", uid);
  const existing = await getDoc(submissionRef);
  if (!existing.exists()) {
    await setDoc(submissionRef, {
      studentId: uid,
      studentName: profile?.name || "",
      studentEmail: profile?.email || "",
      answers: {},
      violationCount: 0,
      status: "in-progress",
      startTime: serverTimestamp(),
      cloudinaryFolder: sessionFolder,
      violationImages: [],
      totalQuestions: questions.length
    });
  } else {
    await updateDoc(submissionRef, { totalQuestions: questions.length });
  }
}

function startTimer() {
  examTimerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) finalizeSubmit("time-up");
  }, 1000);
}

function updateTimerDisplay() {
  const h = String(Math.floor(timeRemaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((timeRemaining % 3600) / 60)).padStart(2, "0");
  const s = String(timeRemaining % 60).padStart(2, "0");
  els.timer.textContent = `${h}:${m}:${s}`;
}

function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

function attachViolationListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !examEnded) registerStrike("You switched tabs or minimized the window.");
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && !examEnded) registerStrike("You exited fullscreen mode.");
  });
  window.addEventListener("blur", () => {
    if (!examEnded) registerStrike("Exam window lost focus.");
  });
}

function attachAntiCheatBasics() {
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("paste", e => e.preventDefault());
  document.addEventListener("keydown", e => {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) || (e.ctrlKey && e.key === "u")) {
      e.preventDefault();
    }
  });
}

let strikeDebounce = false;
function registerStrike(reason) {
  if (strikeDebounce || examEnded) return;
  strikeDebounce = true;
  setTimeout(() => (strikeDebounce = false), 1500);

  strikes++;
  updateStrikeDots();
  updateDoc(submissionRef, { violationCount: strikes });
  captureEventSnapshot("violation_" + reason.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  showAlert(`Warning ${strikes} of ${MAX_STRIKES}: ${reason}`);

  if (strikes >= MAX_STRIKES) {
    finalizeSubmit("violations");
  } else {
    setTimeout(() => { if (!document.fullscreenElement) enterFullscreen(); }, 300);
  }
}

function updateStrikeDots() {
  els.strikeDots.forEach((dot, i) => { if (i < strikes) dot.classList.add("used"); });
}

function showAlert(message) {
  els.alertMessage.textContent = message;
  els.alertOverlay.classList.add("show");
  setTimeout(() => els.alertOverlay.classList.remove("show"), 3000);
}

function startRoutineCapture() {
  routineCaptureInterval = setInterval(async () => {
    if (examEnded) return;
    try {
      const blob = await captureFrameAsBlob(videoEl);
      const { url } = await uploadSnapshot(blob, sessionFolder, "routine");
      await updateDoc(submissionRef, { violationImages: arrayUnion(url) });
    } catch (err) { console.warn("Routine capture failed", err); }
  }, ROUTINE_CAPTURE_MS);
}

async function captureEventSnapshot(tag) {
  const now = Date.now();
  if (now - lastEventCaptureAt < EVENT_CAPTURE_COOLDOWN_MS) return;
  lastEventCaptureAt = now;
  try {
    const blob = await captureFrameAsBlob(videoEl);
    const { url } = await uploadSnapshot(blob, sessionFolder, tag);
    await updateDoc(submissionRef, { violationImages: arrayUnion(url) });
  } catch (err) { console.warn("Event capture failed", err); }
}

function startFaceMonitoring() {
  monitorInterval = setInterval(async () => {
    if (examEnded) return;
    try {
      const result = await monitorFrame(videoEl);
      if (result.flag === "extra-person") {
        captureEventSnapshot("violation_extra-person");
        showAlert("Another person detected in frame. This has been logged.");
      } else if (result.flag === "looking-away") {
        captureEventSnapshot("violation_eye-movement");
      } else if (result.flag === "no-face") {
        captureEventSnapshot("violation_no-face");
      }
    } catch (err) { console.warn("Face monitor error", err); }
  }, MONITOR_INTERVAL_MS);
}

export async function manualSubmit() {
  if (confirm("Submit your MCQ test now? You'll see your score immediately.")) {
    finalizeSubmit("manual");
  }
}

function computeScore() {
  let score = 0;
  questions.forEach(q => {
    if (selectedAnswers[q.id] === q.correctIndex) score++;
  });
  return score;
}

async function finalizeSubmit(reasonCode) {
  if (examEnded) return;
  examEnded = true;

  clearInterval(examTimerInterval);
  clearInterval(routineCaptureInterval);
  clearInterval(monitorInterval);

  const score = computeScore();

  await updateDoc(submissionRef, {
    status: reasonCode === "manual" ? "submitted" : "auto-submitted",
    endTime: serverTimestamp(),
    endReason: reasonCode,
    score,
    totalQuestions: questions.length
  });

  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});

  document.body.innerHTML = `
    <div class="page-center">
      <div class="card text-center" style="max-width:420px;">
        <div class="badge badge-black" style="font-size:0.9rem; padding:8px 18px; margin-bottom:14px; display:inline-block;">Instant Result</div>
        <h2>Your Score</h2>
        <div style="font-family:var(--font-display); font-size:2.6rem; font-weight:700; color:var(--green-deep);">${score} / ${questions.length}</div>
        <p class="mt-16 small-note">${
          reasonCode === "violations"
            ? "Your test was automatically submitted after 3 warnings."
            : reasonCode === "time-up"
            ? "Time's up — your test was automatically submitted."
            : "Submitted successfully."
        }</p>
        <p class="small-note">You may close this window.</p>
      </div>
    </div>
  `;
}

window.addEventListener("beforeunload", (e) => {
  if (!examEnded) { e.preventDefault(); e.returnValue = ""; }
});

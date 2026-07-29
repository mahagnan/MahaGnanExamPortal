// ============================================
// EXAM ENGINE
// - Enforces fullscreen
// - Detects tab-switch / fullscreen-exit -> 3 strikes -> auto-submit
// - Captures a routine snapshot every 60s
// - Runs continuous face monitoring -> captures event snapshots on violation
// - Autosaves answers to Firestore as the student types
// - Final submit locks the exam
// ============================================
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, getDocs, doc, setDoc, getDoc, updateDoc, arrayUnion, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStudentProfile } from "./auth.js";
import { buildSessionFolder, uploadSnapshot, captureFrameAsBlob } from "./cloudinary.js";
import { loadFaceModels, monitorFrame } from "./face-detection.js";
import { formatQuestionText, normalizeQuestion } from "./format.js";

const EXAM_DURATION_SECONDS = 2 * 60 * 60; // 2 hours
const MAX_STRIKES = 3;
const ROUTINE_CAPTURE_MS = 60 * 1000; // every 60s
const MONITOR_INTERVAL_MS = 4000; // face check every 4s (independent of routine capture)
const EVENT_CAPTURE_COOLDOWN_MS = 15000; // avoid spamming captures for the same ongoing event

let strikes = 0;
let uid, profile, sessionFolder, submissionRef;
let timeRemaining = EXAM_DURATION_SECONDS;
let examTimerInterval, routineCaptureInterval, monitorInterval;
let videoEl;
let lastEventCaptureAt = 0;
let examEnded = false;
let questions = [];
let answers = {}; // { questionId: text }

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

// ---------- Init ----------

export async function initExam() {
  cacheEls();
  onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "student-login.html"; return; }
    uid = user.uid;
    profile = await getStudentProfile(uid);
    sessionFolder = buildSessionFolder(profile?.name, uid);

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

// ---------- Camera ----------

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

// ---------- Questions ----------

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function loadQuestionsShuffled() {
  const snap = await getDocs(collection(db, "questions"));
  const all = snap.docs.map(d => normalizeQuestion({ id: d.id, ...d.data() }));
  const interview = shuffle(all.filter(q => q.category === "interview"));
  const coding = shuffle(all.filter(q => q.category === "coding"));
  questions = [...interview, ...coding]; // grouped but jumbled within each group, unique order per student
}

const LANGUAGE_MODES = {
  html: "htmlmixed",
  css: "css",
  javascript: "javascript",
  java: "text/x-java",
  mysql: "text/x-sql",
  python: "text/x-python"
};

const codeEditors = {}; // qid -> CodeMirror instance

function renderQuestions() {
  els.questionsContainer.innerHTML = "";
  questions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "question-card";
    const isCoding = q.category === "coding";

    card.innerHTML = `
      <div class="q-meta">
        <span class="q-number">Q${idx + 1}</span>
        <span class="badge ${isCoding ? "badge-amber" : "badge-green"}">
          ${isCoding ? "Coding" : "Interview"} &middot; ${q.label}
        </span>
      </div>
      <div class="q-text">${formatQuestionText(q.text)}</div>
      ${isCoding ? `
        <select class="code-lang-select" data-qid="${q.id}">
          <option value="html">HTML</option>
          <option value="css">CSS</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="mysql">MySQL</option>
          <option value="python">Python</option>
        </select>
        <textarea class="code-area" data-qid="${q.id}"></textarea>
      ` : `
        <textarea data-qid="${q.id}" placeholder="Type your answer here..."></textarea>
      `}
    `;
    els.questionsContainer.appendChild(card);

    if (isCoding) {
      const textareaEl = card.querySelector(`textarea.code-area[data-qid="${q.id}"]`);
      const langSelect = card.querySelector(`select[data-qid="${q.id}"]`);
      const cm = CodeMirror.fromTextArea(textareaEl, {
        lineNumbers: true,
        theme: "material-darker",
        mode: LANGUAGE_MODES[langSelect.value],
        indentUnit: 2,
        tabSize: 2,
        viewportMargin: Infinity
      });
      codeEditors[q.id] = cm;

      cm.on("change", debounce(() => {
        saveAnswer(q.id, cm.getValue(), langSelect.value);
      }, 800));

      langSelect.addEventListener("change", () => {
        cm.setOption("mode", LANGUAGE_MODES[langSelect.value]);
        saveAnswer(q.id, cm.getValue(), langSelect.value);
      });
    }
  });

  els.questionsContainer.querySelectorAll("textarea:not(.code-area)").forEach(ta => {
    ta.addEventListener("input", debounce(() => saveAnswer(ta.dataset.qid, ta.value), 800));
  });
}

let saveTimers = {};
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function saveAnswer(questionId, text, language) {
  answers[questionId] = text;
  const update = { [`answers.${questionId}`]: text, lastSavedAt: serverTimestamp() };
  if (language) update[`answerLanguages.${questionId}`] = language;
  await updateDoc(submissionRef, update);
}

// ---------- Submission doc ----------

async function initSubmissionDoc() {
  submissionRef = doc(db, "submissions", uid);
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
      violationImages: []
    });
  }
}

// ---------- Timer ----------

function startTimer() {
  examTimerInterval = setInterval(() => {
    timeRemaining--;
    updateTimerDisplay();
    if (timeRemaining <= 0) {
      finalizeSubmit("time-up");
    }
  }, 1000);
}

function updateTimerDisplay() {
  const h = String(Math.floor(timeRemaining / 3600)).padStart(2, "0");
  const m = String(Math.floor((timeRemaining % 3600) / 60)).padStart(2, "0");
  const s = String(timeRemaining % 60).padStart(2, "0");
  els.timer.textContent = `${h}:${m}:${s}`;
}

// ---------- Fullscreen + tab-switch detection ----------

function enterFullscreen() {
  const el = document.documentElement;
  if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
}

function attachViolationListeners() {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && !examEnded) registerStrike("You switched tabs or minimized the window.");
  });

  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && !examEnded) {
      registerStrike("You exited fullscreen mode.");
    }
  });

  window.addEventListener("blur", () => {
    // Extra safety net for some browsers where visibilitychange doesn't fire reliably
    if (!examEnded) registerStrike("Exam window lost focus.");
  });
}

function attachAntiCheatBasics() {
  document.addEventListener("contextmenu", e => e.preventDefault());
  document.addEventListener("copy", e => e.preventDefault());
  document.addEventListener("paste", e => e.preventDefault());
  document.addEventListener("keydown", e => {
    // Block common devtools shortcuts
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I", "J", "C"].includes(e.key)) || (e.ctrlKey && e.key === "u")) {
      e.preventDefault();
    }
  });
}

let strikeDebounce = false;
function registerStrike(reason) {
  if (strikeDebounce || examEnded) return;
  strikeDebounce = true;
  setTimeout(() => (strikeDebounce = false), 1500); // avoid double-counting rapid-fire events

  strikes++;
  updateStrikeDots();
  updateDoc(submissionRef, { violationCount: strikes });
  captureEventSnapshot("violation_" + reason.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  showAlert(`Warning ${strikes} of ${MAX_STRIKES}: ${reason}`);

  if (strikes >= MAX_STRIKES) {
    finalizeSubmit("violations");
  } else {
    // Re-enter fullscreen automatically after the alert if they exited
    setTimeout(() => { if (!document.fullscreenElement) enterFullscreen(); }, 300);
  }
}

function updateStrikeDots() {
  els.strikeDots.forEach((dot, i) => {
    if (i < strikes) dot.classList.add("used");
  });
}

function showAlert(message) {
  els.alertMessage.textContent = message;
  els.alertOverlay.classList.add("show");
  setTimeout(() => els.alertOverlay.classList.remove("show"), 3000);
}

// ---------- Snapshot capture ----------

function startRoutineCapture() {
  routineCaptureInterval = setInterval(async () => {
    if (examEnded) return;
    try {
      const blob = await captureFrameAsBlob(videoEl);
      const { url } = await uploadSnapshot(blob, sessionFolder, "routine");
      await updateDoc(submissionRef, { violationImages: arrayUnion(url) });
    } catch (err) {
      console.warn("Routine capture failed", err);
    }
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
  } catch (err) {
    console.warn("Event capture failed", err);
  }
}

// ---------- Face monitoring (eye movement / extra person) ----------

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
    } catch (err) {
      console.warn("Face monitor error", err);
    }
  }, MONITOR_INTERVAL_MS);
}

// ---------- Submit ----------

export async function manualSubmit() {
  if (confirm("Submit your exam now? You won't be able to make changes after this.")) {
    finalizeSubmit("manual");
  }
}

async function finalizeSubmit(reasonCode) {
  if (examEnded) return;
  examEnded = true;

  clearInterval(examTimerInterval);
  clearInterval(routineCaptureInterval);
  clearInterval(monitorInterval);

  await updateDoc(submissionRef, {
    status: reasonCode === "manual" ? "submitted" : "auto-submitted",
    endTime: serverTimestamp(),
    endReason: reasonCode
  });

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }

  document.body.innerHTML = `
    <div class="page-center">
      <div class="card text-center" style="max-width:420px;">
        <h2>Exam Submitted</h2>
        <p>${
          reasonCode === "violations"
            ? "Your exam was automatically submitted after 3 warnings."
            : reasonCode === "time-up"
            ? "Time's up — your exam has been automatically submitted."
            : "Your answers have been submitted successfully."
        }</p>
        <p class="small-note">You may close this window.</p>
      </div>
    </div>
  `;
}

window.addEventListener("beforeunload", (e) => {
  if (!examEnded) {
    e.preventDefault();
    e.returnValue = "";
  }
});

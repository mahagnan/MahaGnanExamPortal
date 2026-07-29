# Mah'a Gnan Test Portal — Setup Guide

A proctored online assessment portal: 10 interview questions + 3 easy coding + 2 hard coding, face-verified login, live tab-switch/fullscreen monitoring, and Cloudinary-based snapshot capture.

## What you have

```
mahagnan-portal/
  index.html              → landing page (student / admin choice)
  student-login.html
  student-signup.html     → captures reference photo for face verification
  face-verify.html        → live face check before exam starts
  exam.html                → the proctored exam itself
  admin-login.html
  admin-dashboard.html     → post/delete questions
  admin-submissions.html   → view answers, grade manually, review/delete snapshots
  css/style.css
  js/
    firebase-config.js     → ⚠️ YOU MUST EDIT THIS
    cloudinary.js
    auth.js
    face-detection.js
    exam.js
    admin.js
  assets/
    logo.png, logo-wide.png
```

## Step 1 — Create a Firebase project

1. Go to https://console.firebase.google.com → **Add project**.
2. Once created, go to **Build → Authentication → Get started → Email/Password** → enable it.
3. Go to **Build → Firestore Database → Create database** → start in **production mode**.
4. Go to **Project settings (gear icon) → General → Your apps → Web (</>)** → register the app → copy the `firebaseConfig` object.
5. Paste those values into `js/firebase-config.js`, replacing the placeholders.

## Step 2 — Create your admin account

Since this app doesn't have a signup flow for admins (only students self-signup), do this manually once:

1. In Firebase Console → Authentication → **Add user** → enter your admin email/password.
2. Copy that user's **UID**.
3. In Firestore Database → **Start collection** → name it `admins` → **Document ID** = the UID you copied → add any field, e.g. `role: "admin"` → Save.

Now that email/password logs into `admin-login.html` successfully.

## Step 3 — Firestore Security Rules

Go to **Firestore Database → Rules** and paste something like this (tighten further before real use):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /students/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
      allow read: if request.auth != null; // admins reading student names, etc.
    }
    match /admins/{uid} {
      allow read: if request.auth != null;
    }
    match /questions/{qid} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && exists(/databases/$(database)/documents/admins/$(request.auth.uid));
    }
    match /submissions/{uid} {
      allow read, write: if request.auth != null &&
        (request.auth.uid == uid || exists(/databases/$(database)/documents/admins/$(request.auth.uid)));
    }
  }
}
```

## Step 4 — Create a Cloudinary account

1. Go to https://cloudinary.com → sign up (free tier is plenty to start).
2. On your Dashboard, copy your **Cloud Name**.
3. Go to **Settings (gear) → Upload → Upload presets → Add upload preset**:
   - Signing Mode: **Unsigned**
   - Folder: leave blank (the app sets folder dynamically)
   - Allowed formats: `jpg`
   - Save, and copy the **preset name**.
4. Paste both values into `js/firebase-config.js`:
   ```js
   export const CLOUDINARY_CLOUD_NAME = "your-cloud-name";
   export const CLOUDINARY_UPLOAD_PRESET = "your-preset-name";
   ```

Every exam snapshot uploads straight from the browser into a folder like:
`examSnaps/2026-07-29_10-15_rahul-kumar_8f2c1a/snap_....jpg`
— one new folder per exam session, no image ever touches your database.

## Step 5 — Test locally

Because this uses ES modules (`type="module"`), opening `index.html` directly via `file://` won't work in most browsers. Run a local server:

```bash
cd mahagnan-portal
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Step 6 — Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Repo → **Settings → Pages → Source** → select your branch and root folder → Save.
3. Your site will be live at `https://yourusername.github.io/reponame/`.

No backend server needed — Firebase + Cloudinary handle everything directly from the browser.

## How the anti-cheating flow works

1. **Signup** — student uploads a reference face photo (stored in Cloudinary, URL saved to Firestore).
2. **Login** → **Face Verify** — live webcam frame compared to the reference photo using face-api.js (runs entirely in-browser).
3. **Exam start** — fullscreen is forced; camera stays on.
4. **Every 60 seconds** — a snapshot is captured and uploaded automatically ("routine").
5. **Continuously** (every 4s) — face-api.js checks for: no face, more than one face, or head turned away from screen. Any of these triggers an immediate snapshot upload tagged as a violation.
6. **Tab switch, window blur, or fullscreen exit** → counts as one of 3 strikes. Each strike shows an on-screen warning and captures a snapshot. On the 3rd strike, the exam auto-submits.
7. **Timer hits 0** → auto-submits regardless of strikes.
8. **Admin panel** — shows every student's answers next to each question, lets admin type marks + remarks per question, and shows all captured snapshots with a "Delete All Snapshots" button to reclaim space once reviewed.

## Known limitations to be aware of

- All enforcement (timer, strikes, fullscreen) currently runs **client-side only** — a technically sophisticated student could tamper with it via devtools. For high-stakes exams, this would need server-side validation, which requires adding a backend later.
- Face-api.js's gaze/"looking away" detection is a lightweight heuristic (nose-position offset), not true eye-tracking — good enough to flag obvious looking-away, not perfectly precise.
- Unsigned Cloudinary uploads mean the `cloud_name` + `upload_preset` are visible in your JS source. This is normal for this pattern, but someone could theoretically upload junk files to your account. Keep the preset restricted to images only, and monitor usage.

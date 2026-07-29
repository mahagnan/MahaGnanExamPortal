// ============================================
// AUTH HELPERS — Firebase Authentication + Firestore profile docs
// ============================================
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase-config.js";

/** Uploads the student's one-time reference face photo to Cloudinary (separate, permanent folder). */
export async function uploadReferencePhoto(blobOrFile, uid) {
  const formData = new FormData();
  formData.append("file", blobOrFile);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "referencePhotos");
  formData.append("public_id", uid);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );
  if (!res.ok) throw new Error("Reference photo upload failed");
  const data = await res.json();
  return data.secure_url;
}

/** Student signup: creates auth user + Firestore profile with reference photo URL. */
export async function signupStudent({ name, email, password, referencePhotoFile }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = cred.user.uid;
  const referencePhotoURL = await uploadReferencePhoto(referencePhotoFile, uid);

  await setDoc(doc(db, "students", uid), {
    name,
    email,
    referencePhotoURL,
    role: "student",
    createdAt: new Date().toISOString()
  });

  return uid;
}

export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logoutUser() {
  await fbSignOut(auth);
}

export async function getStudentProfile(uid) {
  const snap = await getDoc(doc(db, "students", uid));
  return snap.exists() ? snap.data() : null;
}

/** Redirects to login if not authenticated; calls callback(user, profile) once ready. */
export function requireAuth(onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "student-login.html";
      return;
    }
    const profile = await getStudentProfile(user.uid);
    onReady(user, profile);
  });
}

/** Simple admin check: admin accounts have role "admin" in a top-level "admins" collection. */
export async function isAdmin(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}

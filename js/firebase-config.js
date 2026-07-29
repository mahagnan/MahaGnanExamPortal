// ============================================
// FIREBASE CONFIG — replace with YOUR project's values
// Get these from: Firebase Console > Project Settings > General > Your apps > SDK setup
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCVWriLWsuRAMBiRNCyE-YFFghBILc33sI",
  authDomain: "mahagnanexamportal.firebaseapp.com",
  projectId: "mahagnanexamportal",
  storageBucket: "mahagnanexamportal.firebasestorage.app",
  messagingSenderId: "696336443406",
  appId: "1:696336443406:web:355ce123b73aa18c7af45f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============================================
// CLOUDINARY CONFIG — replace with YOUR cloud name + unsigned upload preset
// Get these from: Cloudinary Dashboard > Settings > Upload > Upload presets
// (create an UNSIGNED preset, restrict to images, set a folder root if you like)
// ============================================
export const CLOUDINARY_CLOUD_NAME = "vnpinxun";
export const CLOUDINARY_UPLOAD_PRESET = "MahaGnanExamPortal";

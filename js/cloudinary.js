// ============================================
// CLOUDINARY UPLOAD HELPER
// Uploads a snapshot (base64/blob) into a per-student, per-session folder:
//   examSnaps/{YYYY-MM-DD}_{studentName}_{uid}/snap_... .jpg
// Unsigned upload — no backend required.
// ============================================
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./firebase-config.js";

export function buildSessionFolder(studentName, uid) {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const timePart = now.toTimeString().slice(0, 5).replace(":", "-"); // HH-MM
  const safeName = (studentName || "student")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `examSnaps/${datePart}_${timePart}_${safeName}_${uid.slice(0, 6)}`;
}

/**
 * Uploads a snapshot to Cloudinary inside the session folder.
 * @param {Blob} blob - JPEG blob from canvas.toBlob
 * @param {string} folder - result of buildSessionFolder()
 * @param {string} tag - e.g. "routine", "violation_eye-movement", "violation_extra-person"
 * @returns {Promise<{url:string, publicId:string}>}
 */
export async function uploadSnapshot(blob, folder, tag) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const publicId = `${tag}_${stamp}`;

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);
  formData.append("public_id", publicId);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("Cloudinary upload failed: " + errText);
  }

  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id, tag };
}

/** Converts a <video> frame into a JPEG Blob for upload. */
export function captureFrameAsBlob(videoEl, quality = 0.7) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = videoEl.videoWidth || 320;
    canvas.height = videoEl.videoHeight || 240;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

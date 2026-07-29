// ============================================
// FACE DETECTION — face-api.js wrapper
// Used twice:
//  1) One-time verification before exam start (live face vs reference photo)
//  2) Continuous monitoring during exam (face-missing / extra-face / looking-away)
// Models loaded from a public CDN — see index of MODEL_URL below.
// ============================================

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/";
let modelsLoaded = false;

export async function loadFaceModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
  ]);
  modelsLoaded = true;
}

/** Returns a 128-d descriptor for the largest face found in an image element, or null. */
async function getDescriptorFromImage(imgEl) {
  const result = await faceapi
    .detectSingleFace(imgEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result ? result.descriptor : null;
}

/** Loads an <img> from a URL (needs CORS-enabled host, e.g. Cloudinary works fine). */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Compares a live video frame against the student's stored reference photo.
 * @returns {Promise<{match:boolean, distance:number}>}
 */
export async function verifyFaceAgainstReference(videoEl, referencePhotoURL) {
  await loadFaceModels();

  const refImg = await loadImage(referencePhotoURL);
  const refDescriptor = await getDescriptorFromImage(refImg);
  if (!refDescriptor) {
    throw new Error("Could not detect a face in the stored reference photo.");
  }

  const liveResult = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();

  if (!liveResult) {
    return { match: false, distance: null, reason: "no-face-detected" };
  }

  const distance = faceapi.euclideanDistance(refDescriptor, liveResult.descriptor);
  // Lower distance = more similar. 0.6 is face-api.js's commonly used threshold.
  const THRESHOLD = 0.55;
  return { match: distance < THRESHOLD, distance, reason: distance < THRESHOLD ? "ok" : "mismatch" };
}

/**
 * Runs one detection pass on the current video frame for exam monitoring.
 * Returns flags the exam engine can act on.
 */
export async function monitorFrame(videoEl) {
  await loadFaceModels();

  const detections = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  if (detections.length === 0) {
    return { flag: "no-face", faceCount: 0 };
  }
  if (detections.length > 1) {
    return { flag: "extra-person", faceCount: detections.length };
  }

  // Single face — estimate gaze/attention using landmark symmetry as a lightweight proxy.
  const landmarks = detections[0].landmarks;
  const nose = landmarks.getNose();
  const jaw = landmarks.getJawOutline();
  const noseX = nose[3].x;
  const faceLeft = jaw[0].x;
  const faceRight = jaw[16].x;
  const faceCenter = (faceLeft + faceRight) / 2;
  const faceWidth = faceRight - faceLeft;
  const offsetRatio = Math.abs(noseX - faceCenter) / faceWidth;

  // Large horizontal offset of the nose relative to face width suggests head turned away.
  if (offsetRatio > 0.18) {
    return { flag: "looking-away", faceCount: 1, offsetRatio };
  }

  return { flag: "ok", faceCount: 1 };
}

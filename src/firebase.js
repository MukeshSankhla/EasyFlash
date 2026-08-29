// firebase.js
// Integrates Firebase Firestore to track and synchronize real-time flash counts per project.

import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  increment, 
  onSnapshot,
  collection
} from "firebase/firestore";

// Web app's Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyAj8G4Y1uU0u4qDaWgmbQbzNlWi7BW-bqM",
  authDomain: "easyesp-79b42.firebaseapp.com",
  projectId: "easyesp-79b42",
  storageBucket: "easyesp-79b42.firebasestorage.app",
  messagingSenderId: "281731498087",
  appId: "1:281731498087:web:739cd274e19053849314c2"
};

let app = null;
let db = null;
let isInitialized = false;

try {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  isInitialized = true;
} catch (error) {
  console.warn("Firebase initialization warning (running in offline fallback mode):", error);
}

/**
 * Retrieves the successful flash count for a specific project.
 * @param {string} projectId - Project identifier (e.g. 'ai-buddy')
 * @returns {Promise<number>}
 */
export async function getProjectFlashCount(projectId) {
  if (!isInitialized || !db || !projectId) {
    return getLocalFlashCount(projectId);
  }

  try {
    const docRef = doc(db, "project_stats", projectId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const count = typeof data.flashCount === "number" ? data.flashCount : 0;
      setLocalFlashCount(projectId, count);
      return count;
    } else {
      return getLocalFlashCount(projectId);
    }
  } catch (error) {
    console.warn(`Failed to fetch flash count from Firestore for ${projectId}:`, error);
    return getLocalFlashCount(projectId);
  }
}

/**
 * Atomically increments the successful flash count for a project.
 * @param {string} projectId - Project identifier
 * @param {string} [version] - The firmware version flashed
 * @returns {Promise<number>} - The updated flash count
 */
export async function incrementProjectFlashCount(projectId, version = "") {
  if (!projectId) return 0;

  // Optimistically increment local cache
  const localCurrent = getLocalFlashCount(projectId);
  const newLocalCount = localCurrent + 1;
  setLocalFlashCount(projectId, newLocalCount);

  if (!isInitialized || !db) {
    return newLocalCount;
  }

  try {
    const docRef = doc(db, "project_stats", projectId);
    
    const updateData = {
      projectId: projectId,
      flashCount: increment(1),
      lastFlashedAt: new Date().toISOString()
    };

    if (version) {
      const cleanVerKey = `version_${version.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      updateData[cleanVerKey] = increment(1);
    }

    await setDoc(docRef, updateData, { merge: true });
    
    // Fetch updated count
    const updatedSnap = await getDoc(docRef);
    if (updatedSnap.exists()) {
      const updatedCount = updatedSnap.data().flashCount || newLocalCount;
      setLocalFlashCount(projectId, updatedCount);
      return updatedCount;
    }

    return newLocalCount;
  } catch (error) {
    console.warn(`Failed to increment Firestore flash count for ${projectId}:`, error);
    return newLocalCount;
  }
}

/**
 * Subscribes to real-time flash count updates for a single project.
 * @param {string} projectId - Project identifier
 * @param {function(number): void} callback - Invoked whenever count changes
 * @returns {function(): void} - Unsubscribe function
 */
export function subscribeProjectFlashCount(projectId, callback) {
  if (!projectId || typeof callback !== "function") return () => {};

  // Immediately call with cached local count
  callback(getLocalFlashCount(projectId));

  if (!isInitialized || !db) {
    return () => {};
  }

  try {
    const docRef = doc(db, "project_stats", projectId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const count = docSnap.data().flashCount || 0;
        setLocalFlashCount(projectId, count);
        callback(count);
      }
    }, (err) => {
      console.warn(`Firestore real-time subscription error for ${projectId}:`, err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn(`Error setting up Firestore subscription for ${projectId}:`, err);
    return () => {};
  }
}

/**
 * Subscribes to all project stats in real-time for the dashboard view.
 * @param {function(Record<string, number>): void} callback - Map of { projectId: flashCount }
 * @returns {function(): void} - Unsubscribe function
 */
export function subscribeAllProjectStats(callback) {
  if (typeof callback !== "function") return () => {};

  // Instant local cache callback
  const initialMap = {};
  ["ai-buddy", "esp32-p4-display"].forEach(pid => {
    initialMap[pid] = getLocalFlashCount(pid);
  });
  callback(initialMap);

  if (!isInitialized || !db) {
    return () => {};
  }

  // Actively fetch individual docs in parallel
  ["ai-buddy", "esp32-p4-display"].forEach(async (pid) => {
    try {
      const count = await getProjectFlashCount(pid);
      initialMap[pid] = count;
      callback({ ...initialMap });
    } catch (e) {}
  });

  try {
    const colRef = collection(db, "project_stats");
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const count = typeof data.flashCount === "number" ? data.flashCount : 0;
        initialMap[docSnap.id] = count;
        setLocalFlashCount(docSnap.id, count);
      });
      callback({ ...initialMap });
    }, (err) => {
      console.warn("Firestore collection subscription warning:", err);
    });

    return unsubscribe;
  } catch (err) {
    console.warn("Error setting up collection subscription:", err);
    return () => {};
  }
}

// LocalStorage helpers for offline resilience
export function getLocalFlashCount(projectId) {
  try {
    const stored = localStorage.getItem(`easyflash_count_${projectId}`);
    return stored ? parseInt(stored, 10) : 0;
  } catch (e) {
    return 0;
  }
}

export function setLocalFlashCount(projectId, count) {
  try {
    localStorage.setItem(`easyflash_count_${projectId}`, count.toString());
  } catch (e) {}
}

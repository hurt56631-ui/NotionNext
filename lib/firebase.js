// lib/firebase.js (最终修正版 - 彻底解决 ReferenceError)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics"; 
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; // 引入 Realtime Database

// 你的 Web 应用的 Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

let authInstance = null;
let dbInstance = null;
let analyticsInstance = null;
let storageInstance = null;
let databaseInstance = null; // Realtime Database 实例

if (typeof window !== 'undefined') {
  try { authInstance = getAuth(app); } catch (e) { console.warn("Auth init failed:", e); }
  try { dbInstance = getFirestore(app); } catch (e) { console.warn("Firestore init failed:", e); }
  if (firebaseConfig.measurementId) {
    try { analyticsInstance = getAnalytics(app); } catch (e) { console.warn("Analytics init failed:", e); }
  }
  try { storageInstance = getStorage(app); } catch (e) { console.warn("Storage init failed:", e); }
  try {
    // 关键：确保 Realtime Database 实例在这里被赋值
    databaseInstance = getDatabase(app); 
  } catch (e) { console.warn("RTDB init failed:", e); }
}

export { 
  app, 
  authInstance as auth, 
  dbInstance as db, 
  analyticsInstance as analytics, 
  storageInstance as storage, 
  databaseInstance as rtDb // 统一导出为 rtDb
};

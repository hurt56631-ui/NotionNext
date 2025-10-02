// /lib/firebase.js (最终修正版 - RTDB 证书错误彻底修复)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

// ✅ 使用 Firebase 控制台提供的 databaseURL，注意后缀是 firebasedatabase.app
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL, 
  // ⚠️ 例子：
  // "https://chrome-sum-448615-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// --- 确保 Firebase App 只初始化一次 ---
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// --- 初始化服务 (仅客户端执行) ---
let auth = null;
let db = null;
let rtDb = null;
let analytics = null;
let storage = null;

if (typeof window !== "undefined") {
  try {
    auth = getAuth(app);
    db = getFirestore(app);
    rtDb = getDatabase(app); // ✅ 不要传 URL，自动用 config.databaseURL
    storage = getStorage(app);

    if (firebaseConfig.measurementId) {
      analytics = getAnalytics(app);
    }
  } catch (err) {
    console.warn("Firebase 初始化失败:", err);
  }
}

// --- 导出实例 ---
export {
  app,
  auth,
  db,
  rtDb,
  analytics,
  storage
};

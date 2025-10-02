// /lib/firebase.js (最终修正版 - SSR 安全且导出名称正确)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Analytics, Storage, 和 Realtime Database 等也只在客户端初始化
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// 您的 Web 应用的 Firebase 配置
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

// --- SSR (服务器端渲染) 安全的 Firebase 应用初始化 ---
// 确保 Firebase app 只被初始化一次
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// 声明所有 Firebase 服务实例变量，初始值为 null
let authInstance = null;
let dbInstance = null;
let analyticsInstance = null;
let storageInstance = null;
let rtDbInstance = null; // 变量名也统一一下，更清晰

// ✨ 核心逻辑：只在浏览器环境中初始化客户端服务 ✨
if (typeof window !== 'undefined') {
  try {
    authInstance = getAuth(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase Auth on client:", e);
  }
  
  try {
    dbInstance = getFirestore(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase Firestore on client:", e);
  }

  if (firebaseConfig.measurementId) {
    try {
      analyticsInstance = getAnalytics(app);
    } catch (e) {
      console.warn("Failed to initialize Firebase Analytics on client:", e);
    }
  }
  
  try {
    storageInstance = getStorage(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase Storage on client:", e);
  }

  try {
    // 将 databaseInstance 重命名为 rtDbInstance
    rtDbInstance = getDatabase(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase Realtime Database on client:", e);
  }
}

// 导出所有 Firebase 服务实例
// 在浏览器中是已初始化的实例，在服务器端则是 null
export {
  app,
  authInstance as auth,
  dbInstance as db,
  analyticsInstance as analytics,
  storageInstance as storage,
  rtDbInstance as rtDb // ✅ 最终修正：将导出别名改为 rtDb
};

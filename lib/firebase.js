// lib/firebase.js (最终修正版 - 彻底解决 ReferenceError: self is not defined)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Analytics 和 Storage, Realtime Database 等也只在客户端初始化
import { getAnalytics } from "firebase/analytics"; 
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

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

// --- SSR (服务器端渲染) 安全的 Firebase 应用初始化 ---
// 确保 Firebase app 只被初始化一次，这个本身是服务器安全的
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
let databaseInstance = null;

// ✨ 核心修复 ✨
// 只有在浏览器环境中 (即 `window` 对象存在时) 才初始化这些 Firebase 实例。
// 这样在 Next.js 的 SSR/构建阶段，这些可能导致 `self is not defined` 的代码就不会执行。
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

  // Analytics 仅在浏览器端初始化，且通常只在生产环境追踪
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
    databaseInstance = getDatabase(app);
  } catch (e) {
    console.warn("Failed to initialize Firebase Realtime Database on client:", e);
  }
}

// 导出所有 Firebase 服务实例
// 它们在浏览器中是已初始化的实例，在服务器端则是 null
export { 
  app, 
  authInstance as auth, 
  dbInstance as db, 
  analyticsInstance as analytics, 
  storageInstance as storage, 
  databaseInstance as database 
};

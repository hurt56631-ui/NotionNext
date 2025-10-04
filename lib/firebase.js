// /lib/firebase.js (为你当前的结构定制的最终修正版)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// ✅ 修复：同时导入 isSupported 函数
import { getAnalytics, isSupported } from "firebase/analytics"; 
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

// 初始化 App (保持不变)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// 初始化所有服务，但 analytics 除外
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const rtDb = getDatabase(app);
let analytics = null; // 先将 analytics 初始化为 null

// ✅ 修复：使用条件判断，只在浏览器环境中初始化 analytics
if (typeof window !== 'undefined') {
  // 检查浏览器是否支持 Firebase Analytics
  isSupported().then((supported) => {
    if (supported && firebaseConfig.measurementId) {
      try {
        analytics = getAnalytics(app);
      } catch (e) {
        console.warn("Analytics init failed:", e);
      }
    }
  });
}

// 统一导出所有实例
export { 
  app, 
  auth, 
  db, 
  analytics, 
  storage, 
  rtDb 
};

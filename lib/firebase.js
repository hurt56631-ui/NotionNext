// /lib/firebase.js (最终优化版 - 启用持久化并增强健壮性)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// ✅ 引入 enableIndexedDbPersistence 以启用本地缓存
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore"; 
// ✅ 引入 isSupported 以安全地初始化 Analytics
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

// ✅ 使用更简洁的方式初始化 App，防止重复
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 预先声明所有实例变量
let authInstance = null;
let dbInstance = null;
let analyticsInstance = null;
let storageInstance = null;
let databaseInstance = null;

// ✅ 关键：只在客户端环境下执行 Firebase 服务初始化，避免 SSR 错误
if (typeof window !== 'undefined') {
  try {
    // 初始化核心服务
    authInstance = getAuth(app);
    dbInstance = getFirestore(app);
    storageInstance = getStorage(app);
    databaseInstance = getDatabase(app);

    // ✅ 核心任务：启用 Firestore 本地持久化 (IndexedDB)
    // 这行代码会自动将 Firestore 数据缓存到浏览器中
    enableIndexedDbPersistence(dbInstance)
      .catch((err) => {
        if (err.code == 'failed-precondition') {
          // 可能是因为用户打开了多个标签页
          console.warn(
            "Firestore persistence failed. This could be due to multiple tabs open."
          );
        } else if (err.code == 'unimplemented') {
          // 浏览器不支持 IndexedDB 或功能不全
          console.warn(
            "The current browser does not support all of the features required to enable persistence."
          );
        }
      });

    // ✅ 使用 isSupported() 异步、安全地初始化 Analytics
    // 这样可以确保只在浏览器支持的情况下才加载分析脚本
    if (firebaseConfig.measurementId) {
      isSupported().then((supported) => {
        if (supported) {
          analyticsInstance = getAnalytics(app);
        }
      });
    }
  } catch (e) {
    // 统一捕获初始化过程中可能出现的任何错误
    console.error("Firebase services initialization error", e);
  }
}

// 导出所有实例，统一命名
export { 
  app, 
  authInstance as auth, 
  dbInstance as db, 
  analyticsInstance as analytics, 
  storageInstance as storage, 
  databaseInstance as rtDb 
};

// /lib/firebase.js (最终修复版 - 回退到稳定的持久化 API)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// [FIX] 撤销 initializeFirestore 的改动，用回 getFirestore + enableIndexedDbPersistence
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore"; 
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

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// 预先声明所有实例变量
let authInstance = null;
let dbInstance = null;
let analyticsInstance = null;
let storageInstance = null;
let databaseInstance = null;

// 只在客户端环境下执行 Firebase 服务初始化
if (typeof window !== 'undefined') {
  try {
    // 初始化核心服务
    authInstance = getAuth(app);
    // [FIX] 使用 getFirestore() 初始化，这是最标准、最稳定的方式
    dbInstance = getFirestore(app); 
    storageInstance = getStorage(app);
    databaseInstance = getDatabase(app);

    // [FIX] 使用旧但稳定的 enableIndexedDbPersistence() API。
    // 一个弃用警告远比应用崩溃要好得多。
    enableIndexedDbPersistence(dbInstance)
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn("Firestore persistence failed, likely due to multiple tabs open.");
        } else if (err.code === 'unimplemented') {
          console.warn("The current browser does not support all of the features required to enable persistence.");
        }
      });

    if (firebaseConfig.measurementId) {
      isSupported().then((supported) => {
        if (supported) {
          analyticsInstance = getAnalytics(app);
        }
      });
    }
  } catch (e) {
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

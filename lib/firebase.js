// /lib/firebase.js (最终修复版 - 使用最新的持久化 API)

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// [FIX] 引入新的 API: initializeFirestore 和 persistentLocalCache
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";
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
    authInstance = getAuth(app);
    
    // [FIX] 使用新的 initializeFirestore API 启用持久化
    // 这比旧的 enableIndexedDbPersistence() 方法更好
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        // 使用单标签页管理器，避免多标签页下的缓存冲突
        tabManager: 'SingleTabManager'
      })
    });

    storageInstance = getStorage(app);
    databaseInstance = getDatabase(app);

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

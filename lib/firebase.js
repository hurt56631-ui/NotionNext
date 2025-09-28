// lib/firebase.js (已修复 ReferenceError: self is not defined 并整合 RTDB 区域和 Measurement ID)

// 导入你需要的 Firebase SDK 函数
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; // 导入 Realtime Database

// 你的 Web 应用的 Firebase 配置
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID, // 从环境变量获取 Measurement ID
  
  // 【核心修复】添加你的 Realtime Database URL，解决跨区域警告
  // 务必替换成你自己的数据库URL
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://chrome-sum-448615-f2-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// --- SSR (服务器端渲染) 安全的 Firebase 初始化 ---

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
let databaseInstance = null;

// 只有在浏览器环境中 (即 `window` 对象存在时) 才初始化这些 Firebase 实例。
// 在 Node.js (SSR/构建) 环境中，`typeof window` 会是 'undefined'，这样就不会触发访问 `self` 的错误。
if (typeof window !== 'undefined') {
  authInstance = getAuth(app);
  dbInstance = getFirestore(app);
  analyticsInstance = getAnalytics(app); // Analytics 也只在客户端初始化
  storageInstance = getStorage(app);
  databaseInstance = getDatabase(app); // Realtime Database 也只在客户端初始化
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

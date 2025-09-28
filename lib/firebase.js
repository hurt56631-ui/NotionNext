// lib/firebase.js (修复 RTDB 区域警告)

// 导入你需要的 Firebase SDK 函数
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
// 【新增】导入 Realtime Database
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
  
  // 【核心修复】添加你的 Realtime Database URL，以解决跨区域警告
  databaseURL: "https://chrome-sum-448615-f2-default-rtdb.asia-southeast1.firebasedatabase.app",
};

// --- SSR (服务器端渲染) 安全的 Firebase 初始化 ---
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 获取其他 Firebase 服务的实例
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
// 【新增】获取 Realtime Database 实例
const database = getDatabase(app); 
let analytics;

// 确保 Analytics 只在浏览器客户端被初始化
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// 导出你需要用到的 Firebase 服务实例
export { app, auth, db, analytics, storage, database }; // 【修改】导出 database

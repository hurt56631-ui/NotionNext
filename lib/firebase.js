// lib/firebase.js

// 导入你需要的 Firebase SDK 函数
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// 你的 Web 应用的 Firebase 配置
// 强烈建议使用环境变量（.env.local）来存储这些值
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyBejyAos_TNLoJpFf59OQS0e0-jFNC-l4M",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "chrome-sum-448615-f2.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "chrome-sum-448615-f2",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "chrome-sum-448615-f2.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "470920064962",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:470920064962:web:257de516bbd8fb3a63305b",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-JMKH0917YW"
};

// --- SSR (服务器端渲染) 安全的 Firebase 初始化 ---
// 检查是否已经有 Firebase 应用实例，如果没有，则创建一个新的。
// 这可以防止在 Next.js 的热重载和服务器端渲染时重复创建实例导致错误。
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 获取其他 Firebase 服务的实例
const auth = getAuth(app);
const db = getFirestore(app);
let analytics;

// 确保 Analytics 只在浏览器客户端被初始化
if (typeof window !== 'undefined') {
  analytics = getAnalytics(app);
}

// 导出你需要用到的 Firebase 服务实例，以便在应用的其他地方导入和使用
export { app, auth, db, analytics };

// /lib/AuthContext.js (最终修复版 - 解决假登录和状态不同步问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc, onSnapshot } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
// [FIX] 移除了对 UnreadCountContext 的依赖，保持 AuthContext 职责单一
// 全局未读数应该由一个独立的、在 _app.js 中包裹的 Provider 来管理

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // [FIX] authLoading 的初始状态必须为 true，代表“正在验证身份”
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const auth = getAuth();
    let unsubscribeSnapshot = () => {}; // 先声明一个空的取消订阅函数

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      // 在每次认证状态改变时，先清理上一个用户的快照监听
      unsubscribeSnapshot();

      if (firebaseUser) {
        // 用户通过了 Firebase 的认证
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        // 实时监听用户数据，确保信息永远是新的
        unsubscribeSnapshot = onSnapshot(userRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              const userData = { uid: firebaseUser.uid, ...docSnap.data() };
              setUser(userData);
              // [FIX] 缓存应该在确认数据有效后更新
              localStorage.setItem("cachedUser", JSON.stringify(userData));
            } else {
              // Firestore 中没有用户文档，可能是新用户或数据被删除
              // 如果用户在数据库中被删除了，应该强制登出
              signOut();
            }
            // 只有当 Firestore 数据同步完成后，才算真正加载完毕
            setAuthLoading(false);
          },
          (error) => {
            console.error("User data listener failed:", error);
            setAuthLoading(false); // 监听失败也要结束加载
          }
        );
      } else {
        // 用户未通过 Firebase 认证 (未登录或 token 过期)
        setUser(null);
        localStorage.removeItem("cachedUser");
        setAuthLoading(false); // 明确用户未登录，加载结束
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []); // 这个 effect 只在组件挂载时运行一次

  // --- RTDB 在线状态维护 (逻辑已很完善，无需大改) ---
  useEffect(() => {
    if (!user || !rtDb) return;

    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');
    
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         // [FIX] 确保 unsubscribeConnected 是一个函数再调用
         if (typeof unsubscribeConnected === 'function') unsubscribeConnected();
         set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    };
  }, [user]); // 只依赖 user 对象的变化

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        await set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
    // onAuthStateChanged 会自动处理后续的清理工作，无需手动 setUser 和清理 localStorage
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

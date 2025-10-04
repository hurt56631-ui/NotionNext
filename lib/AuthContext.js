// /lib/AuthContext.js (最终稳定版 - 已彻底修复性能与崩溃问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
// ✅ 修复：只导入必需的函数，保持代码整洁
import { doc, onSnapshot, updateDoc, serverTimestamp, collection, query, where } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase'; 
// ✅ 修复：确保正确导入了我们自定义的 useUnreadCount hook
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // ✅ 缓存优先：从 localStorage 初始化 user，UI 秒开，防止刷新时闪烁
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        try {
            const cachedUser = localStorage.getItem('cachedUser');
            return cachedUser ? JSON.parse(cachedUser) : null;
        } catch (e) {
            console.error("解析缓存用户失败:", e);
            return null;
        }
    }
    return null;
  });
  
  const [authLoading, setAuthLoading] = useState(true);
  // ✅ 修复：从 UnreadCountContext 中正确获取 setTotalUnreadCount
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- 核心认证与实时数据同步 ---
  useEffect(() => {
    const auth = getAuth();
    let userProfileUnsubscribe = null; // 用于取消用户资料的监听

    const authStateUnsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      // 当认证状态改变时，先取消上一个用户的资料监听，防止内存泄漏
      if (userProfileUnsubscribe) {
          userProfileUnsubscribe();
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);

        // ✅ 实时监听用户文档的变动 (例如：昵称、头像更新)
        userProfileUnsubscribe = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const updatedUser = { uid: firebaseUser.uid, ...docSnap.data() };
            
            // ✅ 无感更新：用后台最新数据更新 UI 和本地缓存
            setUser(updatedUser);
            if (typeof window !== 'undefined') {
              localStorage.setItem("cachedUser", JSON.stringify(updatedUser));
            }
          }
          // ✅ 修复加载逻辑：确保在用户资料第一次加载后才结束全局加载状态
          if (authLoading) {
            setAuthLoading(false);
          }
        }, (error) => {
          console.error("监听用户资料失败:", error);
          // ✅ 修复加载逻辑：即使监听失败，也要结束加载状态，避免App卡死
          if (authLoading) {
            setAuthLoading(false); 
          }
        });

      } else {
        // 如果用户登出
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem("cachedUser");
        }
        setAuthLoading(false);
      }
    });

    // 组件卸载时，清理所有侦听器
    return () => {
      authStateUnsubscribe();
      if (userProfileUnsubscribe) {
        userProfileUnsubscribe();
      }
    };
    // ✅ 修复依赖项：确保依赖项完整，符合 React Hooks 的规则
  }, [authLoading]);

  // --- 独立的 RTDB 在线状态维护 ---
  useEffect(() => {
    if (!user || !rtDb) return;
    
    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');

    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            // 当连接断开时，自动将状态设为离线
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            // 建立连接时，将状态设为在线
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            // 同时更新 Firestore 中的最后在线时间
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (unsubscribeConnected) unsubscribeConnected();
    };
  }, [user]);

  // --- ✅ 核心修复：高效且唯一的全局未读数监听 ---
  useEffect(() => {
    // 如果用户未登录，或 setTotalUnreadCount 还未准备好，则重置并返回
    if (!user || !db || !setTotalUnreadCount) {
      if(setTotalUnreadCount) setTotalUnreadCount(0);
      return;
    }

    // 创建一个查询，只监听那些当前用户是成员的聊天室
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    // 🔴 移除了不稳定的 getDocs 初始同步逻辑，完全依赖 onSnapshot
    
    // ✅ 只使用一个 onSnapshot 侦听器来处理所有实时更新，这是最高效、最稳定的做法
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.forEach(doc => {
        // 直接从 chat 文档中高效地读取未读数
        currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0;
      });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("全局未读数监听失败:", error);
      setTotalUnreadCount(0);
    });

    // 返回清理函数
    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
        // 用户登出前，主动将在线状态设为离线
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        await set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// 导出自定义 hook，方便其他组件使用
export const useAuth = () => useContext(AuthContext);

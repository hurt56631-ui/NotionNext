// /lib/AuthContext.js (最终完美版 - 集成 RTDB 在线状态和全局未读数监听)

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
// ✅ 引入 Realtime Database (RTDB) 相关函数
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
// ✅ 引入所有 Firebase 服务实例
import { db, database } from './firebase';
// ✅ 引入全局未读数 Context Hook
import { useUnreadCount } from './UnreadCountContext'; // 假设您已经按我之前的要求创建了 UnreadCountContext.js

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // ✅ 核心修改：使用全局未读数 Hook
  // 我们只在这里进行监听和设置，不影响 AuthProvider 的核心职责
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- 辅助函数：更新 Firestore 中的 lastSeen ---
  const updateFirestoreLastSeen = useCallback((userId) => {
    if (!userId || typeof window === 'undefined') return;
    const userRef = doc(db, 'users', userId);
    updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Error updating lastSeen:", e));
  }, []);

  // --- RTDB 在线状态维护逻辑 ---
  useEffect(() => {
    if (user && typeof window !== 'undefined' && database) {
        const userId = user.uid;
        const userStatusRef = ref(database, '/status/' + userId);

        // 1. 监听客户端与RTDB的连接状态
        const connectedRef = ref(database, '.info/connected');
        const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                // 2. 设置“服务器遗嘱”：连接断开时，将状态设置为 offline
                onDisconnect(userStatusRef).set({
                    state: 'offline',
                    last_changed: rtServerTimestamp(),
                }).then(() => {
                    // 3. 连接成功时，将状态设置为 online
                    set(userStatusRef, {
                        state: 'online',
                        last_changed: rtServerTimestamp(),
                    });
                    // 4. 每隔 60 秒更新一次 Firestore lastSeen 作为辅助
                    updateFirestoreLastSeen(userId);
                    const intervalId = setInterval(() => updateFirestoreLastSeen(userId), 60000);
                    return () => clearInterval(intervalId);
                });
            }
        });
        return () => unsubscribeConnected(); // 销毁组件时取消连接状态监听
    }
  }, [user, updateFirestoreLastSeen]);


  // --- 全局未读数监听逻辑 ---
  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0); // 用户登出时清零
      return;
    }

    const chatsQuery = query(
        collection(db, 'privateChats'),
        where('members', 'array-contains', user.uid),
    );

    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.docs.forEach(doc => {
        const chatData = doc.data();
        const unreadCount = chatData.unreadCounts?.[user.uid] || 0;
        currentTotalUnread += unreadCount;
      });
      // ✅ 每次数据库变化，立即更新全局状态
      setTotalUnreadCount(currentTotalUnread);
      // console.log(`[Global Unread] Updated total to: ${currentTotalUnread}`); // 调试日志
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });

    return () => unsubscribeUnread(); // 销毁组件时取消监听
  }, [user, setTotalUnreadCount]); // 依赖 user 和 setTotalUnreadCount

  
  // --- Auth 核心逻辑 (保持不变) ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUser({ uid: firebaseUser.uid, ...userSnap.data() });
        } else {
          const newUserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '新用户',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || '/img/avatar.svg',
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newUserProfile);
          setUser(newUserProfile);
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    const auth = getAuth();
    // ✅ 登出时，在 RTDB 中明确设置为离线 (可选，onDisconnect会做)
    if (user && database) {
        const userStatusRef = ref(database, '/status/' + user.uid);
        set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut, updateFirestoreLastSeen }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// /lib/AuthContext.js (终极完美修复版 V3 - 无需 lodash)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase';
import { useUnreadCount } from './UnreadCountContext';

const AuthContext = createContext();

// 一个简单的比较函数，用于检查核心用户数据是否变化
// 我们特意忽略了 'lastSeen' 字段，因为它总是在变
const areUsersEqual = (userA, userB) => {
    if (!userA || !userB) return userA === userB;

    // 复制对象以避免修改原始数据
    const userA_copy = { ...userA };
    const userB_copy = { ...userB };

    // 从比较中删除 lastSeen 字段
    delete userA_copy.lastSeen;
    delete userB_copy.lastSeen;

    // 简单地将对象转换为 JSON 字符串进行比较
    // 这对于大多数场景已经足够了
    return JSON.stringify(userA_copy) === JSON.stringify(userB_copy);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { setTotalUnreadCount } = useUnreadCount();

  useEffect(() => {
    if (!db) {
      console.error("Firestore (db) is not initialized. AuthContext cannot function properly.");
      setAuthLoading(false);
      return;
    }
    
    const auth = getAuth();
    let unsubscribeSnapshot = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubscribeSnapshot();

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeSnapshot = onSnapshot(userRef, 
          (docSnap) => {
            if (docSnap.exists()) {
              const newUserData = { uid: firebaseUser.uid, ...docSnap.data() };

              // ==================== 【核心修复点 - 无需 lodash】 ====================
              setUser(currentUser => {
                // 使用我们自定义的比较函数，它会忽略 lastSeen 字段
                if (!areUsersEqual(currentUser, newUserData)) {
                   localStorage.setItem("cachedUser", JSON.stringify(newUserData));
                   return newUserData;
                }
                // 如果核心数据相同，返回旧 state，从而避免不必要的重渲染
                return currentUser; 
              });
              // ====================================================================

            } else {
              signOut();
            }
            setAuthLoading(false);
          },
          (error) => {
            console.error("User data listener failed:", error);
            setAuthLoading(false);
          }
        );
      } else {
        setUser(null);
        localStorage.removeItem("cachedUser");
        setAuthLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, []);

  // --- RTDB 在线状态维护 ---
  useEffect(() => {
    if (!user?.uid || !rtDb) return;

    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');
    
    let unsubscribeConnected = () => {};
    
    unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (typeof unsubscribeConnected === 'function') unsubscribeConnected();
         set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    };
  }, [user?.uid]);

  // --- 全局未读数监听 ---
  useEffect(() => {
    if (!user?.uid || !db) {
      setTotalUnreadCount(0);
      return;
    }
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.forEach(doc => {
        currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0;
      });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });

    return () => unsubscribeUnread();
  }, [user?.uid, setTotalUnreadCount]);

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb) {
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

export const useAuth = () => useContext(AuthContext);

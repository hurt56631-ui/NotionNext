// /lib/AuthContext.js (最终修复版 - 解决无限循环闪烁问题)

import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, serverTimestamp, updateDoc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, rtDb } from './firebase';
import { useUnreadCount } from './UnreadCountContext';

const AuthContext = createContext();

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
              const userData = { uid: firebaseUser.uid, ...docSnap.data() };
              setUser(userData);
              localStorage.setItem("cachedUser", JSON.stringify(userData));
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
    // [FIX] 关键修复：依赖项从 [user] 改为 [user?.uid] 来打破无限循环
    if (!user?.uid || !rtDb) return;

    const userId = user.uid;
    const userStatusRef = ref(rtDb, `/status/${userId}`);
    const connectedRef = ref(rtDb, '.info/connected');
    
    const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
        if (snapshot.val() === true) {
            onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() });
            set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
            // 这一行是触发循环的源头之一，但现在循环被依赖项修复了
            updateDoc(doc(db, 'users', userId), { lastSeen: serverTimestamp() });
        }
    });

    return () => {
         if (typeof unsubscribeConnected === 'function') unsubscribeConnected();
         set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    };
  }, [user?.uid]); // ✅ 核心修复在这里！

  // --- 全局未读数监听 ---
  useEffect(() => {
    if (!user || !db) {
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
  }, [user, setTotalUnreadCount]);

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

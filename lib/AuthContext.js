// /lib/AuthContext.js (终极修复版 - 解决所有时序问题)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
import { db, database } from './firebase'; 
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
        const cachedUser = localStorage.getItem('cachedUser');
        return cachedUser ? JSON.parse(cachedUser) : null;
    }
    return null;
  });
  const [authLoading, setAuthLoading] = useState(true);
  
  const { setTotalUnreadCount } = useUnreadCount(); 

  // --- RTDB 在线状态维护逻辑 ---
  useEffect(() => {
    // 检查 rtDb 实例是否可用
    if (user && typeof window !== 'undefined' && rtDb && rtDb.toJSON) { 
        const userId = user.uid;
        const userStatusRef = ref(rtDb, '/status/' + userId);

        const connectedRef = ref(rtDb, '.info/connected');
        const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() }).then(() => {
                    set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
                    const userRef = doc(db, 'users', userId);
                    updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Update lastSeen error:", e));
                    const intervalId = setInterval(() => {
                         updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => console.error("Update lastSeen error:", e));
                    }, 60000);
                    return () => clearInterval(intervalId);
                });
            }
        });
        return () => unsubscribeConnected();
    }
  }, [user]);

  // --- 全局未读数初始同步 + 实时监听 (解决底部导航栏延迟) ---
  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }

    const chatsQuery = query(
        collection(db, 'privateChats'),
        where('members', 'array-contains', user.uid),
    );

    // 1. 立即执行一次 getDocs，拉取初始未读数 (解决小绿点延迟)
    getDocs(chatsQuery).then(snapshot => {
        let initialUnread = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            initialUnread += data.unreadCounts?.[user.uid] || 0;
        });
        setTotalUnreadCount(initialUnread);
    }).catch(e => console.error("Initial unread sync failed:", e));


    // 2. 开启 onSnapshot 实时监听
    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.docs.forEach(doc => {
        const chatData = doc.data();
        currentTotalUnread += chatData.unreadCounts?.[user.uid] || 0;
      });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });

    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  
  // --- 核心认证逻辑 (保持不变) ---
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        let finalUser = null;
        if (userSnap.exists()) {
          finalUser = { uid: firebaseUser.uid, ...userSnap.data() };
        } else {
          const newUserProfile = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '新用户',
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || '/img/avatar.svg',
            createdAt: serverTimestamp()
          };
          await setDoc(userRef, newUserProfile);
          finalUser = newUserProfile;
        }

        setUser(finalUser);
        localStorage.setItem("cachedUser", JSON.stringify(finalUser)); 

      } else {
        setUser(null);
        localStorage.removeItem("cachedUser");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    const auth = getAuth();
    if (user && rtDb && rtDb.toJSON()) {
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
    }
    await firebaseSignOut(auth);
    setUser(null);
    localStorage.removeItem("cachedUser"); 
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

// /lib/AuthContext.js (终极时序修复版 - 延迟加载 Firebase 实例)
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAuth, onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp, updateDoc, collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { ref, onValue, set, onDisconnect, serverTimestamp as rtServerTimestamp } from 'firebase/database';
// ✅ 核心修复：只导入 firebase.js 的 app，而不是具体的服务实例
import { app } from './firebase'; 
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import { useUnreadCount } from './UnreadCountContext'; 

const AuthContext = createContext();

// ✅ 核心修复：在 Context 外部定义一个函数来获取服务实例
// 这确保了只有在客户端调用时，才会去获取实例
const getDb = () => getFirestore(app);
const getRtDb = () => getDatabase(app);

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

  // --- RTDB 在线状态维护逻辑 (已修复) ---
  useEffect(() => {
    if (user && typeof window !== 'undefined') { 
        const rtDb = getRtDb(); // 在 effect 内部获取实例
        const db = getDb();     // 在 effect 内部获取实例
        
        const userId = user.uid;
        const userStatusRef = ref(rtDb, '/status/' + userId);
        const connectedRef = ref(rtDb, '.info/connected');
        
        const unsubscribeConnected = onValue(connectedRef, (snapshot) => {
            if (snapshot.val() === true) {
                onDisconnect(userStatusRef).set({ state: 'offline', last_changed: rtServerTimestamp() }).then(() => {
                    set(userStatusRef, { state: 'online', last_changed: rtServerTimestamp() });
                    const userRef = doc(db, 'users', userId);
                    updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(e => {});
                });
            }
        });
        return () => {
             if (unsubscribeConnected) unsubscribeConnected();
        };
    }
  }, [user]); 

  // --- 全局未读数初始同步 + 实时监听 (已修复) ---
  useEffect(() => {
    if (!user) {
      setTotalUnreadCount(0);
      return;
    }
    const db = getDb(); // 在 effect 内部获取实例
    const chatsQuery = query(collection(db, 'privateChats'), where('members', 'array-contains', user.uid));
    
    getDocs(chatsQuery).then(snapshot => {
        let initialUnread = 0;
        snapshot.forEach(doc => { initialUnread += doc.data().unreadCounts?.[user.uid] || 0; });
        setTotalUnreadCount(initialUnread);
    }).catch(e => console.error("Initial unread sync failed:", e));

    const unsubscribeUnread = onSnapshot(chatsQuery, (snapshot) => {
      let currentTotalUnread = 0;
      snapshot.docs.forEach(doc => { currentTotalUnread += doc.data().unreadCounts?.[user.uid] || 0; });
      setTotalUnreadCount(currentTotalUnread);
    }, (error) => {
      console.error("Global Unread Listener Error:", error);
      setTotalUnreadCount(0);
    });
    return () => unsubscribeUnread();
  }, [user, setTotalUnreadCount]); 

  
  // --- 核心认证逻辑 (已修复) ---
  useEffect(() => {
    const auth = getAuth(app);
    const db = getDb();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        // ... (其余逻辑保持不变)
      } else {
        setUser(null);
        localStorage.removeItem("cachedUser");
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signOut = async () => {
    const auth = getAuth(app);
    if (user && typeof window !== 'undefined') {
        const rtDb = getRtDb();
        const userStatusRef = ref(rtDb, '/status/' + user.uid);
        await set(userStatusRef, { state: 'offline', last_changed: rtServerTimestamp() });
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

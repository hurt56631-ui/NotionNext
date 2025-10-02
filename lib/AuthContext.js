import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, database } from "./firebase";
import { ref, set, onDisconnect } from "firebase/database";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);

        // ✅ 实时数据库在线状态
        if (database) {
          const userStatusRef = ref(database, `onlineStatus/${firebaseUser.uid}`);

          // 设置为在线
          set(userStatusRef, {
            state: "online",
            lastSeen: Date.now(),
          });

          // 用户断开连接 → 自动设置为离线
          onDisconnect(userStatusRef).set({
            state: "offline",
            lastSeen: Date.now(),
          });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

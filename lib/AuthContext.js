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

        if (database) {
          const userStatusRef = ref(database, `status/${firebaseUser.uid}`);

          // 🔥 登录时立即写入一次在线状态
          await set(userStatusRef, {
            state: "online",
            lastSeen: Date.now(),
          });

          // 🔥 掉线时写 offline
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

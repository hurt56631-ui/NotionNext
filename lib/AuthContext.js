// lib/AuthContext.js 【修改版】

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { auth } from './firebase';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 这个 effect 保持不变
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 关键改动：我们把登录逻辑包装一下
  const socialLogin = async (provider, onSuccessCallback) => {
    try {
      await signInWithPopup(auth, provider);
      // 登录成功后，调用传入的回调函数
      if (onSuccessCallback) {
        onSuccessCallback();
      }
    } catch (error) {
      console.error("社交登录失败:", error);
    }
  };

  const loginWithGoogle = (onSuccessCallback) => {
    socialLogin(new GoogleAuthProvider(), onSuccessCallback);
  };

  const loginWithFacebook = (onSuccessCallback) => {
    socialLogin(new FacebookAuthProvider(), onSuccessCallback);
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginWithFacebook,
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};

// lib/AuthContext.js (已添加 Facebook 登录功能)

import { createContext, useContext, useEffect, useState } from 'react';
// 1. 从 firebase/auth 导入 FacebookAuthProvider
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  FacebookAuthProvider, // <--- 添加这行
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { auth } from './firebase'; // 导入我们刚才创建的 auth 实例

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 监听 Firebase auth 状态变化
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 用户已登录
        setUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        });
      } else {
        // 用户已登出
        setUser(null);
      }
      setLoading(false);
    });

    // 组件卸载时取消监听
    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Google 登录失败:", error);
    }
  };

  // 2. 新增 Facebook 登录函数
  const loginWithFacebook = async () => {
    const provider = new FacebookAuthProvider(); // <--- 使用 FacebookAuthProvider
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Facebook 登录失败:", error);
      // 可以在这里添加更详细的错误处理，比如提示用户
      // error.code === 'auth/account-exists-with-different-credential'
      // 意味着用户可能已经用同一个邮箱的 Google 账号登录过了
    }
  };

  const logout = async () => {
    setUser(null);
    await signOut(auth);
  };

  const value = {
    user,
    loading,
    loginWithGoogle,
    loginWithFacebook, // <--- 3. 把新函数添加到要导出的 value 对象中
    logout,
  };

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};

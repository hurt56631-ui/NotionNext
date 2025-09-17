// lib/AuthContext.js (在您的代码基础上修改的最终版)

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  GoogleAuthProvider, 
  FacebookAuthProvider,
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
// 1. 从 firebase.js 导入 auth 和 db
import { auth, db } from './firebase'; 
// 2. 引入 Firestore 的 setDoc 和 doc 方法
import { doc, setDoc } from 'firebase/firestore';

const AuthContext = createContext();

/**
 * 3. 新增一个函数，专门负责将用户信息写入 Firestore
 * @param {object} user - Firebase Auth 返回的用户对象
 */
const updateUserInFirestore = async (user) => {
  if (!user) return;
  
  // 定义一个指向 'users' 集合，以用户UID为文档ID的引用
  const userRef = doc(db, 'users', user.uid);
  
  // 准备要存入的数据
  const userData = {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL
  };
  
  // 使用 setDoc 并设置 { merge: true }
  // 这意味着如果文档已存在，它会更新字段；如果不存在，它会创建一个新文档。
  try {
    await setDoc(userRef, userData, { merge: true });
    console.log(`用户信息已同步到 Firestore: ${user.uid}`);
  } catch (error) {
    console.error("同步用户信息到 Firestore 失败:", error);
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 4. 修改 useEffect，在 user 状态变化时同步数据
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (authUser) => {
      if (authUser) {
        const userData = {
          uid: authUser.uid,
          email: authUser.email,
          displayName: authUser.displayName,
          photoURL: authUser.photoURL,
        };
        setUser(userData);
        // 关键：当认证状态改变且用户存在时，调用同步函数
        updateUserInFirestore(authUser);
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 您原来的 socialLogin 逻辑保持不变，它工作得很好
  const socialLogin = async (provider, onSuccessCallback) => {
    try {
      // signInWithPopup 成功后, onAuthStateChanged 会自动监听到变化
      // 并触发上面的 useEffect 来设置用户和同步数据，所以这里无需额外操作
      await signInWithPopup(auth, provider);
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

// lib/AuthContext.js (增强健壮性版)

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase'; // 导入 auth 实例，在服务器端可能为 null

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 确保只在浏览器环境且 auth 实例可用时才监听认证状态变化
    if (typeof window !== 'undefined' && auth) {
      console.log("[AuthContext] 浏览器端：开始监听 Firebase 认证状态。");
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setUser(user);
        setLoading(false);
        console.log(`[AuthContext] 认证状态改变：用户 ${user ? '已登录' : '未登录'}`);
      });
      // 在组件卸载时取消监听
      return () => {
        unsubscribe();
        console.log("[AuthContext] 浏览器端：停止监听 Firebase 认证状态。");
      };
    } else {
        // 在服务器端或 auth 未初始化时，立即将 loading 设为 false，防止页面卡住
        console.log("[AuthContext] 服务器端：AuthContext 设置 loading(false)。");
        setLoading(false);
        // 如果这里返回一个函数，React 在 SSR 时会报错，所以不返回
    }
  }, [auth]); // 依赖项中包含 auth，当 auth 实例（在客户端）可用时会触发

  const logout = () => {
    // 确保只在浏览器环境且 auth 实例可用时才执行登出
    if (typeof window !== 'undefined' && auth) {
      console.log("[AuthContext] 浏览器端：尝试登出。");
      signOut(auth).then(() => {
        console.log("[AuthContext] 登出成功！");
      }).catch((e) => {
        console.error("[AuthContext] 登出失败：", e);
      });
    } else {
      console.warn("[AuthContext] 无法登出：auth 实例不可用或不在浏览器环境。");
    }
  }

  const value = {
    user,
    loading,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  return useContext(AuthContext);
};

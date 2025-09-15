// components/GoogleLoginButton.js

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { useState, useEffect } from 'react'; // 1. 导入 useState 和 useEffect

const GoogleLoginButton = () => {
  const { user, loginWithGoogle, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false); // 2. 创建一个状态来跟踪组件是否已在客户端加载

  // 3. 使用 useEffect 来确保只在客户端组件加载后才更新状态
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 4. 在组件完全加载前，我们什么都不渲染，以避免 hydration 错误
  if (!isMounted) {
    return null;
  }

  return (
    <div className="flex items-center">
      {user ? (
        // 如果用户已登录
        <div className="group relative flex items-center gap-2 cursor-pointer">
          <Image
            src={user.photoURL}
            alt={user.displayName}
            width={28}
            height={28}
            className="rounded-full"
          />
          <span className="hidden sm:block text-sm">{user.displayName}</span>
          {/* 悬停时显示的登出按钮 */}
          <div 
            onClick={logout} 
            className="absolute top-full right-0 mt-2 hidden group-hover:block bg-white dark:bg-black shadow-lg rounded px-4 py-2 text-sm whitespace-nowrap"
          >
            登出
          </div>
        </div>
      ) : (
        // 如果用户未登录
        <button 
          onClick={loginWithGoogle}
          className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
        >
          Google 登录
        </button>
      )}
    </div>
  );
};

export default GoogleLoginButton;

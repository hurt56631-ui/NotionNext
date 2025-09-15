// components/SocialLogins.js (原 GoogleLoginButton.js)

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import LoginModal from './LoginModal'; // 导入我们新创建的弹窗组件

const SocialLogins = () => {
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false); // 1. 新增状态来控制弹窗的显示/隐藏

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>; // 返回一个占位符，避免布局跳动
  }

  return (
    <>
      <div className="flex items-center">
        {user ? (
          // 如果用户已登录
          <div className="group relative flex items-center gap-2 cursor-pointer" onClick={logout}>
            <Image
              src={user.photoURL}
              alt={user.displayName}
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="hidden sm:block text-sm font-medium">{user.displayName}</span>
            {/* 提示登出 */}
            <div 
              className="absolute top-full right-0 mt-2 hidden group-hover:block bg-white dark:bg-black shadow-lg rounded px-4 py-2 text-sm whitespace-nowrap"
            >
              登出
            </div>
          </div>
        ) : (
          // 如果用户未登录，显示一个统一的登录按钮
          <button 
            onClick={() => setIsModalOpen(true)} // 2. 点击时，打开弹窗
            className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        )}
      </div>

      {/* 3. 渲染弹窗组件，并传递状态和关闭函数 */}
      <LoginModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
};

export default SocialLogins;

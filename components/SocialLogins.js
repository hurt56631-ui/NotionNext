// components/SocialLogins.js 【性能优化版】

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { useState, useEffect } from 'react';
// import LoginModal from './LoginModal'; // <-- 1. 注释掉或删除这行静态导入

// 2. 使用 next/dynamic 进行动态导入
import dynamic from 'next/dynamic';

const LoginModal = dynamic(
  () => import('./LoginModal'), // 组件路径
  { 
    loading: () => <p>加载中...</p>, // 可选：显示一个加载提示
    ssr: false // 【重要】强制只在客户端渲染，避免 Hydration 错误
  }
);

const SocialLogins = () => {
  const { user, logout } = useAuth();
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // 在客户端加载完成前，显示一个占位符，防止布局跳动
  if (!isMounted) {
    return <div className="w-20 h-8 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>;
  }

  const closeModal = () => setIsModalOpen(false);

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
              className="rounded-full border-2 border-gray-200 dark:border-gray-600"
            />
            <span className="hidden sm:block text-sm font-medium">{user.displayName}</span>
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-white dark:bg-black shadow-lg rounded px-4 py-2 text-sm whitespace-nowrap">
              登出
            </div>
          </div>
        ) : (
          // 如果用户未登录
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        )}
      </div>

      {/* 
        3. 这里的逻辑保持不变，但因为 LoginModal 是动态导入的，
           只有当 isModalOpen 变为 true 时，Next.js 才会去加载它的 JS 文件。
      */}
      {isModalOpen && <LoginModal isOpen={isModalOpen} onClose={closeModal} />}
    </>
  );
};

export default SocialLogins;

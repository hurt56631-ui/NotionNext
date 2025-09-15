// components/SocialLogins.js 【修改版】

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import LoginModal from './LoginModal';

const SocialLogins = () => {
  const { user, logout } = useAuth(); // 注意：这里不再需要 loginWith...
  const [isMounted, setIsMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>;
  }

  const closeModal = () => setIsModalOpen(false);

  return (
    <>
      <div className="flex items-center">
        {user ? (
          // ... 已登录的界面保持不变
          <div className="group relative flex items-center gap-2 cursor-pointer" onClick={logout}>
            <Image
              src={user.photoURL}
              alt={user.displayName}
              width={28}
              height={28}
              className="rounded-full"
            />
            <span className="hidden sm:block text-sm font-medium">{user.displayName}</span>
            <div className="absolute top-full right-0 mt-2 hidden group-hover:block bg-white dark:bg-black shadow-lg rounded px-4 py-2 text-sm whitespace-nowrap">
              登出
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 text-sm font-semibold bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            登录
          </button>
        )}
      </div>

      {/* 关键改动：把 closeModal 作为回调传给 LoginModal */}
      <LoginModal isOpen={isModalOpen} onClose={closeModal} />
    </>
  );
};

export default SocialLogins;

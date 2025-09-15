// components/GoogleLoginButton.js

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';

const GoogleLoginButton = () => {
  const { user, loginWithGoogle, logout } = useAuth();

  // 如果正在加载用户信息，可以先不显示任何东西或显示一个加载动画
  if (user === undefined) {
    return null; // 或者 return <div>Loading...</div>;
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

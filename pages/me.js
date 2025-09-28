// pages/me.js

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

// 这是一个页面级别的组件，用于显示用户信息和提供登出功能
export default function MePage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  // 监听认证状态的变化
  useEffect(() => {
    // 如果加载完成，并且没有用户信息，说明用户未登录，则重定向到首页
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  // 在加载期间或用户不存在时，显示加载中或null，防止页面闪烁
  if (loading || !user) {
    return (
        <div className='flex justify-center items-center min-h-screen'>
            <p>加载中...</p>
        </div>
    );
  }
  
  // 登出并跳转回首页
  const handleLogout = async () => {
    await logout();
    router.push('/');
  }

  // 如果用户已登录，渲染个人信息页面
  return (
    <div className='min-h-screen bg-gray-50 dark:bg-gray-900'>
        <div className="container mx-auto p-4 md:p-8 max-w-2xl">
            <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 text-center">
                <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-200">个人中心</h1>
                
                {/* 用户头像 */}
                <img 
                    src={user.photoURL} 
                    alt={user.displayName}
                    className="w-24 h-24 rounded-full mx-auto mb-4 border-4 border-blue-400 dark:border-blue-500"
                />

                {/* 用户名 */}
                <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300">{user.displayName}</h2>
                
                {/* 用户邮箱 */}
                <p className="text-gray-500 dark:text-gray-400 mt-1">{user.email}</p>

                {/* 登出按钮 */}
                <button
                    onClick={handleLogout}
                    className="mt-8 w-full md:w-auto bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition-colors duration-200"
                >
                    退出登录
                </button>
            </div>

            {/* 在这里可以添加更多个人中心的模块，例如我的帖子、我的收藏等 */}
            <div className="mt-8 bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">更多功能正在开发中...</h3>
            </div>
        </div>
    </div>
  );
}

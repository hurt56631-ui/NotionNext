// components/LoginModal.js (使用 Font Awesome 图标)

import { useAuth } from '../lib/AuthContext';

const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithFacebook } from useAuth();

  if (!isOpen) {
    return null;
  }

  return (
    // 全屏背景遮罩
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 弹窗主体 */}
      <div 
        className="relative w-full max-w-sm p-8 bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg backdrop-blur-lg backdrop-saturate-150 border border-gray-200/50 dark:border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 (使用 Font Awesome) */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white">
          <i className="fas fa-times text-xl"></i>
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">欢迎登录</h2>
        
        <div className="space-y-4">
          {/* Google 登录按钮 (使用 Font Awesome) */}
          <button 
            onClick={loginWithGoogle} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-all"
          >
            {/* 这里的 'fab fa-google' 是 Font Awesome 的 Google 图标类名 */}
            <i className="fab fa-google text-lg"></i>
            <span className="font-semibold text-gray-700">使用 Google 登录</span>
          </button>

          {/* Facebook 登录按钮 (使用 Font Awesome) */}
          <button 
            onClick={loginWithFacebook} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] rounded-lg shadow-md hover:bg-[#166fe5] transition-all"
          >
            {/* 这里的 'fab fa-facebook-f' 是 Font Awesome 的 Facebook 图标类名 */}
            <i className="fab fa-facebook-f text-lg text-white"></i>
            <span className="font-semibold text-white">使用 Facebook 登录</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

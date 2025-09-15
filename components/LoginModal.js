// components/LoginModal.js 【完整修复版】

import { useAuth } from '../lib/AuthContext';
import { Chrome, Facebook, X } from 'lucide-react';

const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithFacebook } = useAuth();

  if (!isOpen) {
    return null;
  }

  // 包装登录函数，调用时传入 onClose 作为回调
  const handleGoogleLogin = () => {
    loginWithGoogle(onClose);
  }

  const handleFacebookLogin = () => {
    loginWithFacebook(onClose);
  }

  return (
    // 这是一个完整的、单一的父元素 <div ...>
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-sm p-8 bg-white/80 dark:bg-gray-800/80 rounded-2xl shadow-lg backdrop-blur-lg backdrop-saturate-150 border border-gray-200/50 dark:border-gray-700/50"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-100 mb-6">欢迎登录</h2>
        
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-all"
          >
            <Chrome size={20} className="text-red-500" />
            <span className="font-semibold text-gray-700">使用 Google 登录</span>
          </button>

          <button 
            onClick={handleFacebookLogin} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] rounded-lg shadow-md hover:bg-[#166fe5] transition-all"
          >
            <Facebook size={20} className="text-white" />
            <span className="font-semibold text-white">使用 Facebook 登录</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

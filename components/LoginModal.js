// components/LoginModal.js

import { useAuth } from '../lib/AuthContext';
import Image from 'next/image';

const LoginModal = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginWithFacebook } = useAuth();

  if (!isOpen) {
    return null;
  }

  return (
    // 1. 全屏背景遮罩，点击时可以关闭弹窗
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* 2. 弹窗主体，使用 backdrop-blur-lg 实现磨砂玻璃效果 */}
      <div 
        className="relative w-full max-w-sm p-8 bg-white bg-opacity-80 rounded-2xl shadow-lg backdrop-blur-lg backdrop-saturate-150 border border-gray-200/50"
        onClick={(e) => e.stopPropagation()} // 防止点击弹窗内部时关闭
      >
        {/* 关闭按钮 */}
        <button 
          onClick={onClose} 
          className="absolute top-4 right-4 text-gray-600 hover:text-gray-900"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">欢迎登录</h2>
        
        <div className="space-y-4">
          {/* Google 登录按钮 */}
          <button 
            onClick={loginWithGoogle} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-white rounded-lg shadow-md hover:bg-gray-50 transition-all"
          >
            <Image src="/google-logo.svg" alt="Google Logo" width={24} height={24} />
            <span className="font-semibold text-gray-700">使用 Google 登录</span>
          </button>

          {/* Facebook 登录按钮 */}
          <button 
            onClick={loginWithFacebook} 
            className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-[#1877F2] rounded-lg shadow-md hover:bg-[#166fe5] transition-all"
          >
            <Image src="/facebook-logo.svg" alt="Facebook Logo" width={24} height={24} />
            <span className="font-semibold text-white">使用 Facebook 登录</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

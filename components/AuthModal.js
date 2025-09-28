// components/AuthModal.js
import { GoogleAuthProvider, FacebookAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase'; // 确保你已经创建了 firebase.js 文件
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';

// Google Provider
const googleProvider = new GoogleAuthProvider();
// Facebook Provider
const facebookProvider = new FacebookAuthProvider();

export default function AuthModal({ show, onClose }) {
  if (!show) {
    return null;
  }

  const handleSocialLogin = async (provider) => {
    try {
      const result = await signInWithPopup(auth, provider);
      console.log("登录成功!", result.user);
      onClose(); // 登录成功后关闭模态框
    } catch (error) {
      console.error("登录失败:", error);
      // 在这里可以处理错误，例如用户关闭了登录窗口
    }
  };

  return (
    // 背景遮罩
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
      onClick={onClose} // 点击背景关闭模态框
    >
      {/* 模态框内容 */}
      <div 
        className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full mx-4"
        onClick={(e) => e.stopPropagation()} // 防止点击内容区关闭模態框
      >
        <h2 className="text-2xl font-bold text-center mb-2 text-gray-800">欢迎回来</h2>
        <p className="text-center text-gray-500 mb-8">选择一个方式继续</p>
        
        {/* 登录按钮 */}
        <div className="space-y-4">
          <button 
            onClick={() => handleSocialLogin(googleProvider)}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FcGoogle size={24} />
            <span className="font-medium text-gray-700">使用 Google 登录</span>
          </button>
          <button 
            onClick={() => handleSocialLogin(facebookProvider)}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 bg-[#1877F2] text-white rounded-lg hover:bg-[#166eab] transition-colors"
          >
            <FaFacebook size={24} />
            <span className="font-medium">使用 Facebook 登录</span>
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center mt-8">
          登录即表示你同意我们的服务条款和隐私政策。
        </p>
      </div>
    </div>
  );
}

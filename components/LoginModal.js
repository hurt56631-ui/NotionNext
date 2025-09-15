// components/LoginModal.js 【修改版】

import { useAuth } from '../lib/AuthContext';
import { Chrome, Facebook, X } from 'lucide-react'; // 或者用 Font Awesome

const LoginModal = ({ isOpen, onClose }) => {
  // 关键改动：从 useAuth 获取登录函数
  const { loginWithGoogle, loginWithFacebook } = useAuth();

  if (!isOpen) {
    return null;
  }

  // 包装一下登录函数，调用时传入 onClose 作为回调
  const handleGoogleLogin = () => {
    loginWithGoogle(onClose);
  }

  const handleFacebookLogin = () => {
    loginWithFacebook(onClose);
  }

  return (
    <div className="fixed inset-0 z-50 ..." onClick={onClose}>
      <div className="relative w-full max-w-sm ..." onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} ...>
          <X size={24} />
        </button>
        <h2 ...>欢迎登录</h2>
        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin} // <-- 使用包装后的函数
            className="..."
          >
            <Chrome size={20} ... />
            <span>使用 Google 登录</span>
          </button>
          <button 
            onClick={handleFacebookLogin} // <-- 使用包装后的函数
            className="..."
          >
            <Facebook size={20} ... />
            <span>使用 Facebook 登录</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;

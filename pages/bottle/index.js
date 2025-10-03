// pages/bottle/index.js
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';

// 导入所有需要的组件
import OceanBackground from '../../components/bottle/OceanBackground';
import ThrowBottleModal from '../../components/bottle/ThrowBottleModal';
import PickedBottleModal from '../../components/bottle/PickedBottleModal';

import { FiPlus, FiGitMerge } from 'react-icons/fi'; // react-icons
import { FaCog } from 'react-icons/fa';


export default function BottlePage() {
  const [user] = useAuthState(auth);
  const [isThrowModalOpen, setThrowModalOpen] = useState(false);
  const [pickedBottle, setPickedBottle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const showFeedback = (message) => {
    setFeedback(message);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handlePickBottle = async () => {
    if (!user) return alert("请先登录！");
    
    setIsLoading(true);
    setFeedback('正在大海里捞一个瓶子...');
    const pickBottleFunc = httpsCallable(functions, 'pickBottle');
    try {
      const result = await pickBottleFunc();
      const { bottle, message } = result.data;
      
      if (bottle) {
        // Firestore Timestamp需要转换成Date对象
        bottle.createdAt = new Date(bottle.createdAt._seconds * 1000);
        setPickedBottle(bottle);
        setFeedback('');
      } else {
        showFeedback(message || "大海空空如也。");
      }
    } catch (error) {
      console.error("Error picking bottle:", error);
      showFeedback(`出错了: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bottle-page-container">
      <OceanBackground />
      <div className="page-content">
        <Link href="/bottle/settings" className="settings-link">
          <FaCog /> 设置
        </Link>
        
        {feedback && <div className="feedback-toast">{feedback}</div>}

        <div className="main-actions">
          <button onClick={() => setThrowModalOpen(true)} disabled={isLoading} title="扔一个">
            <FiPlus size={32} />
            <span>扔一个</span>
          </button>
          <button onClick={handlePickBottle} disabled={isLoading} title="捞一个">
            <FiGitMerge size={32} />
            <span>捞一个</span>
          </button>
        </div>
      </div>

      <ThrowBottleModal
        isOpen={isThrowModalOpen}
        onClose={() => setThrowModalOpen(false)}
      />

      {pickedBottle && (
        <PickedBottleModal
          bottle={pickedBottle}
          onClose={() => setPickedBottle(null)}
        />
      )}
    </div>
  );
}

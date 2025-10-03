// components/bottle/PickedBottleModal.js
import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, auth, db } from '../../lib/firebase';
import { FaPaperPlane, FaUndo, FaVolumeUp } from 'react-icons/fa';
import { playCachedTTS, preloadTTS } from '../../lib/aiUtils';
import TranslationView from './TranslationView'; // 引入我们的翻译组件

export default function PickedBottleModal({ bottle, onClose }) {
  const router = useRouter();
  const [userSettings, setUserSettings] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (bottle && auth.currentUser) {
      // 预加载原文TTS
      preloadTTS(bottle.content);
      
      // 获取用户设置
      const fetchSettings = async () => {
        const settingsRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        if (docSnap.exists()) {
          setUserSettings(docSnap.data());
        } else {
          // 如果用户没有设置，可以提供一个默认提示
          setUserSettings(null); 
        }
      };
      fetchSettings();
    }
  }, [bottle]);

  const handleThrowBack = async () => {
    setIsActionLoading(true);
    const throwBackFunc = httpsCallable(functions, 'throwBackBottle');
    try {
      await throwBackFunc({ bottleId: bottle.id });
      onClose();
    } catch (error) {
      console.error("Error throwing back:", error);
      alert(`扔回失败: ${error.message}`);
    }
    setIsActionLoading(false);
  };
  
  const handleReply = () => { /* ...代码与之前相同... */ };

  if (!bottle) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bottle-view" onClick={(e) => e.stopPropagation()}>
        {/* ... (Bottle Header 部分与之前相同) ... */}
        <div className="bottle-body">
          <div className="text-with-tts">
            <p>{bottle.content}</p>
            <button onClick={() => playCachedTTS(bottle.content)} className="tts-button">
              <FaVolumeUp />
            </button>
          </div>
          <TranslationView originalText={bottle.content} userSettings={userSettings} />
        </div>

        <div className="modal-actions">
          <button className="button-secondary" onClick={handleThrowBack} disabled={isActionLoading}>
            <FaUndo/> 扔回海里
          </button>
          <button onClick={handleReply} disabled={isActionLoading}>
            <FaPaperPlane/> 回复
          </button>
        </div>
      </div>
    </div>
  );
}

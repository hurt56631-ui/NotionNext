import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc } from 'firebase/firestore';
import { functions, auth, db } from '../../lib/firebase';
import { FaPaperPlane, FaUndo, FaVolumeUp } from 'react-icons/fa';
import { playCachedTTS, preloadTTS } from '../../lib/aiUtils';
import TranslationView from './TranslationView';
import styles from '../../styles/Bottle.module.css';
export default function PickedBottleModal({ bottle, onClose }) {
  const router = useRouter();
  const [userSettings, setUserSettings] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  useEffect(() => {
    if (bottle && auth.currentUser) {
      preloadTTS(bottle.content);
      const fetchSettings = async () => {
        const settingsRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        setUserSettings(docSnap.exists() ? docSnap.data() : null);
      };
      fetchSettings();
    }
  }, [bottle]);
  const handleThrowBack = async () => {
    setIsActionLoading(true);
    const throwBackFunc = httpsCallable(functions, 'throwBackBottle');
    try { await throwBackFunc({ bottleId: bottle.id }); onClose(); } catch (error) { alert(`扔回失败: ${error.message}`); }
    setIsActionLoading(false);
  };
  const handleReply = () => { const chatId = [auth.currentUser.uid, bottle.throwerId].sort().join('_'); router.push(`/messages/${chatId}`); };
  const getDriftTime = () => { const throwTime = bottle.createdAt?.toDate ? bottle.createdAt.toDate() : new Date(bottle.createdAt); const diffMinutes = Math.round((new Date() - throwTime) / 60000); if (diffMinutes < 60) return `${diffMinutes}分钟`; return `${Math.round(diffMinutes / 60)}小时`; };
  if (!bottle) return null;
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={`${styles.modalContent} ${styles.bottleView}`} onClick={(e) => e.stopPropagation()}>
        <div className={styles.bottleHeader}><img src={bottle.throwerAvatar || '/default-avatar.png'} alt="avatar"/><div><p>来自 {bottle.throwerName} 的瓶子</p><span>漂流了约 {getDriftTime()}</span></div></div>
        <div className={styles.bottleBody}><div className={styles.textWithTts}><p>{bottle.content}</p><button onClick={() => playCachedTTS(bottle.content)} className={`${styles.button} ${styles.ttsButton}`}><FaVolumeUp /></button></div><TranslationView originalText={bottle.content} userSettings={userSettings} /></div>
        <div className={styles.modalActions}><button className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleThrowBack} disabled={isActionLoading}><FaUndo/> 扔回海里</button><button className={styles.button} onClick={handleReply} disabled={isActionLoading}><FaPaperPlane/> 回复</button></div>
      </div>
    </div>
  );
}

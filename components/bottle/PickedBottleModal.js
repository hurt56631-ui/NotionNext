// 文件路径: components/bottle/PickedBottleModal.js

import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { FaUndo } from 'react-icons/fa';
import styles from '../../styles/Bottle.module.css';

// 这是一个简化的 TranslationView 占位组件，您可以后续实现
function TranslationView({ originalText }) {
  return (
    <div className={styles.translationView}>
      <h4>翻译结果 (占位)</h4>
      <p>{originalText}</p>
    </div>
  );
}

export default function PickedBottleModal({ bottle, onClose }) {
  const [userSettings, setUserSettings] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 假设的获取用户翻译设置的逻辑
    if (bottle && auth.currentUser) {
      const fetchSettings = async () => {
        const settingsRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        setUserSettings(docSnap.exists() ? docSnap.data() : { autoTranslate: false });
      };
      fetchSettings();
    }
  }, [bottle]);

  const handleThrowBack = async () => {
    if (!auth.currentUser) {
      setError("请先登录！");
      return;
    }
    if (!bottle || !bottle.id) {
        setError("瓶子信息错误！");
        return;
    }

    setIsActionLoading(true);
    setError('');
    const bottleRef = doc(db, 'bottles', bottle.id);

    try {
      // 直接更新文档状态
      await updateDoc(bottleRef, {
        status: "drifting",
        pickedBy: null,
        pickedAt: null,
      });
      onClose(); // 成功后关闭
    } catch (error) {
      console.error("扔回失败:", error);
      setError(`扔回失败: ${error.message}`);
    } finally {
        setIsActionLoading(false);
    }
  };

  const getDriftTime = () => {
    if (!bottle?.createdAt) return '未知时间';
    const now = new Date();
    const thrownDate = bottle.createdAt instanceof Date ? bottle.createdAt : bottle.createdAt.toDate();
    const diff = now.getTime() - thrownDate.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return '刚刚';
    if (hours < 24) return `${hours}小时前`;
    return `${Math.floor(hours / 24)}天前`;
  };

  if (!bottle) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.bottleHeader}>
          <img
            src={bottle.throwerAvatar || '/default-avatar.png'}
            alt={bottle.throwerName}
            className={styles.avatar}
          />
          <div>
            <strong>{bottle.throwerName}</strong>
            <small>漂流于 {getDriftTime()}</small>
          </div>
        </div>
        
        <div className={styles.bottleMessage}>
          <p>{bottle.content}</p>
        </div>

        {userSettings?.autoTranslate && <TranslationView originalText={bottle.content} />}
        
        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.modalActions}>
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={handleThrowBack}
            disabled={isActionLoading}
          >
            <FaUndo /> {isActionLoading ? '正在扔回...' : '扔回海里'}
          </button>
          <button className={styles.button} onClick={onClose}>
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}

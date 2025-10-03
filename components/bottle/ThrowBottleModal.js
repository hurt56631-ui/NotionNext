// 文件路径: components/bottle/ThrowBottleModal.js (完整替换)

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase'; // 只需要 auth 和 db
// import { useAuthState } from 'react-firebase-hooks/auth'; // <<< 删除这一行
import styles from '../../styles/Bottle.module.css';

export default function ThrowBottleModal({ isOpen, onClose }) {
  // const [user] = useAuthState(auth); // <<< 删除这一行
  const [content, setContent] = useState('');
  const [isThrowing, setIsThrowing] = useState(false);
  const [error, setError] = useState('');

  const handleThrow = async () => {
    // ▼▼▼ 修改在这里 ▼▼▼
    // 我们直接从 auth 对象获取当前登录的用户
    const user = auth.currentUser; 
    
    if (!content.trim()) {
      setError("瓶子内容不能为空！");
      return;
    }
    if (!user) {
      setError("请先登录！");
      return;
    }

    setIsThrowing(true);
    setError('');

    const newBottle = {
      content: content,
      throwerId: user.uid,
      throwerName: user.displayName || "一位旅行者",
      throwerAvatar: user.photoURL || null,
      createdAt: serverTimestamp(),
      status: "drifting",
      pickedBy: null,
      pickedAt: null,
      random: Math.random(),
    };

    try {
      const bottlesCollectionRef = collection(db, 'bottles');
      await addDoc(bottlesCollectionRef, newBottle);
      setContent('');
      onClose();
    } catch (error) {
      console.error("扔瓶子失败:", error);
      setError(`扔瓶子失败: ${error.message}`);
    } finally {
      setIsThrowing(false);
    }
  };

  if (!isOpen) return null;

  // JSX 部分没有变化
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <h2>写一个瓶子</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写下你的心情..."
          rows="8"
          disabled={isThrowing}
        />
        {error && <p className={styles.errorText}>{error}</p>}
        <div className={styles.modalActions}>
          <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={onClose} disabled={isThrowing}>
            取消
          </button>
          <button className={styles.button} onClick={handleThrow} disabled={isThrowing}>
            {isThrowing ? '正在扔...' : '扔进海里'}
          </button>
        </div>
      </div>
    </div>
  );
}

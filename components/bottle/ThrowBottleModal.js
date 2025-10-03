// 文件路径: components/bottle/ThrowBottleModal.js

import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import styles from '../../styles/Bottle.module.css';

export default function ThrowBottleModal({ isOpen, onClose }) {
  const [user] = useAuthState(auth);
  const [content, setContent] = useState('');
  const [isThrowing, setIsThrowing] = useState(false);
  const [error, setError] = useState('');

  const handleThrow = async () => {
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

    // 构建瓶子对象，信息来自当前登录的用户
    const newBottle = {
      content: content,
      throwerId: user.uid,
      throwerName: user.displayName || "一位旅行者", // 确保有默认值
      throwerAvatar: user.photoURL || null,
      createdAt: serverTimestamp(), // 使用服务器时间
      status: "drifting",
      pickedBy: null,
      pickedAt: null,
      random: Math.random(), // 用于随机捞取
    };

    try {
      // 直接向 'bottles' 集合添加一个新文档
      const bottlesCollectionRef = collection(db, 'bottles');
      await addDoc(bottlesCollectionRef, newBottle);
      
      setContent('');
      onClose(); // 成功后关闭模态框
    } catch (error) {
      console.error("扔瓶子失败:", error);
      setError(`扔瓶子失败: ${error.message}`);
    } finally {
      setIsThrowing(false);
    }
  };

  if (!isOpen) return null;

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
          <button
            className={`${styles.button} ${styles.buttonSecondary}`}
            onClick={onClose}
            disabled={isThrowing}
          >
            取消
          </button>
          <button
            className={styles.button}
            onClick={handleThrow}
            disabled={isThrowing}
          >
            {isThrowing ? '正在扔...' : '扔进海里'}
          </button>
        </div>
      </div>
    </div>
  );
}

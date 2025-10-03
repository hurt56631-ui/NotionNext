// components/bottle/ThrowBottleModal.js
import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions, auth } from '../../lib/firebase';

export default function ThrowBottleModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [isThrowing, setIsThrowing] = useState(false);

  const handleThrow = async () => {
    if (!content.trim()) return alert("瓶子内容不能为空！");
    if (!auth.currentUser) return alert("请先登录！");
    
    setIsThrowing(true);
    const throwBottleFunc = httpsCallable(functions, 'throwBottle');
    try {
      await throwBottleFunc({ content });
      setContent('');
      onClose();
    } catch (error) {
      console.error("Error throwing bottle:", error);
      alert(`扔瓶子失败: ${error.message}`);
    } finally {
      setIsThrowing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>写一个瓶子</h2>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="在这里写下你的心情..."
          rows="8"
        />
        <div className="modal-actions">
          <button className="button-secondary" onClick={onClose}>取消</button>
          <button onClick={handleThrow} disabled={isThrowing}>
            {isThrowing ? '正在扔...' : '扔进海里'}
          </button>
        </div>
      </div>
    </div>
  );
}

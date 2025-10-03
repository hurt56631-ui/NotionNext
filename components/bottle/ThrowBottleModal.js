// /components/bottle/ThrowBottleModal.js (最简化版)

import { useState } from 'react';
import styles from '../../styles/Bottle.module.css';

export default function ThrowBottleModal({ isOpen, onClose, onThrow, isThrowing }) {
    const [content, setContent] = useState('');

    const handleThrowClick = () => {
        if (!content.trim()) {
            alert("瓶子内容不能为空！");
            return;
        }
        onThrow(content); // 将内容回调给父组件处理
    };

    // 关闭时清空内容
    const handleClose = () => {
        setContent('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <h2>写一个瓶子</h2>
                <textarea 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    placeholder="在这里写下你的心情..." 
                    rows="8"
                    disabled={isThrowing}
                />
                <div className={styles.modalActions}>
                    <button className={`${styles.button} ${styles.buttonSecondary}`} onClick={handleClose} disabled={isThrowing}>
                        取消
                    </button>
                    <button className={styles.button} onClick={handleThrowClick} disabled={isThrowing}>
                        {isThrowing ? '正在扔...' : '扔进海里'}
                    </button>
                </div>
            </div>
        </div>
    );
}

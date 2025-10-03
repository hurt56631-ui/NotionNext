// /components/bottle/PickedBottleModal.js (最终完全重构版)

import { useState } from 'react';
import styles from '../../styles/Bottle.module.css';
import { FiX } from 'react-icons/fi';

export default function PickedBottleModal({ bottle, onClose, onReply, onPickAnother }) {
    const [replyContent, setReplyContent] = useState('');

    const handleReplyClick = () => {
        if (!replyContent.trim()) {
            alert("回复内容不能为空！");
            return;
        }
        // 如果这是一个匿名瓶子，则调用 onReply
        if (bottle.isAnonymous && onReply) {
            onReply(bottle, replyContent);
        }
        // 这里可以扩展非匿名瓶子的回复逻辑
    };

    if (!bottle) return null;

    return (
        <div className={styles.modalOverlay}>
            <div className={styles.pickedModalContent}>
                <FiX className={styles.closeButton} onClick={onClose} />
                
                <div className={styles.pickedHeader}>
                    <div className={styles.anonymousAvatar}></div>
                    <div className={styles.anonymousInfo}>
                        <span>这个夏天一个人</span>
                        <p>城市保密 (仅限会员可见)</p>
                    </div>
                </div>

                <p className={styles.pickedContent}>
                    {bottle.content}
                </p>

                <textarea
                    className={styles.replyInput}
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    placeholder="回应一下对方..."
                />

                <div className={styles.pickedActions}>
                    <button className={`${styles.actionButton} ${styles.replyButton}`} onClick={handleReplyClick}>
                        回复对方
                    </button>
                    <button className={`${styles.actionButton} ${styles.pickAnotherButton}`} onClick={onPickAnother}>
                        再捞一个
                    </button>
                </div>
            </div>
        </div>
    );
}

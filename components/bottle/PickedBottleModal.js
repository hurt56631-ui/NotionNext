// /components/bottle/PickedBottleModal.js (最终重构版)

import { useState } from 'react';
import styles from '../../styles/Bottle.module.css';
import { FiGlobe } from 'react-icons/fi';

export default function PickedBottleModal({ bottle, onClose, onReply, onThrowBack, onPickAnother, onTranslate }) {
    const [replyContent, setReplyContent] = useState('');
    const [translatedText, setTranslatedText] = useState(null);
    const [isTranslating, setIsTranslating] = useState(false);

    const handleReplyClick = () => {
        if (!replyContent.trim()) { alert("回复内容不能为空！"); return; }
        if (onReply) { onReply(bottle, replyContent); }
    };
    
    const handleTranslateClick = async () => {
        setIsTranslating(true);
        setTranslatedText(null);
        try {
            const result = await onTranslate(bottle.content);
            setTranslatedText(result);
        } catch (error) {
            setTranslatedText(`翻译失败: ${error.message}`);
        } finally {
            setIsTranslating(false);
        }
    };

    if (!bottle) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.pickedModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.pickedHeader}>
                    <div className={styles.anonymousAvatar}></div>
                    <div className={styles.anonymousInfo}>
                        <span>来自远方的瓶子</span>
                        <p>{bottle.category}</p>
                    </div>
                </div>
                <p className={styles.pickedContent}>{bottle.content}</p>
                {translatedText && <div className={styles.translationResult}>{translatedText}</div>}
                
                <div className={styles.pickedControls}>
                    <button onClick={handleTranslateClick} disabled={isTranslating}>{isTranslating ? '翻译中...' : '翻译'}</button>
                    <button onClick={() => onThrowBack(bottle)}>放回海里</button>
                </div>
                
                <textarea className={styles.replyInput} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder="回应一下对方..." />
                <div className={styles.pickedActions}>
                    <button className={`${styles.actionButton} ${styles.replyButton}`} onClick={handleReplyClick}>回复对方</button>
                    <button className={`${styles.actionButton} ${styles.pickAnotherButton}`} onClick={onPickAnother}>再捞一个</button>
                </div>
            </div>
        </div>
    );
}

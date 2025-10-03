// /components/bottle/ThrowBottleModal.js (最终重构版)

import { useState } from 'react';
import styles from '../../styles/Bottle.module.css';

const bottleCategories = [ { name: '普通瓶', icon: '🗣️' }, { name: '交友瓶', icon: '🤝' }, { name: '脱单瓶', icon: '💕' }, { name: '心情瓶', icon: '😊' }, { name: '提问瓶', icon: '❓' }, { name: '真心话', icon: '🤫' }, { name: '祝福瓶', icon: '🎉' }, { name: '话题瓶', icon: '💬' }, ];

export default function ThrowBottleModal({ isOpen, onClose, onThrow, isThrowing }) {
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('普通瓶');

    const handleThrowClick = () => {
        if (!content.trim()) { alert("发表内容不能为空！"); return; }
        onThrow({ content, category });
    };

    const handleClose = () => { setContent(''); setCategory('普通瓶'); onClose(); };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={handleClose}>
            <div className={styles.throwModalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.throwModalHeader}><span>发送信息</span></div>
                <div className={styles.throwModalBody}>
                    <h4>选择漂流瓶</h4>
                    <div className={styles.categoryGrid}>
                        {bottleCategories.map((cat) => (
                            <button key={cat.name} className={`${styles.categoryButton} ${category === cat.name ? styles.active : ''}`} onClick={() => setCategory(cat.name)}>
                                <div className={styles.categoryIcon}>{cat.icon}</div>
                                <span>{cat.name}</span>
                            </button>
                        ))}
                    </div>
                    <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="请输入内容..." disabled={isThrowing} />
                </div>
                <div className={styles.throwModalFooter}>
                    <button className={styles.confirmButton} onClick={handleThrowClick} disabled={isThrowing || !content.trim()}>
                        {isThrowing ? '正在发送...' : '确定发送'}
                    </button>
                </div>
            </div>
        </div>
    );
}

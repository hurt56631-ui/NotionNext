// /components/bottle/SettingsModal.js (新文件)

import { useState, useEffect } from 'react';
import styles from '../../styles/Bottle.module.css';
import { FiX } from 'react-icons/fi';

export default function SettingsModal({ isOpen, onClose, initialSettings, onSave }) {
    const [settings, setSettings] = useState(initialSettings);

    useEffect(() => {
        setSettings(initialSettings);
    }, [initialSettings]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.settingsModalContent} onClick={(e) => e.stopPropagation()}>
                <FiX className={styles.closeButton} onClick={onClose} />
                <h3>翻译设置 (OpenAI)</h3>
                <div className={styles.formGroup}>
                    <label>API 密钥 (Key)</label>
                    <input type="password" name="apiKey" value={settings?.apiKey || ''} onChange={handleChange} placeholder="sk-..." />
                </div>
                <div className={styles.formGroup}>
                    <label>接口地址 (URL)</label>
                    <input type="text" name="apiUrl" value={settings?.apiUrl || ''} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
                    <label>模型 (Model)</label>
                    <input type="text" name="model" value={settings?.model || ''} onChange={handleChange} />
                </div>
                <div className={styles.formGroup}>
                    <label>目标语言</label>
                    <input type="text" name="targetLang" value={settings?.targetLang || ''} onChange={handleChange} placeholder="例如: 中文, English" />
                </div>
                <button className={styles.confirmButton} onClick={() => onSave(settings)}>
                    保存设置
                </button>
            </div>
        </div>
    );
}

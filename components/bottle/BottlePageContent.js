// /components/bottle/BottlePageContent.js (最终集成版)

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp, addDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import Link from 'next/link';
import { FiSettings } from 'react-icons/fi';
import styles from '../../styles/Bottle.module.css';

import ThrowBottleModal from './ThrowBottleModal';
import PickedBottleModal from './PickedBottleModal';
import SettingsModal from './SettingsModal'; // ✅ 引入新组件
import { translateText } from '../../lib/openai'; // ✅ 引入新功能

// ... (playSound 函数保持不变) ...

const today = () => new Date().toISOString().split('T')[0];

export default function BottlePageContent() {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);

    const [isThrowModalOpen, setThrowModalOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [pickedBottle, setPickedBottle] = useState(null);
    
    const [isLoading, setIsLoading] = useState(false);
    const [isPickingAnimation, setIsPickingAnimation] = useState(false);
    const [throwAnimation, setThrowAnimation] = useState(false);
    const [feedback, setFeedback] = useState('');

    // ✅ 核心修改: 获取并管理用户数据 (次数、设置)
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                const userRef = doc(db, 'users', currentUser.uid);
                const userSnap = await getDoc(userRef);
                if (userSnap.exists()) {
                    const data = userSnap.data();
                    // 检查是否需要重置每日次数
                    if (data.dailyUsage?.lastReset !== today()) {
                        const newUsage = { throwCount: 5, pickCount: 15, lastReset: today() };
                        await updateDoc(userRef, { dailyUsage: newUsage });
                        setUserData({ ...data, dailyUsage: newUsage });
                    } else {
                        setUserData(data);
                    }
                } else {
                    // 为新用户创建数据结构
                    const initialData = { uid: currentUser.uid, displayName: currentUser.displayName, dailyUsage: { throwCount: 5, pickCount: 15, lastReset: today() }, translationSettings: { apiKey: "", apiUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-3.5-turbo", targetLang: "中文" } };
                    await setDoc(userRef, initialData);
                    setUserData(initialData);
                }
            } else {
                setUserData(null);
            }
            setLoadingUser(false);
        });
        return () => unsubscribe();
    }, []);

    // ... (showFeedback 函数保持不变) ...

    const handleThrowBottle = async ({ content, category }) => {
        if (!user || !userData) return;
        if (userData.dailyUsage.throwCount <= 0) { showFeedback("今天的扔瓶子次数已用完！"); return; }
        
        setIsLoading(true);
        const newBottle = { /* ... (与之前相同) ... */ };
        try {
            await addDoc(collection(db, 'bottles'), newBottle);
            // 更新次数
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { "dailyUsage.throwCount": userData.dailyUsage.throwCount - 1 });
            
            playSound('/sounds/reng.mp3');
            setThrowModalOpen(false);
            setThrowAnimation(true); // 触发扔瓶子动画
            setTimeout(() => setThrowAnimation(false), 2000);
        } catch (error) { /* ... */ } 
        finally { setIsLoading(false); }
    };

    const handlePickBottle = async () => {
        if (!user || !userData) return;
        if (userData.dailyUsage.pickCount <= 0) { showFeedback("今天的捞瓶子次数已用完！"); return; }

        setIsPickingAnimation(true); // 显示捞瓶子动画
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { "dailyUsage.pickCount": userData.dailyUsage.pickCount - 1 });

        // 模拟捞瓶子过程和概率
        setTimeout(async () => {
            if (Math.random() > 1 / 3) {
                showFeedback("唉，捞到了一个空瓶子...");
                setIsPickingAnimation(false);
                return;
            }
            // ... (捞瓶子的数据库逻辑，与之前相同) ...
            // 成功后:
            // setPickedBottle({ ... });
            setIsPickingAnimation(false);
        }, 2000); // 动画持续2秒
    };

    const handleThrowBack = async (bottle) => { /* ... (逻辑不变) ... */ };
    const handlePickAnother = () => { /* ... (逻辑不变) ... */ };
    
    const handleSaveSettings = async (newSettings) => {
        if (!user) return;
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { translationSettings: newSettings });
        setIsSettingsOpen(false);
        showFeedback("设置已保存！");
    };

    const handleTranslate = async (text) => {
        if (!userData?.translationSettings) { throw new Error("翻译设置未加载。"); }
        return await translateText(text, userData.translationSettings);
    };

    const handleAnonymousReply = async (bottle, replyContent) => {
        // ... (与上一个回复中的代码相同，用于创建私信) ...
    };

    // ... (handleLogin, loadingUser return ... )

    return (
        <div className={styles.pageContainer}>
            {/* ... (Header JSX 不变) ... */}
            
            {/* ✅ 动画: 扔瓶子 */}
            {throwAnimation && <div className={styles.throwAnimation}>...</div>}
            
            {/* ✅ 动画: 捞瓶子 */}
            {isPickingAnimation && <div className={styles.pickingOverlay}>...</div>}

            <div className={styles.bottomActions}>
                 <button className={styles.fab} onClick={() => user ? setThrowModalOpen(true) : showFeedback('请先登录！')}>
                    <img src="/images/jian.png" alt="扔一个" className={styles.fabIcon} />
                    <span>扔一个 ({userData?.dailyUsage?.throwCount || 0})</span>
                </button>
                <button className={styles.fab} onClick={handlePickBottle}>
                    <img src="/images/lao.png" alt="捞一个" className={styles.fabIcon} />
                    <span>捞一个 ({userData?.dailyUsage?.pickCount || 0})</span>
                </button>
                <Link href="/messages" passHref>
                    <a className={styles.fab}>
                        <img src="/images/xin.png" alt="我的消息" className={styles.fabIcon} />
                        <span>信封</span>
                    </a>
                </Link>
            </div>

            <ThrowBottleModal isOpen={isThrowModalOpen} onClose={() => setThrowModalOpen(false)} onThrow={handleThrowBottle} isThrowing={isLoading} />
            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} initialSettings={userData?.translationSettings} onSave={handleSaveSettings} />
            {pickedBottle && (
                <PickedBottleModal 
                    bottle={pickedBottle} 
                    onClose={() => setPickedBottle(null)} 
                    onPickAnother={handlePickAnother}
                    onReply={handleAnonymousReply}
                    onThrowBack={handleThrowBack}
                    onTranslate={handleTranslate}
                />
            )}
        </div>
    );
            }

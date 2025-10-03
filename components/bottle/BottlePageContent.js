// /components/bottle/BottlePageContent.js (最终修版)

import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp, addDoc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import Link from 'next/link';
import { FiSettings } from 'react-icons/fi';
import styles from '../../styles/Bottle.module.css';

import ThrowBottleModal from './ThrowBottleModal';
import PickedBottleModal from './PickedBottleModal';
import SettingsModal from './SettingsModal';
import { translateText } from '../../lib/openai';

const playSound = (soundFile) => { try { new Audio(soundFile).play(); } catch (e) { console.error("Audio error:", e); } };
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

    const fetchUserData = useCallback(async (currentUser) => {
        if (!currentUser) { setUserData(null); setLoadingUser(false); return; }
        const userRef = doc(db, 'users', currentUser.uid);
        const userSnap = await getDoc(userRef);
        let currentData;
        if (userSnap.exists()) {
            currentData = userSnap.data();
            if (currentData.dailyUsage?.lastReset !== today()) {
                const newUsage = { throwCount: 5, pickCount: 15, lastReset: today() };
                await updateDoc(userRef, { dailyUsage: newUsage });
                currentData.dailyUsage = newUsage;
            }
        } else {
            currentData = { uid: currentUser.uid, displayName: currentUser.displayName, dailyUsage: { throwCount: 5, pickCount: 15, lastReset: today() }, translationSettings: { apiKey: "", apiUrl: "https://api.openai.com/v1/chat/completions", model: "gpt-3.5-turbo", targetLang: "中文" } };
            await setDoc(userRef, currentData);
        }
        setUserData(currentData);
        setLoadingUser(false);
    }, []);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            fetchUserData(currentUser);
        });
        return () => unsubscribe();
    }, [fetchUserData]);

    const showFeedback = (message, duration = 3000) => { setFeedback(message); if (duration > 0) { setTimeout(() => setFeedback(''), 3000); } };

    const handleThrowBottle = async ({ content, category }) => {
        if (!user || !userData || userData.dailyUsage.throwCount <= 0) { showFeedback("今天的扔瓶子次数已用完！"); return; }
        setIsLoading(true);
        const newBottle = { content, category, throwerId: user.uid, throwerName: user.displayName || "匿名", throwerAvatar: user.photoURL, createdAt: serverTimestamp(), status: "drifting", pickedBy: null, pickedAt: null, random: Math.random() };
        try {
            await addDoc(collection(db, 'bottles'), newBottle);
            await updateDoc(doc(db, 'users', user.uid), { "dailyUsage.throwCount": userData.dailyUsage.throwCount - 1 });
            playSound('/sounds/reng.mp3');
            setThrowModalOpen(false);
            setThrowAnimation(true);
            setTimeout(() => setThrowAnimation(false), 2000);
        } catch (error) { showFeedback(`扔瓶子失败: ${error.message}`); } 
        finally { setIsLoading(false); fetchUserData(user); }
    };

    const handlePickBottle = async () => {
        if (isLoading) return;
        if (!user || !userData || userData.dailyUsage.pickCount <= 0) { showFeedback("今天的捞瓶子次数已用完！"); return; }
        setIsLoading(true);
        setIsPickingAnimation(true);
        try {
            await updateDoc(doc(db, 'users', user.uid), { "dailyUsage.pickCount": userData.dailyUsage.pickCount - 1 });
            setTimeout(async () => {
                if (Math.random() > 0.33) {
                    showFeedback("唉，捞到了一个空瓶子...");
                } else {
                    const bottlesRef = collection(db, 'bottles');
                    const randomValue = Math.random();
                    const q = query(bottlesRef, where("status", "==", "drifting"), where("throwerId", "!=", user.uid), where("random", ">=", randomValue), limit(1));
                    const querySnapshot = await getDocs(q);
                    const bottleDoc = querySnapshot.docs[0];
                    if (!bottleDoc) { showFeedback("大海空空如也..."); } else {
                         await runTransaction(db, async (transaction) => {
                            const bottleRef = doc(db, 'bottles', bottleDoc.id);
                            const freshBottleSnap = await transaction.get(bottleRef);
                            if (freshBottleSnap.data()?.status !== 'drifting') { throw new Error("手滑了，瓶子被别人先捞走了！"); }
                            transaction.update(bottleRef, { status: "picked", pickedBy: user.uid, pickedAt: serverTimestamp() });
                            playSound('/sounds/lao.mp3');
                            setPickedBottle({ id: freshBottleSnap.id, ...freshBottleSnap.data() });
                        });
                    }
                }
                setIsPickingAnimation(false);
                setIsLoading(false);
                fetchUserData(user);
            }, 2000);
        } catch (error) { showFeedback(error.message); setIsLoading(false); setIsPickingAnimation(false); fetchUserData(user); }
    };

    const handleThrowBack = async (bottle) => {
        if (!bottle) return;
        setPickedBottle(null);
        const bottleRef = doc(db, 'bottles', bottle.id);
        await updateDoc(bottleRef, { status: 'drifting', pickedBy: null, pickedAt: null });
        showFeedback("瓶子已放回大海。");
    };

    const handlePickAnother = () => { setPickedBottle(null); setTimeout(() => handlePickBottle(), 300); };
    
    const handleSaveSettings = async (newSettings) => {
        if (!user) return;
        await updateDoc(doc(db, 'users', user.uid), { translationSettings: newSettings });
        setIsSettingsOpen(false);
        showFeedback("设置已保存！");
    };

    const handleTranslate = async (text) => {
        if (!userData?.translationSettings) { throw new Error("翻译设置未加载。"); }
        return await translateText(text, userData.translationSettings);
    };

    const handleAnonymousReply = async (bottle, replyContent) => {
        if (!user || !replyContent.trim()) return;
        const chatId = [bottle.throwerId, user.uid].sort().join('_');
        const chatRef = doc(db, 'privateChats', chatId);
        try {
            await runTransaction(db, async (transaction) => {
                const chatDoc = await transaction.get(chatRef);
                if (!chatDoc.exists()) { transaction.set(chatRef, { members: [bottle.throwerId, user.uid], createdAt: serverTimestamp(), isPinned: false }); }
                const newMsgRef = doc(collection(chatRef, 'messages'));
                transaction.set(newMsgRef, { senderId: user.uid, text: replyContent, createdAt: serverTimestamp() });
                transaction.update(chatRef, { lastMessage: replyContent, lastMessageAt: serverTimestamp(), unreadCounts: { [bottle.throwerId]: 1 } });
                transaction.delete(doc(db, 'bottles', bottle.id));
            });
            setPickedBottle(null);
            showFeedback("回复成功！你们已成为好友。");
        } catch (error) { showFeedback("回复失败，请重试。"); }
    };

    if (loadingUser) { return <div className="loading-screen">正在连接海洋...</div>; }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <h1>海洋</h1>
                <div className={styles.headerIcons}>
                    <FiSettings className={styles.headerIcon} aria-label="Settings" onClick={() => setIsSettingsOpen(true)} />
                    {user ? ( <img src={user.photoURL || '/default-avatar.png'} alt="My Profile" className={styles.profileIcon} /> ) 
                    : ( <button onClick={() => alert('请实现登录功能')} style={{background: 'none', border: 'none'}}> <img src={'/default-avatar.png'} alt="Login" className={styles.profileIcon} /> </button> )}
                </div>
            </div>
            {feedback && <div className={styles.feedbackBanner}>{feedback}</div>}
            {throwAnimation && <div className={styles.throwAnimation}><img src="/images/jian.png" alt="throwing bottle"/></div>}
            {isPickingAnimation && <div className={styles.pickingOverlay}><div className={styles.pickingAnimation}><img src="/images/lao.png" alt="picking bottle"/><span>捞瓶子...</span></div></div>}

            <div className={styles.bottomActions}>
                 <button className={styles.fab} onClick={() => user ? setThrowModalOpen(true) : showFeedback('请先登录！')} disabled={isLoading}>
                    <img src="/images/jian.png" alt="扔一个" className={styles.fabIcon} />
                    <span>扔一个 <span className={styles.countBadge}>{userData?.dailyUsage?.throwCount || 0}</span></span>
                </button>
                <button className={styles.fab} onClick={handlePickBottle} disabled={isLoading}>
                    <img src="/images/lao.png" alt="捞一个" className={styles.fabIcon} />
                    <span>捞一个 <span className={styles.countBadge}>{userData?.dailyUsage?.pickCount || 0}</span></span>
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

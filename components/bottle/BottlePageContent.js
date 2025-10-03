// /components/bottle/BottlePageContent.js (最终集成版)

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import Link from 'next/link';
import { FiSettings } from 'react-icons/fi';
import styles from '../../styles/Bottle.module.css';

import ThrowBottleModal from './ThrowBottleModal';
import PickedBottleModal from './PickedBottleModal';

const playSound = (soundFile) => {
    try {
        const audio = new Audio(soundFile);
        audio.play();
    } catch (error) { console.error(`播放音效失败: ${soundFile}`, error); }
};

export default function BottlePageContent() {
    const [user, setUser] = useState(null);
    const [loadingUser, setLoadingUser] = useState(true);
    const [isThrowModalOpen, setThrowModalOpen] = useState(false);
    const [pickedBottle, setPickedBottle] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [feedback, setFeedback] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser); setLoadingUser(false);
        });
        return () => unsubscribe();
    }, []);

    const showFeedback = (message, duration = 3000) => {
        setFeedback(message);
        if (duration > 0) { setTimeout(() => setFeedback(''), 3000); }
    };

    const handleThrowBottle = async ({ content, category }) => {
        if (!user) { showFeedback("请先登录！"); return; }
        setIsLoading(true);
        const newBottle = {
            content, category, // ✅ 保存瓶子分类
            throwerId: user.uid, throwerName: user.displayName || "一位旅行者",
            throwerAvatar: user.photoURL || null, createdAt: serverTimestamp(),
            status: "drifting", pickedBy: null, pickedAt: null, random: Math.random(),
        };
        try {
            await addDoc(collection(db, 'bottles'), newBottle);
            playSound('/sounds/reng.mp3');
            showFeedback("瓶子已投入大海！");
            setThrowModalOpen(false);
        } catch (error) { showFeedback(`扔瓶子失败: ${error.message}`); } 
        finally { setIsLoading(false); }
    };

    const handlePickBottle = async () => {
        if (!user) { showFeedback("请先登录再捞瓶子！"); return; }
        setIsLoading(true); showFeedback('正在大海里捞一个瓶子...', 0);
        try {
            const bottlesRef = collection(db, 'bottles');
            const randomValue = Math.random();
            const q1 = query(bottlesRef, where("status", "==", "drifting"), where("throwerId", "!=", user.uid), where("random", ">=", randomValue), limit(1));
            let querySnapshot = await getDocs(q1);
            if (querySnapshot.empty) {
                const q2 = query(bottlesRef, where("status", "==", "drifting"), where("throwerId", "!=", user.uid), where("random", "<", randomValue), limit(1));
                querySnapshot = await getDocs(q2);
            }
            if (querySnapshot.empty) { showFeedback("大海空空如也，过会儿再来试试吧。"); setIsLoading(false); return; }
            const bottleDoc = querySnapshot.docs[0];
            const bottleRef = doc(db, 'bottles', bottleDoc.id);
            await runTransaction(db, async (transaction) => {
                const freshBottleSnap = await transaction.get(bottleRef);
                if (!freshBottleSnap.exists()) { throw new Error("这个瓶子好像刚刚消失了！"); }
                const bottleData = freshBottleSnap.data();
                if (bottleData.status !== 'drifting') { throw new Error("哎呀，手滑了，瓶子被别人先捞走了！"); }
                transaction.update(bottleRef, { status: "picked", pickedBy: user.uid, pickedAt: serverTimestamp() });
                playSound('/sounds/lao.mp3');
                setPickedBottle({ ...bottleData, id: freshBottleSnap.id, createdAt: bottleData.createdAt?.toDate() });
            });
            setFeedback('');
        } catch (error) { showFeedback(error.message || "捞瓶子时发生未知错误，请重试。"); } 
        finally { setIsLoading(false); }
    };

    // ✅ 新增：处理“再捞一个”的逻辑
    const handlePickAnother = () => {
        setPickedBottle(null); // 关闭当前弹窗
        // 加一个短暂的延迟，让关闭动画更平滑
        setTimeout(() => {
            handlePickBottle();
        }, 300);
    };

    // ✅ 新增：处理匿名回复并转化为私信的逻辑 (需要在您的消息页面实现)
    const handleAnonymousReply = (bottle, replyContent) => {
        // 这是您需要对接的逻辑，它会删除瓶子并在消息列表创建新对话
        console.log("准备回复匿名瓶子:", bottle.id, "内容:", replyContent);
        alert("回复功能已触发，请在 MessagesPageContent.js 中实现 handleBottleReply 函数！");
        setPickedBottle(null); // 暂时先关闭弹窗
    };

    const handleLogin = () => { alert("请实现登录功能"); };

    if (loadingUser) { return <div>正在加载...</div>; }

    return (
        <div className={styles.pageContainer}>
            <div className={styles.header}>
                <h1>海洋</h1>
                <div className={styles.headerIcons}>
                    <Link href="/bottle/settings" passHref>
                        <FiSettings className={styles.headerIcon} aria-label="Settings" />
                    </Link>
                    {user ? ( <img src={user.photoURL || '/default-avatar.png'} alt="My Profile" className={styles.profileIcon} /> ) 
                    : ( <button onClick={handleLogin} style={{background: 'none', border: 'none'}}> <img src={'/default-avatar.png'} alt="Login" className={styles.profileIcon} /> </button> )}
                </div>
            </div>

            {feedback && <div className={styles.feedbackBanner}>{feedback}</div>}

            <div className={styles.bottomActions}>
                 <button className={styles.fab} onClick={() => user ? setThrowModalOpen(true) : showFeedback('请先登录再扔瓶子！')} disabled={isLoading}>
                    <img src="/images/jian.png" alt="扔一个" className={styles.fabIcon} />
                    <span>扔一个</span>
                </button>
                <button className={styles.fab} onClick={handlePickBottle} disabled={isLoading}>
                    <img src="/images/lao.png" alt="捞一个" className={styles.fabIcon} />
                    <span>捞一个</span>
                </button>
                {/* ✅ 新增：信封按钮，跳转到消息列表 */}
                <Link href="/messages" passHref>
                    <a className={styles.fab}>
                        <img src="/images/xin.png" alt="我的消息" className={styles.fabIcon} />
                        <span>信封</span>
                    </a>
                </Link>
            </div>

            <ThrowBottleModal isOpen={isThrowModalOpen} onClose={() => setThrowModalOpen(false)} onThrow={handleThrowBottle} isThrowing={isLoading} />
            
            {pickedBottle && (
                <PickedBottleModal 
                    bottle={pickedBottle} 
                    onClose={() => setPickedBottle(null)} 
                    onPickAnother={handlePickAnother}
                    onReply={handleAnonymousReply}
                />
            )}
        </div>
    );
            }

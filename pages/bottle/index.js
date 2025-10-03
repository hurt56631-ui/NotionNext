// 文件路径: pages/bottle/index.js (完整替换)

import { useState, useEffect } from 'react'; // 引入 useEffect
import { onAuthStateChanged } from 'firebase/auth'; // 引入 onAuthStateChanged
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase'; // 假设 firebase.js 在 lib 目录
import Link from 'next/link';
import { FiPlus, FiGitMerge } from 'react-icons/fi';
import { FaCog, FaUserCircle } from 'react-icons/fa';
import styles from '../../styles/Bottle.module.css';

import OceanBackground from '../../components/bottle/OceanBackground';
import ThrowBottleModal from '../../components/bottle/ThrowBottleModal';
import PickedBottleModal from '../../components/bottle/PickedBottleModal';
import BottomNavBar from '../../components/bottle/BottomNavBar';

export default function BottlePage() {
  // ▼▼▼ 核心修改 ▼▼▼
  // const [user] = useAuthState(auth); // <<< 删除这一行
  const [user, setUser] = useState(null); // <<< 我们用自己的 state 来管理用户
  const [loadingUser, setLoadingUser] = useState(true); // 添加一个加载状态，防止页面闪烁

  const [isThrowModalOpen, setThrowModalOpen] = useState(false);
  const [pickedBottle, setPickedBottle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  // ▼▼▼ 核心修改 ▼▼▼
  // 使用 useEffect 手动监听用户登录状态
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser); // 无论用户是否登录，都更新状态
      setLoadingUser(false); // 用户状态确定后，结束加载
    });

    // 清理监听器
    return () => unsubscribe();
  }, []); // 空数组表示只在组件加载时运行一次

  const showFeedback = (message, duration = 3000) => {
    setFeedback(message);
    if (duration > 0) {
      setTimeout(() => setFeedback(''), duration);
    }
  };

  const handlePickBottle = async () => {
    // 这里的逻辑不需要修改，因为它直接使用了我们定义的 user state
    if (!user) {
        alert("请先登录再捞瓶子！");
        return;
    }
    // ... (后续捞瓶子逻辑保持不变)
    setIsLoading(true);
    showFeedback('正在大海里捞一个瓶子...', 0);
    try {
      const bottlesRef = collection(db, 'bottles');
      const randomValue = Math.random();
      const q1 = query(bottlesRef, where("status", "==", "drifting"), where("throwerId", "!=", user.uid), where("random", ">=", randomValue), limit(1));
      let querySnapshot = await getDocs(q1);
      if (querySnapshot.empty) {
        const q2 = query(bottlesRef, where("status", "==", "drifting"), where("throwerId", "!=", user.uid), where("random", "<", randomValue), limit(1));
        querySnapshot = await getDocs(q2);
      }
      if (querySnapshot.empty) {
        showFeedback("大海空空如也，过会儿再来试试吧，或者你先扔一个？");
        setIsLoading(false);
        return;
      }
      const bottleDoc = querySnapshot.docs[0];
      const bottleRef = doc(db, 'bottles', bottleDoc.id);
      await runTransaction(db, async (transaction) => {
        const freshBottleSnap = await transaction.get(bottleRef);
        if (!freshBottleSnap.exists()) { throw new Error("这个瓶子好像刚刚消失了！"); }
        const bottleData = freshBottleSnap.data();
        if (bottleData.status !== 'drifting') { throw new Error("哎呀，手滑了，瓶子被别人先捞走了！"); }
        transaction.update(bottleRef, { status: "picked", pickedBy: user.uid, pickedAt: serverTimestamp() });
        setPickedBottle({ ...bottleData, id: freshBottleSnap.id });
      });
      setFeedback('');
    } catch (error) {
      console.error("捞瓶子失败:", error);
      showFeedback(error.message || "捞瓶子时发生未知错误，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
      alert("请实现登录功能");
  }
  
  // 在用户状态加载完成前，可以显示一个加载提示，避免UI闪烁
  if (loadingUser) {
    return <div>正在加载用户状态...</div>;
  }

  return (
    <div className={styles.pageContainer}>
      <OceanBackground />
      <div className={styles.header}>
        <h1>海洋</h1>
        <div>
          <Link href="/bottle/settings" passHref>
            <a className={styles.headerIcon} aria-label="Settings"><FaCog /></a>
          </Link>
          {user ? (
             <img src={user.photoURL || '/default-avatar.png'} alt="My Profile" className={styles.profileIcon} />
          ) : (
            <button onClick={handleLogin} className={styles.headerIcon} aria-label="Login">
              <FaUserCircle />
            </button>
          )}
        </div>
      </div>

      {feedback && <div className={styles.feedbackBanner}>{feedback}</div>}

      <div className={styles.mainActions}>
         <button className={styles.fab} onClick={() => user ? setThrowModalOpen(true) : alert('请先登录再扔瓶子！')} disabled={isLoading}>
          <FiPlus />
          <span>扔一个</span>
        </button>
        <button className={styles.fab} onClick={handlePickBottle} disabled={isLoading}>
          <FiGitMerge />
          <span>捞一个</span>
        </button>
      </div>

      <ThrowBottleModal isOpen={isThrowModalOpen} onClose={() => setThrowModalOpen(false)} />
      {pickedBottle && (<PickedBottleModal bottle={pickedBottle} onClose={() => setPickedBottle(null)} />)}
      <BottomNavBar />
    </div>
  );
}

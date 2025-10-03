// 文件路径: pages/bottle/index.js

import { useState } from 'react';
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';
import { FiPlus, FiGitMerge } from 'react-icons/fi';
import { FaCog, FaUserCircle } from 'react-icons/fa';
import styles from '../../styles/Bottle.module.css';

import OceanBackground from '../../components/bottle/OceanBackground';
import ThrowBottleModal from '../../components/bottle/ThrowBottleModal';
import PickedBottleModal from '../../components/bottle/PickedBottleModal';

export default function BottlePage() {
  const [user] = useAuthState(auth);
  const [isThrowModalOpen, setThrowModalOpen] = useState(false);
  const [pickedBottle, setPickedBottle] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState('');

  const showFeedback = (message, duration = 3000) => {
    setFeedback(message);
    if (duration > 0) {
      setTimeout(() => setFeedback(''), duration);
    }
  };

  const handlePickBottle = async () => {
    if (!user) {
        alert("请先登录再捞瓶子！");
        return;
    }

    setIsLoading(true);
    showFeedback('正在大海里捞一个瓶子...', 0); // 持续显示直到结束
    
    try {
      const bottlesRef = collection(db, 'bottles');
      const randomValue = Math.random();

      // 1. 尝试查询一个随机数大于等于当前随机值的瓶子
      const q1 = query(bottlesRef,
        where("status", "==", "drifting"),
        where("throwerId", "!=", user.uid),
        where("random", ">=", randomValue),
        limit(1)
      );
      let querySnapshot = await getDocs(q1);

      // 2. 如果第一次没找到，反向再查一次，确保覆盖所有范围
      if (querySnapshot.empty) {
        const q2 = query(bottlesRef,
          where("status", "==", "drifting"),
          where("throwerId", "!=", user.uid),
          where("random", "<", randomValue),
          limit(1)
        );
        querySnapshot = await getDocs(q2);
      }

      if (querySnapshot.empty) {
        showFeedback("大海空空如也，过会儿再来试试吧，或者你先扔一个？");
        setIsLoading(false);
        return;
      }

      const bottleDoc = querySnapshot.docs[0];
      const bottleRef = doc(db, 'bottles', bottleDoc.id);

      // 3. 使用事务来安全地“捞起”瓶子，防止竞争条件
      await runTransaction(db, async (transaction) => {
        const freshBottleSnap = await transaction.get(bottleRef);
        if (!freshBottleSnap.exists()) {
          throw new Error("这个瓶子好像刚刚消失了！");
        }
        const bottleData = freshBottleSnap.data();
        if (bottleData.status !== 'drifting') {
          throw new Error("哎呀，手滑了，瓶子被别人先捞走了！");
        }
        
        // 更新瓶子状态
        transaction.update(bottleRef, { 
          status: "picked",
          pickedBy: user.uid,
          pickedAt: serverTimestamp()
        });
        
        // 成功捞到，准备在模态框中显示
        setPickedBottle({
            ...bottleData,
            id: freshBottleSnap.id
        });
      });

      setFeedback(''); // 清空反馈信息

    } catch (error) {
      console.error("捞瓶子失败:", error);
      showFeedback(error.message || "捞瓶子时发生未知错误，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = () => {
      // 在这里添加你的登录逻辑，例如使用 Google 登录
      alert("请实现登录功能");
  }

  return (
    <div className={styles.pageContainer}>
      <OceanBackground />
      <div className={styles.header}>
        <h1>漂流瓶</h1>
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

      <div className={styles.actionButtons}>
        <button className={styles.fab} onClick={() => user ? setThrowModalOpen(true) : alert('请先登录再扔瓶子！')} disabled={isLoading}>
          <FiPlus />
          <span>扔一个</span>
        </button>
        <button className={styles.fab} onClick={handlePickBottle} disabled={isLoading}>
          <FiGitMerge />
          <span>捞一个</span>
        </button>
      </div>

      <ThrowBottleModal 
        isOpen={isThrowModalOpen}
        onClose={() => setThrowModalOpen(false)}
      />

      {pickedBottle && (
          <PickedBottleModal 
              bottle={pickedBottle}
              onClose={() => setPickedBottle(null)}
          />
      )}
    </div>
  );
}

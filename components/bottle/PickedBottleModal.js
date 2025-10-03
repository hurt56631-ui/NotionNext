import { useRouter } from 'next/router';
import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { FaPaperPlane, FaUndo, FaVolumeUp } from 'react-icons/fa';
import { playCachedTTS, preloadTTS } from '../../lib/aiUtils';
import TranslationView from './TranslationView';
import styles from '../../styles/Bottle.module.css';

export default function PickedBottleModal({ bottle, onClose }) {
  const router = useRouter();
  const [userSettings, setUserSettings] = useState(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    if (bottle && auth.currentUser) {
      preloadTTS(bottle.content);
      const fetchSettings = async () => {
        const settingsRef = doc(db, `users/${auth.currentUser.uid}/settings`, 'translation');
        const docSnap = await getDoc(settingsRef);
        setUserSettings(docSnap.exists() ? docSnap.data() : null);
      };
      fetchSettings();
    }
  }, [bottle]);

  const handleThrowBack = async () => {
    if (!auth.currentUser) return alert("请先登录！");

    setIsActionLoading(true);
    const bottleRef = doc(db, 'bottles', bottle.id);

    try {
      // 直接更新文档状态
      await updateDoc(bottleRef, {
        status: "drifting",
        pickedBy: null,
        pickedAt: null,
      });
      onClose();
    } catch (error) {
      console.error("扔回失败:", error);
      alert(`扔回失败: ${error.message}`);
    }
    setIsActionLoading(false);
  };
  
  const handleReply = () => { /* ... 此部分逻辑不变 ... */ };
  const getDriftTime = () => { /* ... 此部分逻辑不变 ... */ };

  if (!bottle) return null;
  
  // 其余 JSX 代码与之前完全相同
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
        {/* ... 省略与之前版本完全相同的 JSX 代码 ... */}
        {/* 核心变化是在 handleThrowBack 函数里 */}
    </div>
  );
}
``      const bottleDoc = querySnapshot.docs[0];
      const bottleRef = doc(db, 'bottles', bottleDoc.id);

      // 3. 使用事务来安全地“捞起”瓶子
      await runTransaction(db, async (transaction) => {
        const freshBottleSnap = await transaction.get(bottleRef);
        if (!freshBottleSnap.exists()) {
          throw "这个瓶子已经消失了！";
        }
        if (freshBottleSnap.data().status !== 'drifting') {
          throw "哎呀，手滑了，瓶子被别人先捞走了！";
        }
        
        // 更新瓶子状态
        transaction.update(bottleRef, { 
          status: "picked",
          pickedBy: user.uid,
          pickedAt: serverTimestamp()
        });
        
        // 成功捞到，准备显示
        const bottleData = freshBottleSnap.data();
        setPickedBottle({
            ...bottleData,
            id: freshBottleSnap.id,
            createdAt: bottleData.createdAt.toDate() // 将 Timestamp 转为 Date
        });
      });

      setFeedback('');

    } catch (error) {
      console.error("捞瓶子失败:", error);
      showFeedback(typeof error === 'string' ? error : "捞瓶子时发生错误，请重试。");
    } finally {
      setIsLoading(false);
    }
  };

  // JSX 部分与之前版本完全相同
  return (
    <div className={styles.pageContainer}>
      {/* ... 省略与之前版本完全相同的 JSX 代码 ... */}
    </div>
  );
}

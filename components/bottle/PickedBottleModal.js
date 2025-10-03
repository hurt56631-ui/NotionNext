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
```*(注意: `PickedBottleModal.js` 的 JSX 部分没有变化，你只需更新 `handleThrowBack` 函数即可。为了完整性，你可以替换整个文件。)*

#### 3.3 `BottlePage/index.js` - (捞瓶子)

这是最复杂的修改。我们需要在这里实现随机查询和**事务**操作，以防止两个人同时捞到同一个瓶子。

**文件路径**: `pages/bottle/index.js`
**完整新代码**:
```jsx
import { useState } from 'react';
import { collection, query, where, limit, getDocs, runTransaction, doc, serverTimestamp } from 'firebase/firestore';
import { db, functions, auth } from '../../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';
import Link from 'next/link';
import { FiPlus, FiGitMerge } from 'react-icons/fi';
import { FaCog } from 'react-icons/fa';
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

  const showFeedback = (message) => {
    setFeedback(message);
    setTimeout(() => setFeedback(''), 3000);
  };

  const handlePickBottle = async () => {
    if (!user) return alert("请先登录！");

    setIsLoading(true);
    setFeedback('正在大海里捞一个瓶子...');
    
    try {
      const bottlesRef = collection(db, 'bottles');
      const randomValue = Math.random();

      // 1. 尝试查询一个随机瓶子
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
        showFeedback("大海空空如也，过会儿再来试试吧。");
        setIsLoading(false);
        return;
      }

      const bottleDoc = querySnapshot.docs[0];
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

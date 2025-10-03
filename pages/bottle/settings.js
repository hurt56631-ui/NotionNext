// 文件路径: pages/bottle/settings.js (完整替换)

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; // 引入 onAuthStateChanged
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import Link from 'next/link';
import styles from '../../styles/Settings.module.css';

export default function SettingsPage() {
  // ▼▼▼ 核心修改 ▼▼▼
  // const [user] = useAuthState(auth); // <<< 删除这一行
  const [user, setUser] = useState(null); // <<< 我们用自己的 state 来管理用户
  
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  // ▼▼▼ 核心修改 ▼▼▼
  // 使用 useEffect 手动监听用户登录状态，并根据状态获取数据
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // 如果用户已登录，获取他们的设置
        const settingsRef = doc(db, `users/${currentUser.uid}/settings`, 'translation');
        getDoc(settingsRef).then((docSnap) => {
          if (docSnap.exists()) {
            setAutoTranslate(docSnap.data().autoTranslate || false);
          }
          setIsLoading(false);
        });
      } else {
        // 如果用户未登录，直接结束加载
        setIsLoading(false);
      }
    });
    // 清理监听器
    return () => unsubscribe();
  }, []);

  const handleSaveSettings = async () => {
    // 这里的逻辑不需要修改
    if (!user) {
      setFeedback('请先登录！');
      return;
    }
    setFeedback('正在保存...');
    const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation');
    try {
      await setDoc(settingsRef, { autoTranslate: autoTranslate });
      setFeedback('设置已保存！');
    } catch (error) {
      console.error("保存设置失败:", error);
      setFeedback('保存失败，请重试。');
    } finally {
      setTimeout(() => setFeedback(''), 2000);
    }
  };
  
  const handleSignOut = () => {
    auth.signOut();
  }

  // JSX 渲染逻辑保持不变
  if (isLoading) {
    return <div className={styles.container}><p>正在加载...</p></div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <Link href="/bottle">
          <a className={styles.backLink}>← 返回海洋</a>
        </Link>
        <h1>设置</h1>

        {!user ? (
          <p>请先登录以管理您的设置。</p>
        ) : (
          <>
            <div className={styles.settingItem}>
              <label htmlFor="auto-translate">自动翻译捡到的瓶子</label>
              <input type="checkbox" id="auto-translate" checked={autoTranslate} onChange={(e) => setAutoTranslate(e.target.checked)} />
            </div>
            <button onClick={handleSaveSettings} className={styles.button}>保存设置</button>
            <button onClick={handleSignOut} className={`${styles.button} ${styles.buttonSecondary}`}>退出登录</button>
            {feedback && <p className={styles.feedback}>{feedback}</p>}
          </>
        )}
      </div>
    </div>
  );
}

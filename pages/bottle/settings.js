// 文件路径: pages/bottle/settings.js

import { useState, useEffect } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../lib/firebase';
import Link from 'next/link';
import styles from '../../styles/Settings.module.css'; // 我们需要为它创建一个新的 CSS 文件

export default function SettingsPage() {
  const [user] = useAuthState(auth);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState('');

  // 当用户信息加载后，获取用户的设置
  useEffect(() => {
    if (user) {
      const settingsRef = doc(db, `users/${user.uid}/settings`, 'translation');
      getDoc(settingsRef).then((docSnap) => {
        if (docSnap.exists()) {
          setAutoTranslate(docSnap.data().autoTranslate || false);
        }
        setIsLoading(false);
      });
    } else if (user === null) {
      // 用户未登录
      setIsLoading(false);
    }
  }, [user]);

  const handleSaveSettings = async () => {
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
    // 可以跳转回主页
    // import { useRouter } from 'next/router';
    // const router = useRouter();
    // router.push('/bottle');
  }

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
              <input
                type="checkbox"
                id="auto-translate"
                checked={autoTranslate}
                onChange={(e) => setAutoTranslate(e.target.checked)}
              />
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

// /hooks/useHeartbeat.js
import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // 确保路径正确

export function useHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return;

    const updateUserHeartbeat = () => {
      const userDocRef = doc(db, 'users', userId);
      setDoc(userDocRef, {
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(error => {
        console.error("心跳更新失败:", error);
      });
    };

    updateUserHeartbeat();
    const intervalId = setInterval(updateUserHeartbeat, 60 * 1000);
    return () => clearInterval(intervalId);
    
  }, [userId]);
}

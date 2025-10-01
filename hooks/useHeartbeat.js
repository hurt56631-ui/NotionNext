// /hooks/useHeartbeat.js
import { useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return;

    const updateUserHeartbeat = () => {
      const userDocRef = doc(db, 'users', userId);
      // 确保 Firestore 中有 'users' 集合
      updateDoc(userDocRef, {
        lastSeen: serverTimestamp() 
      }).catch(error => {
        // console.error("心跳更新失败:", error); 
      });
    };

    updateUserHeartbeat();
    const intervalId = setInterval(updateUserHeartbeat, 60 * 1000); // 每分钟一次
    return () => clearInterval(intervalId);
    
  }, [userId]);
}

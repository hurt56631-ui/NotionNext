// /hooks/useHeartbeat.js
import { useEffect } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export function useHeartbeat(userId) {
  useEffect(() => {
    if (!userId) return;

    const updateUserHeartbeat = () => {
      const userDocRef = doc(db, 'users', userId);
      setDoc(userDocRef, {
        lastSeen: serverTimestamp()
      }, { merge: true }).catch(error => {
        console.error("Heartbeat update failed:", error);
      });
    };

    updateUserHeartbeat();
    const intervalId = setInterval(updateUserHeartbeat, 60 * 1000);
    return () => clearInterval(intervalId);
    
  }, [userId]);
}

// /components/ChatInterface.js (极简调试版 - 仅用于测试在线状态)

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
// ✅ 引入所有需要的 Firebase 实例和函数
import { db, rtDb } from "@/lib/firebase"; 
import { ref as rtRef, onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

// ✅ ---【采纳AI建议：健壮的时间格式化函数】--- ✅
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "离线";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "在线";
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} 小时前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  
  return new Date(timestamp).toLocaleDateString();
};

export default function ChatInterface({ chatId, currentUser, peerUser }) {
  const router = useRouter();
  const peerId = peerUser?.id || null;

  // 核心状态：只保留对方的在线状态
  const [peerStatus, setPeerStatus] = useState({ online: false, lastSeenTimestamp: null });

  // ✅ ---【采纳AI建议：最健壮的在线状态 useEffect】--- ✅
  useEffect(() => {
    let unsub = null;
    let cancelled = false;

    // 严格检查
    if (!peerId || typeof window === "undefined") {
      setPeerStatus({ online: false, lastSeenTimestamp: null });
      return;
    }

    // 检查 RTDB 是否初始化
    if (!rtDb) {
      console.warn("rtDb not initialized - falling back to Firestore lastSeen.");
      (async () => {
        try {
          const userDocRef = doc(db, "users", peerId);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const ls = snap.data().lastSeen;
            const lastSeenMs = ls?.toDate ? ls.toDate().getTime() : null;
            if (!cancelled) setPeerStatus({ online: false, lastSeenTimestamp: lastSeenMs });
          }
        } catch (e) { console.warn("Firestore fallback failed:", e); }
      })();
      return;
    }

    try {
      const peerStatusRef = rtRef(rtDb, `/status/${peerId}`);
      unsub = onValue(peerStatusRef, async (snapshot) => {
          if (cancelled) return;
          const statusData = snapshot.val();

          if (statusData && statusData.state === "online") {
            const lastChanged = statusData.last_changed;
            const lastSeenMs = typeof lastChanged === "number" ? lastChanged : null;
            setPeerStatus({ online: true, lastSeenTimestamp: lastSeenMs });
          } else {
            // 离线或无数据时，回退到 Firestore
            try {
              const userDocRef = doc(db, "users", peerId);
              const docSnap = await getDoc(userDocRef);
              if (docSnap.exists()) {
                const ls = docSnap.data().lastSeen;
                const lastSeenMs = ls?.toDate ? ls.toDate().getTime() : null;
                setPeerStatus({ online: false, lastSeenTimestamp: lastSeenMs });
              } else {
                setPeerStatus({ online: false, lastSeenTimestamp: null });
              }
            } catch (e) {
              console.warn("Failed to read Firestore lastSeen fallback:", e);
              setPeerStatus({ online: false, lastSeenTimestamp: null });
            }
          }
        },
        (err) => { console.error("rtOnValue error:", err); }
      );
    } catch (e) {
      console.error("Exception while setting onValue:", e);
    }

    return () => {
      cancelled = true;
      if (typeof unsub === "function") unsub();
    };
  }, [peerId]);

  // 使用 useMemo 避免不必要的重计算
  const headerStatus = useMemo(() => {
    if (peerStatus.online) return { label: "在线", colorClass: "text-green-400" };
    return { label: formatLastSeen(peerStatus.lastSeenTimestamp), colorClass: "text-gray-400" };
  }, [peerStatus]);

  return (
    <div className="h-screen w-full bg-gray-100 dark:bg-black flex flex-col">
      {/* 极简 Header，只显示核心信息 */}
      <header className="flex-shrink-0 flex items-center justify-between p-4 border-b dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm z-10">
        <div className="flex items-center space-x-4">
          <button onClick={() => router.back()} className="text-gray-500 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <img
            src={peerUser?.photoURL || "/img/avatar.svg"}
            alt={peerUser?.displayName || "用户"}
            className="w-10 h-10 rounded-full"
          />

          <div className="flex flex-col">
            <span className="font-bold text-lg text-gray-900 dark:text-white">
              {peerUser?.displayName || "聊天对象"}
            </span>
            <span className={`text-xs font-semibold ${headerStatus.colorClass}`}>
              {headerStatus.label}
            </span>
          </div>
        </div>
        
        {/* 右上角更多按钮 (仅作占位) */}
        <button className="text-gray-500 dark:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
            </svg>
        </button>
      </header>

      {/* 主内容区 (仅作占位) */}
      <main className="flex-1 p-4 text-center text-gray-500">
        <p>这里是聊天内容区</p>
        <p className="mt-4">请专注于顶部的在线状态是否正确</p>
      </main>

      {/* 底部输入框 (仅作占位) */}
      <footer className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center px-4 text-gray-400">
            输入框占位...
        </div>
      </footer>
    </div>
  );
}

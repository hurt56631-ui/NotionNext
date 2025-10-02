// /components/ChatInterface.js (极简调试版 - 仅用于测试在线状态)

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/router';
// ✅ 引入所有需要的 Firebase 实例和函数
import { db, rtDb } from "@/lib/firebase"; 
import { ref as rtRef, onValue } from 'firebase/database';
import { doc, getDoc } from 'firebase/firestore';

// ✅ ---【采纳AI建议：健壮的时间格式化函数】--- ✅
const formatLastSeen = (timestamp) => {
  if (!timestamp) return "离线 (no timestamp)";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return `在线 (m < 1)`;
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
  const [peerStatus, setPeerStatus] = useState({ 
    online: false, 
    lastSeenTimestamp: null, 
    debug: "Initializing..." 
  });

  // ✅ ---【最健壮的在线状态 useEffect，并增加调试信息】--- ✅
  useEffect(() => {
    let unsubRTDB = null;
    let cancelled = false;

    if (!peerId) {
      setPeerStatus(prev => ({ ...prev, debug: "Error: peerId is null" }));
      return;
    }
    if (typeof window === "undefined") {
      setPeerStatus(prev => ({ ...prev, debug: "Error: Not in browser" }));
      return;
    }

    if (!rtDb) {
      setPeerStatus(prev => ({ ...prev, debug: "Error: rtDb is null, falling back to Firestore..." }));
      // Fallback to Firestore
      const userDocRef = doc(db, "users", peerId);
      getDoc(userDocRef).then(snap => {
        if (!cancelled && snap.exists()) {
          const ls = snap.data().lastSeen;
          const lastSeenMs = ls?.toDate ? ls.toDate().getTime() : null;
          setPeerStatus({ online: false, lastSeenTimestamp: lastSeenMs, debug: "Fallback successful: Read from Firestore." });
        }
      }).catch(e => {
        if (!cancelled) setPeerStatus(prev => ({ ...prev, debug: `Fallback Error: ${e.message}` }));
      });
      return;
    }

    try {
      setPeerStatus(prev => ({ ...prev, debug: "Attempting RTDB connection..." }));
      const peerStatusRef = rtRef(rtDb, `/status/${peerId}`);
      
      unsubRTDB = onValue(peerStatusRef, 
        (snapshot) => {
          if (cancelled) return;
          const statusData = snapshot.val();
          if (statusData && statusData.state === "online") {
            setPeerStatus({ online: true, lastSeenTimestamp: statusData.last_changed, debug: "RTDB reported: ONLINE" });
          } else {
            setPeerStatus(prev => ({ ...prev, online: false, lastSeenTimestamp: statusData?.last_changed || prev.lastSeenTimestamp, debug: "RTDB reported: OFFLINE or null." }));
          }
        },
        (err) => { 
            setPeerStatus({ online: false, lastSeenTimestamp: null, debug: `RTDB Error: ${err.message}` });
        }
      );
    } catch (e) {
      setPeerStatus({ online: false, lastSeenTimestamp: null, debug: `Exception: ${e.message}` });
    }

    return () => {
      cancelled = true;
      if (typeof unsubRTDB === "function") unsubRTDB();
    };
  }, [peerId]);

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
            <span className={`text-xs font-semibold ${peerStatus.online ? 'text-green-500' : 'text-gray-400'}`}>
              {formatLastSeen(peerStatus.lastSeenTimestamp)}
            </span>
          </div>
        </div>
      </header>

      {/* ✅ ---【核心修改：增加实时仪表盘】--- ✅ */}
      <div style={{
          margin: '20px',
          background: '#111', color: 'white', padding: '15px',
          borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace',
          border: '1px solid #444'
      }}>
          <h4 style={{ margin: 0, padding: 0, fontWeight: 'bold', color: '#00ff00', borderBottom: '1px solid #333', paddingBottom: '5px', marginBottom: '10px' }}>-- 实时状态仪表盘 --</h4>
          <p><strong>Peer ID:</strong> {peerId || 'N/A'}</p>
          <p><strong>rtDb Loaded:</strong> {rtDb ? <span style={{color: 'lime'}}>Yes</span> : <span style={{color: 'red'}}>No</span>}</p>
          <hr style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
          <p><strong>Status (online):</strong> {peerStatus.online ? <span style={{color: 'lime'}}>true</span> : <span style={{color: 'red'}}>false</span>}</p>
          <p><strong>Status (timestamp):</strong> {peerStatus.lastSeenTimestamp || 'null'}</p>
          <p><strong>Status (formatted):</strong> {formatLastSeen(peerStatus.lastSeenTimestamp)}</p>
          <hr style={{ margin: '8px 0', borderColor: 'rgba(255,255,255,0.2)' }} />
          <p><strong>Debug Info:</strong> <span style={{color: 'yellow'}}>{peerStatus.debug}</span></p>
      </div>

      {/* 主内容区 (仅作占位) */}
      <main className="flex-1 p-4 text-center text-gray-500">
        <p>这是一个极简的测试页面。</p>
        <p className="mt-4">请专注于顶部的在线状态和下方的“仪表盘”是否正确。</p>
      </main>
    </div>
  );
}

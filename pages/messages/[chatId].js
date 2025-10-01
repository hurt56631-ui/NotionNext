// /pages/messages/[chatId].js (最终版 - 使用新组件)

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// 动态导入我们新的全屏聊天组件
import FullScreenChatComponent from '@/components/FullScreenChatComponent'; 

const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gray-100">
    <p>正在加载聊天...</p>
  </div>
);

const ChatPage = () => {
  const router = useRouter();
  const { chatId } = router.query;
  const { user: currentUser, authLoading } = useAuth();

  const [peerUser, setPeerUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId || !currentUser) return;

    const getPeerUserData = async () => {
      const peerId = chatId.split('_').find(id => id !== currentUser.uid);
      if (!peerId) {
        setLoading(false);
        return;
      }
      const userDocSnap = await getDoc(doc(db, 'users', peerId));
      if (userDocSnap.exists()) {
        setPeerUser({ id: userDocSnap.id, ...userDocSnap.data() });
      }
      setLoading(false);
    };
    getPeerUserData();
  }, [chatId, currentUser]);

  if (loading || authLoading) {
    return <PageLoader />;
  }

  // 注意：我们不再需要任何外层的 div 和样式了！
  // 新的组件自己就能处理所有全屏布局。
  // 我们只需要把 chatId 和用户信息传给它。
  return (
    <FullScreenChatComponent
      chatId={chatId}
      user={{ 
        uid: currentUser.uid, 
        name: currentUser.displayName || '我' 
      }}
      // 你可以把对方用户的信息也传进去，来定制化顶部的 Header
      // peerUser={peerUser} 
    />
  );
};

export default ChatPage;

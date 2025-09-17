// pages/forum/messages/[chatId].js (最终全屏版)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo' // 确保这里导入的是 LayoutBase
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ChatDetailPage = () => {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { chatId } = router.query
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    if (chatId && user) {
      const getConversationData = async () => {
        const docRef = doc(db, 'chats', chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists() && docSnap.data().participants.includes(user.uid)) {
          setConversation({ id: docSnap.id, ...docSnap.data() });
        } else {
          // 如果聊天不存在或用户不是参与者，则跳转
          router.replace('/forum/messages');
        }
      };
      getConversationData();
    }
  }, [chatId, user, router]);

  return (
    // 我们将把全屏逻辑放在 LayoutBase 内部处理
    <LayoutBase>
      {(loading || !conversation) && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录。</div>}
      {!loading && user && conversation && (
        <ChatWindow chatId={chatId} conversation={conversation} />
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage

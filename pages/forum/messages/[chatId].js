// pages/forum/messages/[chatId].js (全屏版)

import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import { LayoutBase } from '@/themes/heo'
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const ChatDetailPage = () => {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { chatId } = router.query
  const [conversation, setConversation] = useState(null)

  useEffect(() => {
    if (chatId) {
      const getConversationData = async () => {
        const docRef = doc(db, 'chats', chatId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setConversation({ id: docSnap.id, ...docSnap.data() });
        } else {
          router.replace('/forum/messages');
        }
      };
      getConversationData();
    }
  }, [chatId, router]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      router.replace(`/forum/messages?chatId=${chatId}`)
    }
  }, [chatId, router])

  return (
    <LayoutBase>
      {(loading || !conversation) && <div className="p-10 text-center">加载中...</div>}
      {!loading && !user && <div className="p-10 text-center">请先登录。</div>}
      {!loading && user && conversation && (
        // 关键修复：使用 fixed 定位实现全屏，覆盖一切
        <div className="md:hidden flex flex-col fixed inset-0 bg-white dark:bg-gray-900 z-50">
          <div className="flex-shrink-0 flex items-center p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm sticky top-0">
            <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <i className="fas fa-arrow-left"></i>
            </button>
            {/* 这里的 ChatWindow 内部已经有居中的名字了，所以外面这层可以保持原样 */}
             <div className="flex-1 w-0"></div>
          </div>
          <div className="flex-1">
             <ChatWindow chatId={chatId} conversation={conversation} />
          </div>
        </div>
      )}
    </LayoutBase>
  )
}

export default ChatDetailPage

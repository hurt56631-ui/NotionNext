// pages/forum/messages/[chatId].js
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { useAuth } from '@/lib/AuthContext'
import LayoutBase from '@/themes/heo/LayoutBase'
import ChatWindow from '@/themes/heo/components/ChatWindow'
import { FaArrowLeft } from 'react-icons/fa'
import { getDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

// 这个页面是移动端专用的全屏聊天页
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
          console.error("No such conversation!");
        }
      };
      getConversationData();
    }
  }, [chatId]);

  // 这个页面只应该在移动端显示，如果是桌面端访问，则重定向
  useEffect(() => {
    if (window.innerWidth >= 768) {
      router.replace(`/forum/messages?chatId=${chatId}`)
    }
  }, [chatId, router])

  if (loading || !conversation) return <LayoutBase><div>加载中...</div></LayoutBase>
  if (!user && !loading) return <LayoutBase><div>请先登录。</div></LayoutBase>

  return (
    <LayoutBase>
      <div className="md:hidden flex flex-col h-screen">
        <div className="flex-shrink-0 flex items-center p-2 border-b bg-white shadow-sm sticky top-0 z-20">
          <button onClick={() => router.back()} className="p-2 rounded-full hover:bg-gray-100">
            <FaArrowLeft />
          </button>
          <div className="flex-1 w-0">
             {/* ChatWindow 内部已经有名字了，这里可以留空或简化 */}
          </div>
        </div>
        <div className="flex-1">
           <ChatWindow chatId={chatId} conversation={conversation} />
        </div>
      </div>
    </LayoutBase>
  )
}

export default ChatDetailPage

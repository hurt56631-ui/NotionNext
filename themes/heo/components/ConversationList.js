// themes/heo/components/ConversationList.js
import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { getConversationsForUser } from '@/lib/chat'
import ConversationItem from './ConversationItem'

const ConversationList = ({ onSelectChat, activeChatId }) => {
  const { user } = useAuth()
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    setLoading(true)
    const unsubscribe = getConversationsForUser(user.uid, (convs) => {
      setConversations(convs)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  if (loading) {
    return <div className="p-4 text-center text-gray-500">加载对话中...</div>
  }

  return (
    <div className="h-full overflow-y-auto border-r bg-white">
      <div className="p-4 border-b sticky top-0 bg-white z-10">
        <h2 className="text-xl font-bold">消息</h2>
      </div>
      {conversations.length > 0 ? (
        conversations.map(conv => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            onClick={() => onSelectChat(conv.id)}
            isActive={conv.id === activeChatId}
          />
        ))
      ) : (
        <div className="p-6 text-center text-gray-500">
          <p>还没有对话。</p>
          <p className="text-sm">去帖子里找人私信吧！</p>
        </div>
      )}
    </div>
  )
}

export default ConversationList

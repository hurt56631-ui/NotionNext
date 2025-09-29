// components/Footer.js (最终优化版，集成消息列表并移除“我”按钮加载延迟)

import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect, useRef } from 'react'
import AiChatAssistant from '@/components/AiChatAssistant'
import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore'
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

/**
 * 消息列表弹窗组件 (无修改)
 */
const MessageListPopup = ({ conversations, onClose }) => {
  const router = useRouter()

  const handleConversationClick = (chatId) => {
    onClose()
    router.push(`/messages?chatId=${chatId}`)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      className='absolute bottom-full mb-2 right-0 left-0 mx-auto w-[95vw] max-w-sm bg-white dark:bg-gray-800 rounded-lg shadow-2xl border dark:border-gray-700 overflow-hidden'
    >
      <div className='p-3 font-bold text-center border-b dark:border-gray-700 dark:text-white'>
        最近消息
      </div>
      <div className='max-h-80 overflow-y-auto'>
        {conversations.length === 0 ? (
          <p className='text-center text-gray-500 py-8 text-sm'>暂无消息</p>
        ) : (
          <ul>
            {conversations.map(convo => (
              <li key={convo.id} onClick={() => handleConversationClick(convo.id)} className='flex items-center p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors'>
                <div className='relative'>
                  <img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className='w-12 h-12 rounded-full object-cover' />
                  {convo.isUnread && (
                    <span className='absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-800' />
                  )}
                </div>
                <div className='ml-3 flex-1 overflow-hidden'>
                  <p className='font-semibold truncate dark:text-gray-200'>{convo.otherUser.displayName || '未知用户'}</p>
                  <p className='text-sm text-gray-500 truncate'>{convo.lastMessage}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Link href='/messages' passHref>
        <a onClick={onClose} className='block w-full text-center py-2 bg-gray-50 dark:bg-gray-700/50 text-blue-500 font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-700'>
          查看全部消息
        </a>
      </Link>
    </motion.div>
  )
}

/**
 * 主页脚组件
 */
const Footer = () => {
  const router = useRouter()
  const BEI_AN = siteConfig('BEI_AN')
  const BEI_AN_LINK = siteConfig('BEI_AN_LINK')
  const BIO = siteConfig('BIO')
  const isArticlePage = router.pathname.startsWith('/article/') || router.pathname.startsWith('/post/')

  // loading 仍然保留，但 thanks to the optimized AuthContext, its duration will be extremely short.
  const { user, loading } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const [conversations, setConversations] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [isMessageListOpen, setMessageListOpen] = useState(false)
  const messageButtonRef = useRef(null)

  // 实时获取聊天列表的 useEffect (无修改)
  useEffect(() => {
    if (!user) {
      setConversations([])
      setUnreadCount(0)
      return
    }
    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );
    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const chatPromises = snapshot.docs.map(async (chatDoc) => {
        const chatData = chatDoc.data()
        const otherUserId = chatData.members.find(id => id !== user.uid)
        if (!otherUserId) return null
        const userProfileDoc = await getDoc(doc(db, 'users', otherUserId))
        const otherUser = userProfileDoc.exists()
          ? userProfileDoc.data()
          : { displayName: '未知用户', photoURL: '/img/avatar.svg' }
        const lastReadTimestamp = chatData.lastRead?.[user.uid]?.toDate()
        const lastMessageTimestamp = chatData.lastMessageTimestamp?.toDate()
        const isUnread = lastReadTimestamp && lastMessageTimestamp && lastMessageTimestamp > lastReadTimestamp
        return { id: chatDoc.id, ...chatData, otherUser, isUnread }
      });
      const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean)
      setConversations(resolvedChats)
      const newUnreadCount = resolvedChats.filter(c => c.isUnread).length
      setUnreadCount(newUnreadCount)
    });
    return () => unsubscribe()
  }, [user])

  // 其他 Hooks (无修改)
  const handleMessagesClick = () => {
    if (!user) {
      setShowLoginModal(true)
      return
    }
    setMessageListOpen(prev => !prev)
  }

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (messageButtonRef.current && !messageButtonRef.current.contains(event.target)) {
        setMessageListOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, []);

  const handleOpenDrawer = () => {
    router.push(router.pathname + '#ai-chat', undefined, { shallow: true })
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    if (window.location.hash === '#ai-chat') { router.back() } 
    else { setDrawerOpen(false) }
  }

  useEffect(() => {
    const handleHashChange = () => { if (window.location.hash !== '#ai-chat') { setDrawerOpen(false) } }
    window.addEventListener('popstate', handleHashChange)
    return () => { window.removeEventListener('popstate', handleHashChange) }
  }, [])

  // 【修改】"我" 按钮的点击处理函数
  const handleMyButtonClick = (e) => {
    // 只有在认证流程结束后（loading为false）且用户确实不存在时，才阻止跳转并显示弹窗
    if (!loading && !user) {
      e.preventDefault()
      setShowLoginModal(true)
    }
    // 如果正在加载（时间极短）或用户已登录，则允许默认的Link跳转行为
  }

  return (
    <>
      {/* 桌面端页脚 (无修改) */}
      <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] justify-center text-center m-auto w-full leading-6 text-gray-600 dark:text-gray-100 text-sm'>
        <div id='color-transition' className='h-32 bg-gradient-to-b from-[#f7f9fe] to-white dark:bg-[#1a191d] dark:from-inherit dark:to-inherit' />
        <div className='w-full h-24'><SocialButton /></div>
        <br />
        <div id='footer-bottom' className='hidden lg:flex w-full h-20 flex-col p-3 lg:flex-row justify-between px-6 items-center bg-[#f1f3f7] dark:bg-[#21232A] border-t dark:border-t-[#3D3D3F]'>
          <div id='footer-bottom-left' className='text-center lg:text-start'>
            <PoweredBy />
            <div className='flex gap-x-1'>
              {!isArticlePage && <CopyRightDate />}
              <a href={'/about'} className='underline font-semibold dark:text-gray-300'>{siteConfig('AUTHOR')}</a>
              {BIO && <span className='mx-1'> | {BIO}</span>}
            </div>
          </div>
          <div id='footer-bottom-right'>
            {BEI_AN && (<><i className='fas fa-shield-alt' /> <a href={BEI_AN_LINK} className='mr-2'>{BEI_AN}</a></>)}
            <BeiAnGongAn />
          </div>
        </div>
      </footer>

      {/* 移动端底部导航栏 */}
      <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-14 flex justify-around items-center px-2'>
        <Link href='/' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-home text-lg'></i>
          <span>主页</span>
        </Link>
        <button onClick={handleOpenDrawer} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-robot text-lg'></i>
          <span>AI助手</span>
        </button>
        <Link href='/community' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-users text-lg'></i>
          <span>社区</span>
        </Link>
        
        <div ref={messageButtonRef} className='relative flex flex-col items-center'>
            <AnimatePresence>
                {isMessageListOpen && <MessageListPopup conversations={conversations} onClose={() => setMessageListOpen(false)} />}
            </AnimatePresence>
            <button onClick={handleMessagesClick} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1 relative'>
                {unreadCount > 0 && (
                    <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px]'>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
                <i className='fas fa-comment-alt text-lg'></i>
                <span>消息</span>
            </button>
        </div>
        
        {/* 【核心修改】移除了加载动画，直接显示图标 */}
        <Link href='/me' onClick={handleMyButtonClick} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          {/*
            直接渲染图标。这能保证它和其他图标同步显示。
            得益于优化的 AuthContext，页面加载后几乎立刻就能确定用户状态，
            所以这里的显示是准确的，并且避免了视觉上的延迟和闪烁。
          */}
          <i className='fas fa-user text-lg'></i>
          <span>我</span>
        </Link>
      </div>

      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

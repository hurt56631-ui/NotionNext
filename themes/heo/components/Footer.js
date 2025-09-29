// components/Footer.js (最终修改版：消息按钮改为全屏页面跳转)

import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react' // 【修改】移除了 useRef
import AiChatAssistant from '@/components/AiChatAssistant'
// 【修改】移除了 motion 和 AnimatePresence，因为不再需要弹窗动画
// import { motion, AnimatePresence } from 'framer-motion'

import { useAuth } from '@/lib/AuthContext'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore' // 【修改】移除了 doc, getDoc
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

// 【修改】MessageListPopup 组件已被完全移除，因为不再需要弹窗

/**
 * 主页脚组件
 */
const Footer = () => {
  const router = useRouter()
  const BEI_AN = siteConfig('BEI_AN')
  const BEI_AN_LINK = siteConfig('BEI_AN_LINK')
  const BIO = siteConfig('BIO')
  const isArticlePage = router.pathname.startsWith('/article/') || router.pathname.startsWith('/post/')

  const { user, loading } = useAuth()
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  // 【修改】只保留未读消息数量的状态
  const [unreadCount, setUnreadCount] = useState(0)
  // 【修改】移除了 isMessageListOpen, conversations, messageButtonRef 等弹窗相关状态

  // 【修改】实时获取未读消息数量的 useEffect
  useEffect(() => {
    if (!user) {
      setUnreadCount(0)
      return
    }
    // 查询条件：成员包含当前用户，且最后一条消息的时间戳 > 当前用户的已读时间戳
    // 注意：这个查询需要为 lastRead.<userId> 和 lastMessageTimestamp 创建复合索引
    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let newUnreadCount = 0;
      snapshot.forEach(doc => {
        const chatData = doc.data();
        const lastReadTimestamp = chatData.lastRead?.[user.uid]?.toDate();
        const lastMessageTimestamp = chatData.lastMessageTimestamp?.toDate();
        // 如果已读时间存在，并且最后消息时间晚于已读时间，则视为未读
        if (lastReadTimestamp && lastMessageTimestamp && lastMessageTimestamp > lastReadTimestamp) {
          newUnreadCount++;
        }
        // 如果用户的已读时间不存在（例如，从未点进过这个聊天），也视为未读
        else if (!lastReadTimestamp && lastMessageTimestamp) {
          newUnreadCount++;
        }
      });
      setUnreadCount(newUnreadCount);
    });

    return () => unsubscribe()
  }, [user])

  // AI 助手相关 Hooks (无修改)
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

  // 【修改】"我" 和 "消息" 按钮的点击处理函数
  const handleAuthRedirect = (e) => {
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
        
        {/* 【核心修改】将消息按钮改为直接跳转到 /messages 页面的 Link */}
        <Link href='/messages' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1 relative'>
            {unreadCount > 0 && (
                <span className='absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white text-[10px]'>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
            <i className='fas fa-comment-alt text-lg'></i>
            <span>消息</span>
        </Link>
        
        {/* "我" 按钮 */}
        <Link href='/me' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
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

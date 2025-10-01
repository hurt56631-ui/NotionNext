// /components/Footer.js (已简)

import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import AiChatAssistant from '@/components/AiChatAssistant'

import { useAuth } from '@/lib/AuthContext'
import { useMessages } from '@/lib/MessageContext' // <-- 导入 useMessages
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

const Footer = () => {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { totalUnreadCount } = useMessages(); // <-- 直接从 Context 获取总未read数
  
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const pagesWithBottomNav = ['/', '/community', '/messages', '/me'];
  const isChatPage = router.pathname.startsWith('/messages/') && router.query.chatId;
  const showBottomNav = pagesWithBottomNav.includes(router.pathname) && !isChatPage;

  const handleOpenDrawer = () => { router.push(router.asPath + '#ai-chat', undefined, { shallow: true }); setDrawerOpen(true); };
  const handleCloseDrawer = () => { if (window.location.hash === '#ai-chat') { router.back(); } else { setDrawerOpen(false); } };
  useEffect(() => { const handleHashChange = () => { if (window.location.hash !== '#ai-chat') { setDrawerOpen(false); } }; window.addEventListener('popstate', handleHashChange); return () => { window.removeEventListener('popstate', handleHashChange); }; }, [router]);
  const handleAuthRedirect = (e) => { if (!loading && !user) { e.preventDefault(); setShowLoginModal(true); } };
  const showDesktopFooter = router.pathname === '/';

  return (
    <>
      {showDesktopFooter && (
        <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] ...'>
          {/* ... 桌面端页脚内容不变 ... */}
        </footer>
      )}

      {showBottomNav && (
        <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-14 flex justify-around items-center px-2'>
          <Link href='/' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'><i className='fas fa-home text-lg'></i><span>主页</span></Link>
          <button onClick={handleOpenDrawer} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'><i className='fas fa-robot text-lg'></i><span>AI助手</span></button>
          <Link href='/community' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'><i className='fas fa-users text-lg'></i><span>社区</span></Link>
          
          <Link href='/messages' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1 relative'>
              {/* --- 核心修改：使用 totalUnreadCount 显示绿点 --- */}
              {totalUnreadCount > 0 && (
                  <span className='absolute top-0 right-1.5 flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                  </span>
              )}
              <i className='fas fa-comment-alt text-lg'></i>
              <span>消息</span>
          </Link>
          
          <Link href='/me' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'><i className='fas fa-user text-lg'></i><span>我</span></Link>
        </div>
      )}

      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

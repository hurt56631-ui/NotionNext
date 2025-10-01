// /components/Footer.js (已按要求修改)

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

  // --- 颜色和样式定义 ---
  const defaultColor = 'text-gray-500 dark:text-gray-400';
  const activeColor = 'text-purple-500 dark:text-purple-400';

  return (
    <>
      {showDesktopFooter && (
        <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] text-gray-600 dark:text-gray-400 justify-center text-center m-auto p-6 text-sm leading-6'>
            {/* ... 桌面端页脚内容不变 ... (为了完整性，这里可以填充原有内容) */}
            <div className="w-full">
                 <span>
                    <SocialButton />
                    <br />
                    <CopyRightDate />
                    <br />
                    <BeiAnGongAn />
                    <PoweredBy />
                 </span>
            </div>
        </footer>
      )}

      {showBottomNav && (
        <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-20 flex justify-around items-center px-2'>
          
          <Link href='/' className={`flex flex-col items-center ${router.pathname === '/' ? activeColor : defaultColor} px-2 py-1`}>
            <i className='fas fa-home text-xl'></i>
            <span className='text-sm mt-1'>主页</span>
          </Link>
          
          <button onClick={handleOpenDrawer} className={`flex flex-col items-center ${defaultColor} px-2 py-1`}>
            <i className='fas fa-robot text-xl'></i>
            <span className='text-sm mt-1'>AI助手</span>
          </button>
          
          <Link href='/community' className={`flex flex-col items-center ${router.pathname === '/community' ? activeColor : defaultColor} px-2 py-1`}>
            <i className='fas fa-users text-xl'></i>
            <span className='text-sm mt-1'>社区</span>
          </Link>
          
          <Link href='/messages' onClick={handleAuthRedirect} className={`flex flex-col items-center ${router.pathname === '/messages' ? activeColor : defaultColor} px-2 py-1 relative`}>
              {totalUnreadCount > 0 && (
                  <span className='absolute top-0 right-1.5 flex h-2.5 w-2.5'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500'></span>
                  </span>
              )}
              <i className='fas fa-comment-alt text-xl'></i>
              <span className='text-sm mt-1'>消息</span>
          </Link>
          
          <Link href='/me' onClick={handleAuthRedirect} className={`flex flex-col items-center ${router.pathname === '/me' ? activeColor : defaultColor} px-2 py-1`}>
            <i className='fas fa-user text-xl'></i>
            <span className='text-sm mt-1'>我</span>
          </Link>

        </div>
      )}

      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

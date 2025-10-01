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
import { useMessages } from '@/lib/MessageContext' 
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

const Footer = () => {
  const router = useRouter()
  const { user, loading } = useAuth()
  const { totalUnreadCount } = useMessages(); 
  
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

  // 定义导航项数据
  const navItems = [
    { path: '/', icon: 'fas fa-home', text: '主页' },
    { path: '/ai-assistant', icon: 'fas fa-robot', text: 'AI助手' },
    { path: '/community', icon: 'fas fa-users', text: '社区' },
    { path: '/messages', icon: 'fas fa-comment-alt', text: '消息' },
    { path: '/me', icon: 'fas fa-user', text: '我' },
  ];

  return (
    <>
      {showDesktopFooter && (
        <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] ...'>
          {/* ... 桌面端页脚内容不变 ... */}
        </footer>
      )}

      {showBottomNav && (
        <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-14 flex justify-around items-center px-2'>
          {navItems.map((item) => {
            // 判断是否为当前选中页面
            const isActive = router.pathname === item.path;
            // 处理 AI 助手的特殊点击事件
            if (item.path === '/ai-assistant') {
              return (
                <button
                  key={item.path}
                  onClick={handleOpenDrawer}
                  className='flex flex-col items-center text-xs px-2 py-1'
                >
                  <<i
                    className={`${item.icon} text-lg ${
                      isActive ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'
                    }`}
                  ></</i>
                  <span
                    className={`${
                      isActive ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {item.text}
                  </span>
                </button>
              );
            }
            // 处理需要权限重定向的导航项（消息、我）
            const hasAuthRedirect = item.path === '/messages' || item.path === '/me';
            return (
              <Link
                key={item.path}
                href={item.path}
                onClick={hasAuthRedirect ? handleAuthRedirect : undefined}
                className='flex flex-col items-center text-xs px-2 py-1 relative'
              >
                {item.path === '/messages' && totalUnreadCount > 0 && (
                  <span className='absolute top-0 right-1.5 flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                  </span>
                )}
                <<i
                  className={`${item.icon} text-lg ${
                    isActive ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'
                  }`}
                ></</i>
                <span
                  className={`${
                    isActive ? 'text-blue-500' : 'text-gray-800 dark:text-gray-200'
                  }`}
                >
                  {item.text}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

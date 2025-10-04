// /components/Footer.js (已修改按钮位置、名称和面板高度)

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
import { useUnreadCount } from '@/lib/UnreadCountContext'
import dynamic from 'next/dynamic'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

const Footer = () => {
  const router = useRouter()
  const { user, authLoading } = useAuth()
  const { totalUnreadCount } = useUnreadCount()

  const [showLoginModal, setShowLoginModal] = useState(false)
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const pagesWithBottomNav = ['/', '/community', '/messages', '/me']
  const isChatPage = router.pathname.startsWith('/messages/') && router.query.chatId
  const showBottomNav = pagesWithBottomNav.includes(router.pathname) && !isChatPage

  const handleOpenDrawer = () => { router.push(router.asPath + '#ai-chat', undefined, { shallow: true }); setDrawerOpen(true) }
  const handleCloseDrawer = () => { if (window.location.hash === '#ai-chat') { router.back() } else { setDrawerOpen(false) } }
  useEffect(() => { const handleHashChange = () => { if (window.location.hash !== '#ai-chat') { setDrawerOpen(false) } }; window.addEventListener('popstate', handleHashChange); return () => { window.removeEventListener('popstate', handleHashChange) } }, [router])

  const handleAuthRedirect = (e) => {
    if (authLoading) {
      e.preventDefault()
      return
    }
    if (!user) {
      e.preventDefault()
      setShowLoginModal(true)
    }
  }

  const showDesktopFooter = router.pathname === '/'

  const defaultColor = 'text-gray-500 dark:text-gray-400'
  const activeColor = 'text-purple-500 dark:text-purple-400'

  if (authLoading) {
    // 可以在这里返回一个加载状态的UI，但为保持结构一致，我们在Link上处理禁用状态
  }

  return (
    <>
      {showDesktopFooter && (
        <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] text-gray-600 dark:text-gray-400 justify-center text-center m-auto p-6 text-sm leading-6'>
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
        // ✅ 高度修改: h-20 改为 h-16
        <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-16 flex justify-around items-center px-2'>

          {/* ✅ 位置和名称修改: 主页 -> 消息 */}
          <Link
            href='/messages'
            onClick={handleAuthRedirect}
            className={`flex flex-col items-center ${router.pathname === '/messages' ? activeColor : defaultColor} px-2 py-1 relative ${authLoading ? 'cursor-not-allowed opacity-50' : ''}`}
          >
              {totalUnreadCount > 0 && (
                  <span className='absolute top-0 right-1.5 flex h-2.5 w-2.5'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500'></span>
                  </span>
              )}
              <i className='fas fa-comment-alt text-xl'></i>
              <span className='text-sm mt-1'>消息</span>
          </Link>

          <button onClick={handleOpenDrawer} className={`flex flex-col items-center ${defaultColor} px-2 py-1`}>
            <i className='fas fa-robot text-xl'></i>
            <span className='text-sm mt-1'>AI助手</span>
          </button>

          <Link href='/community' className={`flex flex-col items-center ${router.pathname === '/community' ? activeColor : defaultColor} px-2 py-1`}>
            <i className='fas fa-users text-xl'></i>
            <span className='text-sm mt-1'>社区</span>
          </Link>

          {/* ✅ 位置和名称修改: 消息 -> 学习 (原主页) */}
          <Link href='/' className={`flex flex-col items-center ${router.pathname === '/' ? activeColor : defaultColor} px-2 py-1`}>
            {/* 使用一个更符合“学习”的图标，例如 fas fa-book-open */}
            <i className='fas fa-book-open text-xl'></i>
            <span className='text-sm mt-1'>学习</span>
          </Link>

          <Link
            href='/me'
            onClick={handleAuthRedirect}
            className={`flex flex-col items-center ${router.pathname === '/me' ? activeColor : defaultColor} px-2 py-1 ${authLoading ? 'cursor-not-allowed opacity-50' : ''}`}
          >
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

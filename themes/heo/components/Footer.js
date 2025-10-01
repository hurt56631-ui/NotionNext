// /components/Footer.js (最终修改版：集成全局未读与页面可见性)

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
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import dynamic from 'next/dynamic'
import events from '@/lib/events' // 导入事件总线

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

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

  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  // --- 新增：定义哪些页面需要显示底部导航栏 ---
  const pagesWithFooter = ['/', '/community', '/messages', '/me'];
  const showFooter = pagesWithFooter.includes(router.pathname);

  // 实时获取总未读消息状态
  useEffect(() => {
    if (!user) {
      setHasUnreadMessages(false);
      return;
    }

    const chatsQuery = query(
      collection(db, 'privateChats'),
      where('members', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(chatsQuery, (snapshot) => {
      let totalUnread = 0;
      const promises = snapshot.docs.map(chatDoc => 
        getDoc(doc(db, `privateChats/${chatDoc.id}/members`, user.uid))
          .then(memberSnap => {
            if (memberSnap.exists() && memberSnap.data().unreadCount > 0) {
              totalUnread += memberSnap.data().unreadCount;
            }
          })
      );
      
      Promise.all(promises).then(() => {
        setHasUnreadMessages(totalUnread > 0);
        // 发送一个全局事件，通知其他组件总未读数状态
        events.dispatch('totalUnreadCountChanged', { count: totalUnread });
      });
    });

    return () => unsubscribe();
  }, [user]);

  // AI 助手相关 Hooks
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
  }, [router])

  const handleAuthRedirect = (e) => {
    if (!loading && !user) {
      e.preventDefault()
      setShowLoginModal(true)
    }
  }

  return (
    <>
      {/* 桌面端页脚 */}
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

      {/* 移动端底部导航栏: 根据 showFooter 变量条件渲染 */}
      {showFooter && (
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
          
          <Link href='/messages' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1 relative'>
              {/* 核心修改: 显示绿点 */}
              {hasUnreadMessages && (
                  <span className='absolute top-0 right-1.5 flex h-2 w-2'>
                    <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75'></span>
                    <span className='relative inline-flex rounded-full h-2 w-2 bg-green-500'></span>
                  </span>
              )}
              <i className='fas fa-comment-alt text-lg'></i>
              <span>消息</span>
          </Link>
          
          <Link href='/me' onClick={handleAuthRedirect} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
            <i className='fas fa-user text-lg'></i>
            <span>我</span>
          </Link>
        </div>
      )}

      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

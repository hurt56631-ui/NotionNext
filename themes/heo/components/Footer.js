// components/Footer.js (最终完整版，已修正布局并集成 Firebase，并统一“我”按钮图标风格)

import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import AiChatAssistant from '@/components/AiChatAssistant'

// 1. 导入 Firebase 相关的 Hooks 和组件
import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'

// 使用 dynamic import 动态加载登录弹窗，避免服务端渲染问题
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

/**
 * 页脚，现在同时包含桌面版页脚和移动版底部导航
 */
const Footer = () => {
  const router = useRouter()
  const BEI_AN = siteConfig('BEI_AN')
  const BEI_AN_LINK = siteConfig('BEI_AN_LINK')
  const BIO = siteConfig('BIO')

  // 判断是否为文章详情页
  const isArticlePage = router.pathname.startsWith('/article/') || router.pathname.startsWith('/post/')

  // 2. 获取全局用户状态和加载状态
  const { user, loading } = useAuth()
  
  // 3. 创建控制登录弹窗显示/隐藏的状态
  const [showLoginModal, setShowLoginModal] = useState(false)

  // --- AI 助手抽屉逻辑 开始 ---
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  const handleOpenDrawer = () => {
    router.push(router.pathname + '#ai-chat', undefined, { shallow: true })
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    if (window.location.hash === '#ai-chat') {
      router.back()
    } else {
      setDrawerOpen(false)
    }
  }

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash !== '#ai-chat') {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('popstate', handleHashChange)
    return () => {
      window.removeEventListener('popstate', handleHashChange)
    }
  }, []) // 空依赖数组确保只在组件挂载和卸载时运行
  // --- AI 助手抽屉逻辑 结束 ---

  // 4. "我" 按钮的点击处理函数
  const handleMyButtonClick = (e) => {
    // 如果用户未登录
    if (!user) {
      // 阻止 Link 组件的默认跳转行为
      e.preventDefault()
      // 打开登录弹窗
      setShowLoginModal(true)
    }
    // 如果用户已登录，则不执行任何操作，让 Link 组件正常跳转到 /me
  }

  return (
    <>
      {/* 桌面端页脚 */}
      <footer className='relative flex-shrink-0 bg-white dark:bg-[#1a191d] justify-center text-center m-auto w-full leading-6 text-gray-600 dark:text-gray-100 text-sm'>
        {/* 颜色过度区 */}
        <div
          id='color-transition'
          className='h-32 bg-gradient-to-b from-[#f7f9fe] to-white dark:bg-[#1a191d] dark:from-inherit dark:to-inherit'
        />

        {/* 社交按钮 */}
        <div className='w-full h-24'>
          <SocialButton />
        </div>

        <br />

        {/* 底部页面信息 (仅在 lg 及以上屏幕显示) */}
        <div
          id='footer-bottom'
          className='hidden lg:flex w-full h-20 flex-col p-3 lg:flex-row justify-between px-6 items-center bg-[#f1f3f7] dark:bg-[#21232A] border-t dark:border-t-[#3D3D3F]'>
          <div id='footer-bottom-left' className='text-center lg:text-start'>
            <PoweredBy />
            <div className='flex gap-x-1'>
              {!isArticlePage && <CopyRightDate />}
              <a href={'/about'} className='underline font-semibold dark:text-gray-300'>
                {siteConfig('AUTHOR')}
              </a>
              {BIO && <span className='mx-1'> | {BIO}</span>}
            </div>
          </div>

          <div id='footer-bottom-right'>
            {BEI_AN && (
              <>
                <i className='fas fa-shield-alt' />{' '}
                <a href={BEI_AN_LINK} className='mr-2'>
                  {BEI_AN}
                </a>
              </>
            )}
            <BeiAnGongAn />
            <span className='hidden busuanzi_container_site_pv'>
              <i className='fas fa-eye' /><span className='px-1 busuanzi_value_site_pv'></span>
            </span>
            <span className='pl-2 hidden busuanzi_container_site_uv'>
              <i className='fas fa-users' /><span className='px-1 busuanzi_value_site_uv'></span>
            </span>
          </div>
        </div>
      </footer>

      {/* 移动端底部导航栏 (仅在 lg 以下屏幕显示) */}
      <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-14 flex justify-around items-center px-2'>
        <Link href='/' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-home text-lg'></i>
          <span>主页</span>
        </Link>
        <button onClick={handleOpenDrawer} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-robot text-lg'></i>
          <span>AI助手</span>
        </button>
        {/* 社区按钮 - 确保链接正确 */}
        <Link href='/community' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-users text-lg'></i>
          <span>社区</span>
        </Link>
        <Link href='/messages' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-comment-alt text-lg'></i>
          <span>消息</span>
        </Link>
        
        {/* 修正后的 "我" 按钮 - 无论登录与否都显示 fas fa-user 图标 */}
        <Link href='/me' onClick={handleMyButtonClick} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          { loading ? (
              // 加载时显示一个占位符，保持图标位置不跳动
              <div className='w-6 h-6 flex items-center justify-center'><div className='w-5 h-5 bg-gray-200 rounded-full animate-pulse'></div></div>
          ) : (
              // 无论登录与否，都显示 fas fa-user 图标
              <i className='fas fa-user text-lg'></i>
          )}
          <span>我</span>
        </Link>
      </div>

      {/* AI 聊天助手抽屉组件实例 */}
      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
      
      {/* 登录弹窗组件实例 */}
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </>
  )
}

export default Footer

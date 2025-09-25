// components/Footer.js (修改后，作为 BottomNav 用)

import { BeiAnGongAn } from '@/components/BeiAnGongAn'
import CopyRightDate from '@/components/CopyRightDate'
import PoweredBy from '@/components/PoweredBy'
import { siteConfig } from '@/lib/config'
import SocialButton from './SocialButton'
import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import AiChatAssistant from './AiChatAssistant' // 1. 导入新的 AI 助手组件

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

  // --- AI 助手抽屉逻辑 开始 ---
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  // 打开抽屉的处理函数
  const handleOpenDrawer = () => {
    // 使用 shallow routing 在不重新加载页面的情况下更改 URL，添加 hash
    router.push(router.pathname + '#ai-chat', undefined, { shallow: true })
    setDrawerOpen(true)
  }

  // 关闭抽屉的处理函数
  const handleCloseDrawer = () => {
    // 检查 hash 是否存在，如果存在则通过 router.back() 返回，这会移除 hash 并触发 popstate
    if (window.location.hash === '#ai-chat') {
      router.back()
    } else {
      // 如果是通过点击关闭按钮等方式，直接设置状态
      setDrawerOpen(false)
    }
  }

  // 监听 URL hash 的变化来处理手势返回
  useEffect(() => {
    const handleHashChange = () => {
      // 当 hash 不再是 #ai-chat 时，关闭抽屉
      if (window.location.hash !== '#ai-chat') {
        setDrawerOpen(false)
      }
    }
    
    // 监听 popstate 事件，它能捕获浏览器的前进/后退操作（包括手势）
    window.addEventListener('popstate', handleHashChange)
    
    // 组件卸载时移除监听器
    return () => {
      window.removeEventListener('popstate', handleHashChange)
    }
  }, []) // 空依赖数组确保只在组件挂载和卸载时运行

  // --- AI 助手抽屉逻辑 结束 ---

  return (
    <>
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
      <div className='fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-[#1a191d] border-t dark:border-t-[#3D3D3F] shadow-lg lg:hidden z-30 h-14 flex justify-around items-center'>
        <Link href='/' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-home text-lg'></i>
          <span>主页</span>
        </Link>
        {/* AI 助手按钮，点击打开抽屉 */}
        <button onClick={handleOpenDrawer} className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-robot text-lg'></i>
          <span>AI助手</span>
        </button>
        <Link href='/community' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-users text-lg'></i>
          <span>社区</span>
        </Link>
        <Link href='/messages' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-comment-alt text-lg'></i>
          <span>消息</span>
        </Link>
        <Link href='/me' className='flex flex-col items-center text-gray-800 dark:text-gray-200 text-xs px-2 py-1'>
          <i className='fas fa-user text-lg'></i>
          <span>我</span>
        </Link>
      </div>

      {/* AI 聊天助手抽屉组件实例 */}
      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
    </>
  )
}

export default Footer

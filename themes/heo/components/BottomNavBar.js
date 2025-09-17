// components/BottomNavBar.js (修改版)

import Link from 'next/link'
import { useRouter } from 'next/router'
import React, { useState, useEffect } from 'react'
import AiChatAssistant from './AiChatAssistant' // 1. 导入我们创建的组件

const BottomNavBar = () => {
  const router = useRouter()
  // 2. 添加状态来控制抽屉的打开/关闭
  const [isDrawerOpen, setDrawerOpen] = useState(false)

  // 3. 修改导航项定义，为 AI 助手添加一个触发器标记
  const navItems = [
    { href: '/', label: '主页', iconClass: 'fas fa-home' },
    // 将 AI 助手标记为触发器，而不是一个链接
    { label: 'AI助手', iconClass: 'fas fa-robot', isTrigger: true },
    { href: '/forum', label: '社区', iconClass: 'fas fa-comments' },
    { href: '/jobs', label: '找工作', iconClass: 'fas fa-briefcase' },
    { href: '/forum/messages', label: '消息', iconClass: 'fas fa-paper-plane' }
  ]

  // 4. 添加打开和关闭抽屉的处理函数
  const handleOpenDrawer = () => {
    // 使用 shallow routing 在不重新加载页面的情况下更改 URL，以支持手势返回
    router.push(router.pathname + '#ai-chat', undefined, { shallow: true })
    setDrawerOpen(true)
  }

  const handleCloseDrawer = () => {
    // 如果 URL 中还有 hash，则返回上一页（这会移除 hash 并触发 popstate）
    if (window.location.hash === '#ai-chat') {
      router.back()
    } else {
      // 如果没有 hash（例如，用户直接点击关闭按钮），直接关闭
      setDrawerOpen(false)
    }
  }

  // 5. 添加 useEffect 来监听 URL 变化，处理手势返回
  useEffect(() => {
    const handleHashChange = () => {
      // 当 hash 不再是 #ai-chat 时（例如用户手势返回），关闭抽屉
      if (window.location.hash !== '#ai-chat' && isDrawerOpen) {
        setDrawerOpen(false)
      }
    }
    // popstate 事件可以捕获浏览器的前进/后退操作
    window.addEventListener('popstate', handleHashChange)

    return () => {
      window.removeEventListener('popstate', handleHashChange)
    }
  }, [isDrawerOpen, router]) // 依赖 isDrawerOpen 确保我们总是有最新的状态

  return (
    <>
      {/* 为小屏幕设备预留底部空间，防止内容被导航栏遮挡 */}
      <style jsx global>{`
        @media (max-width: 767px) {
          body {
            padding-bottom: 4rem; /* 导航栏高度 h-16 */
          }
        }
      `}</style>

      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-[0_-1px_10px_rgba(0,0,0,0.1)] flex justify-around items-center z-40 md:hidden">
        {navItems.map(item => {
          // 6. 根据 isTrigger 属性，渲染不同的元素
          if (item.isTrigger) {
            // 如果是触发器，渲染一个 button
            return (
              <button
                key={item.label}
                onClick={handleOpenDrawer}
                className="flex flex-col items-center justify-center w-full h-full transition-colors text-gray-500 dark:text-gray-400 hover:text-blue-500"
              >
                <i className={`${item.iconClass} text-xl`}></i>
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            )
          }

          // 如果是普通链接，保持原样
          const isActive = router.pathname === item.href || router.pathname.startsWith(`${item.href}/`)
          return (
            <Link key={item.href} href={item.href} legacyBehavior>
              <a className={`flex flex-col items-center justify-center w-full h-full transition-colors ${isActive ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                <i className={`${item.iconClass} text-xl`}></i>
                <span className="text-xs mt-1">{item.label}</span>
              </a>
            </Link>
          )
        })}
      </nav>

      {/* 7. 在这里渲染我们的 AI 助手抽屉组件 */}
      <AiChatAssistant isOpen={isDrawerOpen} onClose={handleCloseDrawer} />
    </>
  )
}

export default BottomNavBar

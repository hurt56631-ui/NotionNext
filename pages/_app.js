// /pages/_app.js (最终集成PWA自定义弹窗版)

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useEffect } from 'react' // 确保 useEffect 在这里
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

import { AuthProvider } from '@/lib/AuthContext'
import { UnreadCountProvider } from '@/lib/UnreadCountContext'

// ✅ 1. 导入自定义PWA弹窗组件和Hook
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import { usePWAInstall } from '@/hooks/usePWAInstall'

// AppInner 组件保持不变
const AppInner = ({ Component, pageProps }) => {
  useAdjustStyle()
  
  const route = useRouter()
  const theme = useMemo(() => {
    return (
      getQueryParam(route.asPath, 'theme') ||
      pageProps?.NOTION_CONFIG?.THEME ||
      BLOG.THEME
    )
  }, [route])

  const GLayout = useCallback(
    props => {
      const Layout = getBaseLayoutByTheme(theme)
      return <Layout {...props} />
    },
    [theme]
  )

  return (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
      </GLayout>
      <ExternalPlugins {...pageProps} />
    </GlobalContextProvider>
  )
}

// 最终的 MyApp 组件
const MyApp = ({ Component, pageProps }) => {
  // ✅ 2. 使用自定义Hook来获取PWA弹窗的状态和处理函数
  const { showInstallPrompt, handleInstallClick, handleDismissClick } = usePWAInstall()

  // 注册Service Worker的逻辑 (保持不变)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('/sw.js').then(
          function (registration) {
            console.log('Service Worker registration successful with scope: ', registration.scope)
          },
          function (err) {
            console.log('Service Worker registration failed: ', err)
          }
        )
      })
    }
  }, [])
  
  return (
    <AuthProvider>
      <UnreadCountProvider>
        {/* 核心UI */}
        <AppInner Component={Component} pageProps={pageProps} />
        
        {/* ✅ 3. 在这里渲染自定义PWA安装弹窗 */}
        {/* 它会根据 showInstallPrompt 的状态自动显示或隐藏 */}
        <PwaInstallPrompt
          show={showInstallPrompt}
          onInstall={handleInstallClick}
          onDismiss={handleDismissClick}
        />
      </UnreadCountProvider>
    </AuthProvider>
  )
}

export default MyApp

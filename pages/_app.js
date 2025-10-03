// /pages/_app.js (最终集成版)

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo, useEffect } from 'react' // ✅ 核心修改 1: 引入 useEffect
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

// ✅ 核心修改 2: 导入我们需要的 Firebase 模块
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'       // 假设 firebase 配置文件在 lib 目录
import { setupPresence } from '@/lib/presence'   // 假设 presence 逻辑文件在 lib 目录

// ✅ 核心修改 3: 导入所有需要的 Provider
import { AuthProvider } from '@/lib/AuthContext';
import { UnreadCountProvider } from '@/lib/UnreadCountContext'; 

// AppInner 组件，在这里集成我们的功能
const AppInner = ({ Component, pageProps }) => {
  useAdjustStyle()
  
  // ✅ 核心修改 4: 在 AppInner 中添加 useEffect 来监听用户状态并设置在线 Presence
  useEffect(() => {
    // onAuthStateChanged 是 Firebase 官方的监听器
    // 当用户登录、登出或页面刷新时，它会自动触发以获取当前状态
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // 如果 user 存在 (已登录)，就为这个用户设置在线状态监听
        setupPresence(user);
      }
      // 如果 user 是 null (已登出)，我们什么都不做，onDisconnect 机制会自动处理状态
    });

    // 当应用关闭或组件卸载时，取消监听，这是一个好习惯，可以防止内存泄漏
    return () => unsubscribe();
  }, []); // 空依赖数组 [] 意味着这个 effect 只在应用首次加载时运行一次

  // --- 以下是您原有的 AppInner 逻辑，保持不变 ---
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

// MyApp 组件结构保持不变
const MyApp = ({ Component, pageProps }) => {
  return (
    <AuthProvider>
      <UnreadCountProvider>
        <AppInner Component={Component} pageProps={pageProps} />
      </UnreadCountProvider>
    </AuthProvider>
  )
}

export default MyApp

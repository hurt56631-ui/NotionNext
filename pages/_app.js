// /pages/_app.js (最终架构修复版)

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

// ✅ 核心修改：导入所有需要的 Provider
import { AuthProvider } from '@/lib/AuthContext';
import { UnreadCountProvider } from '@/lib/UnreadCountContext'; 

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

// ✅ 核心修复：重构 MyApp 以正确嵌套 Provider
const MyApp = ({ Component, pageProps }) => {
  return (
    // 1. 最外层是 AuthProvider，它不依赖其他 Context
    <AuthProvider>
      {/* 2. 内层是 UnreadCountProvider，它可能会间接依赖 AuthProvider (通过 useAuth) */}
      <UnreadCountProvider>
        <AppInner Component={Component} pageProps={pageProps} />
      </UnreadCountProvider>
    </AuthProvider>
  )
}

export default MyApp

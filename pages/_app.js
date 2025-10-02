// pages/_app.js (最终版 - 已集成 UnreadCountProvider)

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

import { AuthProvider } from '@/lib/AuthContext';
// ✅ ---【核心修改】--- ✅
// 导入我们新创建的 UnreadCountProvider
import { UnreadCountProvider } from '@/lib/UnreadCountContext'; 
// 移除旧的 MessageProvider 导入 (如果有)
// import { MessageProvider } from '@/lib/MessageContext'; 

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

const MyApp = ({ Component, pageProps }) => {
  return (
    <AuthProvider>
      {/* ✅ 关键：用 UnreadCountProvider 包裹 AppInner */}
      <UnreadCountProvider>
        <AppInner Component={Component} pageProps={pageProps} />
      </UnreadCountProvider>
    </AuthProvider>
  )
}

export default MyApp

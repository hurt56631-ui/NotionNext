
// pages/_app.js (已修改)

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

import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { MessageProvider } from '@/lib/MessageContext'; // <-- 导入 MessageProvider

const AppInner = ({ Component, pageProps }) => {
  useAdjustStyle()
  // useHeartbeat 仍然可以保留，因为它不影响UI
  
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
      {/* 将 MessageProvider 包裹在 AuthProvider 内部 */}
      <MessageProvider>
        <AppInner Component={Component} pageProps={pageProps} />
      </MessageProvider>
    </AuthProvider>
  )
}

export default MyApp

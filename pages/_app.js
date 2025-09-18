// _app.js (彻底清理版)

// 导入你的样式文件...
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

// 导入 Firebase Auth Provider
import { AuthProvider } from '../lib/AuthContext'
// 【核心修改】: 彻底移除对 DrawerProvider 的引用
// import { DrawerProvider } from '../lib/DrawerContext' 

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'

import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

/**
 * App挂载DOM 入口文件
 */
const MyApp = ({ Component, pageProps }) => {
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

  const content = (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
      </GLayout>
      <ExternalPlugins {...pageProps} />
    </GlobalContextProvider>
  )
  
  return (
    <AuthProvider>
      {/* 【核心修改】: 彻底移除 DrawerProvider 的包裹 */}
      {content}
    </AuthProvider>
  )
}

export default MyApp

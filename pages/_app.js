// _app.js

// 导入你的样式文件...
//import '@/styles/animate.css'
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

// 导入 Firebase Auth Provider
import { AuthProvider } from '../lib/AuthContext' // 导入我们创建的 AuthProvider

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

  // 移除了所有 Clerk 相关的代码
  const content = (
    <GlobalContextProvider {...pageProps}>
      <GLayout {...pageProps}>
        <SEO {...pageProps} />
        <Component {...pageProps} />
      </GLayout>
      <ExternalPlugins {...pageProps} />
    </GlobalContextProvider>
  )
  
  // 在最外层用 AuthProvider 包裹整个应用
  return (
    <AuthProvider>
      {content}
    </AuthProvider>
  )
}

export default MyApp

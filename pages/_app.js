// _app.js (最终修改版)

// 导入你的样式文件...
//import '@/styles/animate.css'
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'

// 导入 Firebase Auth Provider
import { AuthProvider } from '../lib/AuthContext'
// 1. 从我们创建的新文件中导入 DrawerProvider
import { DrawerProvider } from '../lib/DrawerContext' 

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
  
  // 2. 在 AuthProvider 内部，用 DrawerProvider 包裹所有内容
  // 这样，应用里的任何组件都可以通过 `useDrawer()` 来控制抽屉了
  return (
    <AuthProvider>
      <DrawerProvider>
        {content}
      </DrawerProvider>
    </AuthProvider>
  )
}

export default MyApp

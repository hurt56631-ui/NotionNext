// pages/_app.js

// 导入 Firebase 全局认证上下文
import { AuthProvider } from '../lib/AuthContext'; 

// 样式导入 (保持不变)
import '@/styles/animate.css' 
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import 'react-notion-x/src/styles.css'
import '@/styles/notion.css'

// 其他 Hooks 和组件 (保持不变)
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
 * @param {*} param0
 * @returns
 */
const MyApp = ({ Component, pageProps }) => {
  // 样式调整 Hook (保持不变)
  useAdjustStyle()

  const route = useRouter()
  
  // 主题逻辑 (保持不变)
  const theme = useMemo(() => {
    return (
      getQueryParam(route.asPath, 'theme') ||
      pageProps?.NOTION_CONFIG?.THEME ||
      BLOG.THEME
    )
  }, [route])

  // 布局逻辑 (保持不变)
  const GLayout = useCallback(
    props => {
      const Layout = getBaseLayoutByTheme(theme)
      return <Layout {...props} />
    },
    [theme]
  )

  return (
    // <--- 新增的 AuthProvider 包裹层 --->
    // 它使得整个应用都能访问到用户登录状态
    <AuthProvider>
      <GlobalContextProvider {...pageProps}>
        <GLayout {...pageProps}>
          <SEO {...pageProps} />
          <Component {...pageProps} />
        </GLayout>
        <ExternalPlugins {...pageProps} />
      </GlobalContextProvider>
    </AuthProvider>
  )
}

export default MyApp

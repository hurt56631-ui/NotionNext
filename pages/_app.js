// pages/_app.js (已集成心跳功能)

// import '@/styles/animate.css' // @see https://animate.style/
import '@/styles/globals.css'
import '@/styles/utility-patterns.css'

// core styles shared by all of react-notion-x (required)
import '@/styles/notion.css' //  重写部分notion样式
import 'react-notion-x/src/styles.css' // 原版的react-notion-x

import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'

// 各种扩展插件 这个要阻塞引入
import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

// 导入我们新创建的 AuthProvider
import { AuthProvider, useAuth } from '@/lib/AuthContext'; // <--- 修改: 同时导入 useAuth
import { useHeartbeat } from '@/hooks/useHeartbeat'; // <--- 新增: 导入心跳 Hook

/**
 * 真正执行 App 逻辑的组件
 */
const AppInner = ({ Component, pageProps }) => {
  // 一些可能出现 bug 的样式，可以统一放入该钩子进行调整
  useAdjustStyle()
  
  // --- 新增逻辑开始 ---
  const { user } = useAuth(); // 使用 useAuth 获取当前用户
  useHeartbeat(user?.uid); // 当用户登录后 (user.uid 存在时)，启动心跳
  // --- 新增逻辑结束 ---

  const route = useRouter()
  const theme = useMemo(() => {
    return (
      getQueryParam(route.asPath, 'theme') ||
      pageProps?.NOTION_CONFIG?.THEME ||
      BLOG.THEME
    )
  }, [route])

  // 整体布局
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


/**
 * App挂载DOM 入口文件
 * @param {*} param0
 * @returns
 */
const MyApp = ({ Component, pageProps }) => {
  return (
    // 我们将所有内容包裹在 AuthProvider 中
    <AuthProvider>
      <AppInner Component={Component} pageProps={pageProps} />
    </AuthProvider>
  )
}

export default MyApp

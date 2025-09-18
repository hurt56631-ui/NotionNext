// _app.js (最终清理版)

import '@/styles/globals.css'
import '@/styles/utility-patterns.css'
import '@/styles/notion.css'
import 'react-notion-x/src/styles.css'
import { AuthProvider } from '../lib/AuthContext'
// 不再要 DrawerProvider
import useAdjustStyle from '@/hooks/useAdjustStyle'
import { GlobalContextProvider } from '@/lib/global'
import { getBaseLayoutByTheme } from '@/themes/theme'
import { useRouter } from 'next/router'
import { useCallback, useMemo } from 'react'
import { getQueryParam } from '../lib/utils'
import BLOG from '@/blog.config'
import ExternalPlugins from '@/components/ExternalPlugins'
import SEO from '@/components/SEO'

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
      {content}
    </AuthProvider>
  )
}

export default MyApp

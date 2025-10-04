/**
 *   HEO 主题说明
 *  > 主题设计者 [张洪](https://zhheo.com/)
 *  > 主题开发者 [tangly1024](https://github.com/tangly1024)
 *  1. 开启方式 在blog.config.js 将主题配置为 `HEO`
 *  2. 更多说明参考此[文档](https://docs.tangly1024.com/article/notionnext-heo)
 *
 *  =============== V3 (AI MODIFICATION) ===============
 *  1.  新增了 React, react-icons 等依赖。
 *  2.  完全重写了 LayoutIndex (首页) 组件，替换为全新的现代化布局。
 *  3.  为了避免SSR错误，首页内容已设置为仅在客户端渲染。
 *  4.  所有新首页的样式已内嵌在组件中，无需修改其他CSS文件。
 *
 *  =============== V2 修改说明 ===============
 *  根据您的要求，已修改：
 *  1. 仅在首页显示页脚(Footer)，其他所有页面（文章、归档、404等）均不显示。
 *
 *  =============== V1 修改说明 ===============
 *  已移除：
 *  1. 文章页顶栏背景图
 *  2. 上一篇、下一篇文章链接
 *  3. 分享按钮
 *  4. 版权说明
 *  5. 文章推荐、相关文章
 *  6. 404页面底部的最新文章
 */

import Comment from '@/components/Comment'
import { AdSlot } from '@/components/GoogleAdsense'
import { HashTag } from '@/components/HeroIcons'
import LazyImage from '@/components/LazyImage'
import LoadingCover from '@/components/LoadingCover'
import replaceSearchResult from '@/components/Mark'
import NotionPage from '@/components/NotionPage'
import WWAds from '@/components/WWAds'
import { siteConfig } from '@/lib/config'
import { useGlobal } from '@/lib/global'
import { loadWowJS } from '@/lib/plugins/wow'
import { isBrowser } from '@/lib/utils'
import { Transition } from '@headlessui/react'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import React, { useEffect, useState } from 'react' // <--- 新增引入
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
import Footer from './components/Footer'
import Header from './components/Header'
import Hero from './components/Hero'
import { NoticeBar } from './components/NoticeBar'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import SearchNav from './components/SearchNav'
import SideRight from './components/SideRight'
import CONFIG from './config'
import { Style } from './style'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'

// --- 新增引入 ---
// 请确保您已安装 react-icons: npm install react-icons
import { FaTiktok, FaFacebook, FaYoutube, FaSearch } from 'react-icons/fa'
import { CgPinyin } from 'react-icons/cg'
import { MdTranslate, MdOutlineQuiz, MdSpellcheck, MdLibraryBooks } from 'react-icons/md'
// --- 结束新增 ---

/**
 * 基础布局 采用上中下布局，移动端使用顶部侧边导航栏
 * @param props
 * @returns {JSX.Element}
 * @constructor
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props

  // 全屏模式下的最大宽度
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()

  const headerSlot = (
    <header>
      {/* 顶部导航 */}
      <Header {...props} />

      {/* 通知横幅, Hero大图现在由新的LayoutIndex自己控制，这里需要调整 */}
      {router.route === '/' ? (
        <>
          <NoticeBar />
          {/* <Hero {...props} /> */} {/* 旧的Hero组件在我们的新主页里不再需要 */}
        </>
      ) : null}
      {/* 修改：在文章页面(props.post存在时)不显示顶部背景图 */}
      {fullWidth || props.post ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )

  // 右侧栏 用户信息+标签列表
  const slotRight =
    router.route === '/404' || fullWidth ? null : <SideRight {...props} />

  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]' // 普通最大宽度是86rem和顶部菜单栏对齐，留空则与窗口对齐

  const HEO_HERO_BODY_REVERSE = siteConfig(
    'HEO_HERO_BODY_REVERSE',
    false,
    CONFIG
  )
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  // 加载wow动画
  useEffect(() => {
    loadWowJS()
  }, [])

  // 如果是首页，则main的padding由新的LayoutIndex自己控制
  const mainPadding = router.route === '/' ? '' : 'md:px-5'

  return (
    <div
      id='theme-heo'
      className={`${siteConfig('FONT_STYLE')} bg-white dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />

      {/* 顶部嵌入 导航栏，首页放hero，文章页放文章详情 */}
      {/* 如果是首页，则不显示旧的Header，因为新的首页自带Header */}
      {router.route !== '/' && headerSlot}

      {/* 主区块 */}
      <main
        id='wrapper-outer'
        className={`flex-grow w-full ${router.route === '/' ? '' : maxWidth} mx-auto relative ${mainPadding}`}>
        <div
          id='container-inner'
          className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
          <div className={`w-full h-auto ${className || ''}`}>
            {/* 主区上部嵌入 */}
            {slotTop}
            {children}
          </div>

          {/* 右侧边栏在首页也不显示 */}
          {router.route !== '/' && (
            <>
              <div className='lg:px-2'></div>
              <div className='hidden xl:block'>
                {slotRight}
              </div>
            </>
          )}

        </div>
      </main>

      {/* 页脚 (修改：仅在首页 '/' 显示页脚) */}
      {router.pathname === '/' && <Footer />}

      {HEO_LOADING_COVER && <LoadingCover />}
    </div>
  )
}

/**
 * 首页
 * 已被完全重写为全新的现代化布局
 * @param {*} props
 * @returns
 */
const LayoutIndex = props => {
  const [isClient, setIsClient] = useState(false)

  // 这个useEffect钩子用于处理元素的滚动出现动画
  useEffect(() => {
    // 确保只在客户端执行
    setIsClient(true)

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
        }
      })
    }, {
      threshold: 0.1 // 元素进入视口10%时触发
    })

    const elements = document.querySelectorAll('.fade-in-up')
    elements.forEach(el => observer.observe(el))

    // 组件卸载时取消观察
    return () => elements.forEach(el => observer.unobserve(el))
  }, [])

  // 在服务器端或客户端初次渲染时，返回一个占位符，避免 hydration Mismatch
  if (!isClient) {
    return <div style={{ minHeight: '100vh', background: '#18171d' }}></div>
  }

  // 仅在客户端渲染实际的主页内容
  return (
        <>
            {/* 新首页的专属样式 */}
            <style jsx global>{`
                /* --- 全局与字体定义 --- */
                :root {
                  --primary-color: #0052D4; /* 主题色 - 一种现代蓝 */
                  --text-color-dark: #222;
                  --text-color-light: #666;
                  --bg-color-light: #ffffff;
                  --bg-color-grey: #f7f8fa;
                  --border-color: #e5e7eb;
                }

                /* --- 动画效果 --- */
                .fade-in-up {
                  opacity: 0;
                  transform: translateY(30px);
                  transition: opacity 0.6s ease-out, transform 0.6s ease-out;
                }

                .fade-in-up.visible {
                  opacity: 1;
                  transform: translateY(0);
                }

                /* --- 1. 沉浸式首屏 --- */
                .hero-section-new {
                  position: relative;
                  height: 100vh;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  text-align: center;
                  color: white;
                  overflow: hidden;
                }

                .video-background {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  z-index: 1;
                }

                .video-background video {
                  width: 100%;
                  height: 100%;
                  object-fit: cover; /* 保证视频填满容器 */
                }

                .hero-overlay-new {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background: rgba(0, 0, 0, 0.4); /* 黑色蒙版，突出文字 */
                  z-index: 2;
                }

                .hero-content-new {
                  position: relative;
                  z-index: 3;
                  animation: fadeIn 1.5s ease-in-out;
                }

                .main-title-new {
                  font-size: clamp(2.5rem, 8vw, 4.5rem); /* 响应式字体 */
                  font-weight: 700;
                  letter-spacing: 2px;
                  text-shadow: 0 4px 15px rgba(0,0,0,0.4);
                }

                .subtitle-new {
                  font-size: clamp(1rem, 4vw, 1.5rem);
                  font-weight: 300;
                  margin-top: 1rem;
                  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }

                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(20px); }
                  to { opacity: 1; transform: translateY(0); }
                }

                /* --- 主内容区通用样式 --- */
                .main-content-new {
                  background-color: var(--bg-color-light);
                  position: relative;
                  z-index: 5; /* 确保在首屏视频之上 */
                }

                .section-container-new {
                  max-width: 1200px;
                  margin: 0 auto;
                  padding: 80px 20px;
                }
                
                .section-title-new {
                  text-align: center;
                  font-size: 2.5rem;
                  font-weight: 700;
                  color: var(--text-color-dark);
                  margin-bottom: 0.5rem;
                }

                .section-subtitle-new {
                  text-align: center;
                  font-size: 1.1rem;
                  color: var(--text-color-light);
                  margin-bottom: 3rem;
                  max-width: 600px;
                  margin-left: auto;
                  margin-right: auto;
                }

                /* --- 2. 直播网格 --- */
                .live-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                  gap: 24px;
                }

                .live-card {
                  position: relative;
                  border-radius: 16px;
                  overflow: hidden;
                  height: 250px;
                  color: white;
                  text-decoration: none;
                  transition: transform 0.3s ease, box-shadow 0.3s ease;
                  display: flex;
                  flex-direction: column;
                  justify-content: flex-end;
                  padding: 20px;
                }

                .live-card.large-card {
                  grid-column: span 1; 
                }

                @media (min-width: 768px) {
                    .live-card.large-card {
                        grid-column: span 2;
                    }
                }


                .live-card:hover {
                  transform: translateY(-8px);
                  box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                }

                .live-card-bg {
                  position: absolute;
                  top: 0;
                  left: 0;
                  width: 100%;
                  height: 100%;
                  background-size: cover;
                  background-position: center;
                  transition: transform 0.4s ease;
                }

                .live-card:hover .live-card-bg {
                  transform: scale(1.05); /* 悬浮时背景图放大 */
                }

                .live-card-content {
                  position: relative;
                  z-index: 2;
                  background: rgba(0,0,0,0.2);
                  backdrop-filter: blur(8px);
                  -webkit-backdrop-filter: blur(8px); /* Safari support */
                  padding: 16px;
                  border-radius: 12px;
                  border: 1px solid rgba(255,255,255,0.2);
                }

                .live-card-content span {
                  display: block;
                  font-weight: 500;
                  margin-top: 8px;
                }

                .live-status {
                    position: absolute;
                    top: 16px;
                    right: 16px;
                    background-color: #E53935;
                    color: white;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 500;
                }


                /* --- 3. 汉缅词典 --- */
                .dictionary-wrapper {
                  background-color: var(--bg-color-grey);
                  border-radius: 20px;
                  padding: 40px;
                  text-align: center;
                  border: 1px solid var(--border-color);
                }
                .dictionary-wrapper .section-title-new {
                  margin-bottom: 2rem;
                }

                .dictionary-input-group {
                  display: flex;
                  align-items: center;
                  max-width: 600px;
                  margin: 0 auto;
                  background: var(--bg-color-light);
                  border-radius: 12px;
                  border: 1px solid var(--border-color);
                  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                  padding: 8px;
                }

                .dictionary-input-group .input-icon {
                  font-size: 1.5rem;
                  color: var(--text-color-light);
                  margin: 0 12px;
                }

                .dictionary-input-group input {
                  flex-grow: 1;
                  border: none;
                  outline: none;
                  background: transparent;
                  font-size: 1.1rem;
                  padding: 12px 0;
                }

                .dictionary-input-group .search-button {
                  background: var(--primary-color);
                  color: white;
                  border: none;
                  border-radius: 8px;
                  padding: 12px 20px;
                  cursor: pointer;
                  font-size: 1.2rem;
                  transition: background-color 0.2s ease;
                }
                .dictionary-input-group .search-button:hover {
                  background: #0041a8;
                }

                /* --- 4. 学习工具 --- */
                .tools-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                  gap: 24px;
                }

                .tool-card {
                  background: var(--bg-color-grey);
                  border: 1px solid var(--border-color);
                  border-radius: 16px;
                  padding: 32px;
                  text-align: center;
                  text-decoration: none;
                  color: var(--text-color-dark);
                  transition: transform 0.3s ease, box-shadow 0.3s ease, border-color 0.3s ease;
                }

                .tool-card:hover {
                  transform: translateY(-8px);
                  box-shadow: 0 15px 30px rgba(0, 82, 212, 0.08);
                  border-color: var(--primary-color);
                }

                .tool-icon {
                  font-size: 3rem;
                  color: var(--primary-color);
                  margin-bottom: 1rem;
                }

                .tool-card h3 {
                  font-size: 1.4rem;
                  font-weight: 500;
                  margin-bottom: 0.5rem;
                }

                .tool-card p {
                  color: var(--text-color-light);
                  margin: 0;
                }
            `}
            </style>

            {/* 新首页的JSX结构 */}
            <div className="modern-homepage">
                {/* 这里的Header是原来主题的Header，我们可以在首屏之上叠加它 */}
                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', zIndex: 100 }}>
                    <Header {...props} />
                </div>

                {/* --- Section 1: 沉浸式首屏 --- */}
                <header className="hero-section-new">
                    <div className="video-background">
                        {/* 请将下面的视频和图片路径替换为您自己的文件路径 */}
                        {/* 视频和图片文件需要放在项目根目录的 /public 文件夹下 */}
                        <video autoPlay loop muted playsInline poster="/path/to/poster-image.jpg">
                            <source src="/path/to/your-background-video.mp4" type="video/mp4" />
                        </video>
                    </div>
                    <div className="hero-overlay-new"></div>
                    <div className="hero-content-new">
                        <h1 className="main-title-new">我爱中文</h1>
                        <p className="subtitle-new">探索汉字之美，感受华夏之韵</p>
                    </div>
                </header>

                <main className="main-content-new">
                    {/* --- Section 2: 直播与核心入口 --- */}
                    <section className="section-container-new">
                        <h2 className="section-title-new fade-in-up">实时互动课堂</h2>
                        <p className="section-subtitle-new fade-in-up">随时随地，加入我们的直播，与老师和同学在线交流</p>
                        <div className="live-grid fade-in-up">
                            <a href="#" className="live-card large-card">
                                {/* 请替换为您自己的图片 */}
                                <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/youtube-cover.jpg)' }}></div>
                                <div className="live-card-content">
                                    <FaYoutube size={32} />
                                    <span>YouTube 主频道</span>
                                    <span className="live-status">直播中</span>
                                </div>
                            </a>
                            <a href="#" className="live-card">
                                <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/tiktok-cover.jpg)' }}></div>
                                <div className="live-card-content">
                                    <FaTiktok size={24} />
                                    <span>TikTok 短视频</span>
                                </div>
                            </a>
                            <a href="#" className="live-card">
                                <div className="live-card-bg" style={{ backgroundImage: 'url(/path/to/facebook-cover.jpg)' }}></div>
                                <div className="live-card-content">
                                    <FaFacebook size={24} />
                                    <span>Facebook 交流群</span>
                                </div>
                            </a>
                        </div>
                    </section>

                    {/* --- Section 3: 汉缅词典 --- */}
                    <section className="section-container-new">
                        <div className="dictionary-wrapper fade-in-up">
                            <h2 className="section-title-new">随身汉缅词典</h2>
                            <div className="dictionary-input-group">
                                <MdTranslate className="input-icon" />
                                <input type="text" placeholder="输入单词或短句..." />
                                <button className="search-button"><FaSearch /></button>
                            </div>
                        </div>
                    </section>

                    {/* --- Section 4: 学习工具 --- */}
                    <section className="section-container-new">
                        <h2 className="section-title-new fade-in-up">全功能学习工具箱</h2>
                        <p className="section-subtitle-new fade-in-up">从拼音到语法，我们为你准备了所有学习工具</p>
                        <div className="tools-grid fade-in-up">
                            <a href="/pinyin" className="tool-card">
                                <CgPinyin className="tool-icon" />
                                <h3>拼音查询</h3>
                                <p>掌握标准发音</p>
                            </a>
                            <a href="/vocabulary" className="tool-card">
                                <MdSpellcheck className="tool-icon" />
                                <h3>生词本</h3>
                                <p>记录和复习新词</p>
                            </a>
                            <a href="/sentences" className="tool-card">
                                <MdLibraryBooks className="tool-icon" />
                                <h3>情景短句</h3>
                                <p>学习地道表达</p>
                            </a>
                            <a href="/exercises" className="tool-card">
                                <MdOutlineQuiz className="tool-icon" />
                                <h3>在线练习</h3>
                                <p>巩固学习成果</p>
                            </a>
                        </div>
                    </section>
                </main>
            </div>
        </>
  )
}


/**
 * 博客列表
 * @param {*} props
 * @returns
 */
const LayoutPostList = props => {
  return (
    <div id='post-outer-wrapper' className='px-5  md:px-0'>
      {/* 文章分类条 */}
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? (
        <BlogPostListPage {...props} />
      ) : (
        <BlogPostListScroll {...props} />
      )}
    </div>
  )
}

/**
 * 搜索
 * @param {*} props
 * @returns
 */
const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

  useEffect(() => {
    // 高亮搜索结果
    if (currentSearch) {
      setTimeout(() => {
        replaceSearchResult({
          doms: document.getElementsByClassName('replace'),
          search: currentSearch,
          target: {
            element: 'span',
            className: 'text-red-500 border-b border-dashed'
          }
        })
      }, 100)
    }
  }, [])
  return (
    <div currentSearch={currentSearch}>
      <div id='post-outer-wrapper' className='px-5  md:px-0'>
        {!currentSearch ? (
          <SearchNav {...props} />
        ) : (
          <div id='posts-wrapper'>
            {siteConfig('POST_LIST_STYLE') === 'page' ? (
              <BlogPostListPage {...props} />
            ) : (
              <BlogPostListScroll {...props} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * 归档
 * @param {*} props
 * @returns
 */
const LayoutArchive = props => {
  const { archivePosts } = props

  // 归档页顶部显示条，如果是默认归档则不显示。分类详情页显示分类列表，标签详情页显示当前标签

  return (
    <div className='p-5 rounded-xl border dark:border-gray-600 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
      {/* 文章分类条 */}
      <CategoryBar {...props} border={false} />

      <div className='px-3'>
        {Object.keys(archivePosts).map(archiveTitle => (
          <BlogPostArchive
            key={archiveTitle}
            posts={archivePosts[archiveTitle]}
            archiveTitle={archiveTitle}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * 文章详情
 * @param {*} props
 * @returns
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { locale, fullWidth } = useGlobal()

  const [hasCode, setHasCode] = useState(false)

  useEffect(() => {
    const hasCode = document.querySelectorAll('[class^="language-"]').length > 0
    setHasCode(hasCode)
  }, [])

  const commentEnable =
    siteConfig('COMMENT_TWIKOO_ENV_ID') ||
    siteConfig('COMMENT_WALINE_SERVER_URL') ||
    siteConfig('COMMENT_VALINE_APP_ID') ||
    siteConfig('COMMENT_GISCUS_REPO') ||
    siteConfig('COMMENT_CUSDIS_APP_ID') ||
    siteConfig('COMMENT_UTTERRANCES_REPO') ||
    siteConfig('COMMENT_GITALK_CLIENT_ID') ||
    siteConfig('COMMENT_WEBMENTION_ENABLE')

  const router = useRouter()
  const waiting404 = siteConfig('POST_WAITING_TIME_FOR_404') * 1000
  useEffect(() => {
    // 404
    if (!post) {
      setTimeout(
        () => {
          if (isBrowser) {
            const article = document.querySelector(
              '#article-wrapper #notion-article'
            )
            if (!article) {
              router.push('/404').then(() => {
                console.warn('找不到页面', router.asPath)
              })
            }
          }
        },
        waiting404
      )
    }
  }, [post])
  return (
    <>
      <div
        className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2 lg:py-4 `}>
        {/* 文章锁 */}
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <div className='mx-auto md:w-full md:px-5'>
            {/* 文章主体 */}
            <article
              id='article-wrapper'
              itemScope
              itemType='https://schema.org/Movie'>
              {/* Notion文章主体 */}
              <section
                className='wow fadeInUp p-5 justify-center mx-auto'
                data-wow-delay='.2s'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>

              {/* 以下内容已根据您的要求移除 */}
              {/* <PostAdjacent {...props} /> */}
              {/* <ShareBar post={post} /> */}
              {/* {post?.type === 'Post' && (
                <div className='px-5'>
                  <PostCopyright {...props} />
                  <PostRecommend {...props} />
                </div>
              )} */}
            </article>

            {/* 评论区 */}
            {fullWidth ? null : (
              <div className={`${commentEnable && post ? '' : 'hidden'}`}>
                <hr className='my-4 border-dashed' />
                {/* 评论区上方广告 */}
                <div className='py-2'>
                  <AdSlot />
                </div>
                {/* 评论互动 */}
                <div className='duration-200 overflow-x-auto px-5'>
                  <div className='text-2xl dark:text-white'>
                    <i className='fas fa-comment mr-1' />
                    {locale.COMMON.COMMENTS}
                  </div>
                  <Comment frontMatter={post} className='' />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <FloatTocButton {...props} />
    </>
  )
}

/**
 * 404
 * @param {*} props
 * @returns
 */
const Layout404 = props => {
  // const { meta, siteInfo } = props
  const { onLoading, fullWidth } = useGlobal()
  return (
    <>
      {/* 主区块 */}
      <main
        id='wrapper-outer'
        className={`flex-grow ${fullWidth ? '' : 'max-w-4xl'} w-screen mx-auto px-5`}>
        <div id='error-wrapper' className={'w-full mx-auto justify-center'}>
          <Transition
            show={!onLoading}
            appear={true}
            enter='transition ease-in-out duration-700 transform order-first'
            enterFrom='opacity-0 translate-y-16'
            enterTo='opacity-100'
            leave='transition ease-in-out duration-300 transform'
            leaveFrom='opacity-100 translate-y-0'
            leaveTo='opacity-0 -translate-y-16'
            unmount={false}>
            {/* 404卡牌 */}
            <div className='error-content flex flex-col md:flex-row w-full mt-12 h-[30rem] md:h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
              {/* 左侧动图 */}
              <LazyImage
                className='error-img h-60 md:h-full p-4'
                src={
                  'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'
                }></LazyImage>

              {/* 右侧文字 */}
              <div className='error-info flex-1 flex flex-col justify-center items-center space-y-4'>
                <h1 className='error-title font-extrabold md:text-9xl text-7xl dark:text-white'>
                  404
                </h1>
                <div className='dark:text-white'>请尝试站内搜索寻找文章</div>
                <SmartLink href='/'>
                  <button className='bg-blue-500 py-2 px-4 text-white shadow rounded-lg hover:bg-blue-600 hover:shadow-md duration-200 transition-all'>
                    回到主页
                  </button>
                </SmartLink>
              </div>
            </div>

            {/* 404页面底部显示最新文章 (已移除) */}
            {/* <div className='mt-12'>
              <LatestPostsGroup {...props} />
            </div> */}
          </Transition>
        </div>
      </main>
    </>
  )
}

/**
 * 分类列表
 * @param {*} props
 * @returns
 */
const LayoutCategoryIndex = props => {
  const { categoryOptions } = props
  const { locale } = useGlobal()

  return (
    <div id='category-outer-wrapper' className='mt-8 px-5 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>
        {locale.COMMON.CATEGORY}
      </div>
      <div
        id='category-list'
        className='duration-200 flex flex-wrap m-10 justify-center'>
        {categoryOptions?.map(category => {
          return (
            <SmartLink
              key={category.name}
              href={`/category/${category.name}`}
              passHref
              legacyBehavior>
              <div
                className={
                  'group mr-5 mb-5 flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'
                }>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />
                {category.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>
                  {category.count}
                </div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
  )
}

/**
 * 标签列表
 * @param {*} props
 * @returns
 */
const LayoutTagIndex = props => {
  const { tagOptions } = props
  const { locale } = useGlobal()

  return (
    <div id='tag-outer-wrapper' className='px-5 mt-8 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>
        {locale.COMMON.TAGS}
      </div>
      <div
        id='tag-list'
        className='duration-200 flex flex-wrap space-x-5 space-y-5 m-10 justify-center'>
        {tagOptions.map(tag => {
          return (
            <SmartLink
              key={tag.name}
              href={`/tag/${tag.name}`}
              passHref
              legacyBehavior>
              <div
                className={
                  'group flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'
                }>
                <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />
                {tag.name}
                <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>
                  {tag.count}
                </div>
              </div>
            </SmartLink>
          )
        })}
      </div>
    </div>
  )
}

export {
  Layout404,
  LayoutArchive,
  LayoutBase,
  LayoutCategoryIndex,
  LayoutIndex,
  LayoutPostList,
  LayoutSearch,
  LayoutSlug,
  LayoutTagIndex,
  CONFIG as THEME_CONFIG
}

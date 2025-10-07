/**
 *   HEO 主题说明
 *  > 主题设计者 [张洪](https://zhheo.com/)
 *  > 主题开发者 [tangly1024](https://github.com/tangly1024)
 *  1. 开启方式 在blog.config.js 将主题配置为 `HEO`
 *  2. 更多说明参考此[文档](https://docs.tangly1024.com/article/notionnext-heo)
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
import { useEffect, useState } from 'react'
import { useSwipeable } from 'react-swipeable'
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
// 新增：为门户首页引入图标
import { FaTiktok, FaFacebook, FaYoutube, FaRegNewspaper, FaBook, FaMicrophone, FaFlask } from 'react-icons/fa'

/**
 * 基础布局 (已恢复到原始状态，不再影响其他页面)
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()

  const headerSlot = (
    <header>
      <Header {...props} />
      {router.route === '/' ? (
        <>
          <NoticeBar />
          {/* Hero 现在由 LayoutIndex 自己管理，这里可以保留原始逻辑或移除 */}
          <Hero {...props} /> 
        </>
      ) : null}
      {fullWidth || props.post ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )

  const slotRight =
    router.route === '/404' || fullWidth ? null : <SideRight {...props} />

  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'
  const HEO_HERO_BODY_REVERSE = siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG)
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  useEffect(() => {
    loadWowJS()
  }, [])

  return (
    <div
      id='theme-heo'
      className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />
      {/* 首页的 Header 现在由 LayoutIndex 内部处理，避免全局影响 */}
      { router.route !== '/' && headerSlot }
      <main
        id='wrapper-outer'
        // 恢复原始布局，首页由LayoutIndex组件全权接管
        className={`flex-grow w-full ${router.route === '/' ? '' : maxWidth} mx-auto relative ${router.route === '/' ? '' : 'md:px-5'}`}>
        <div
          id='container-inner'
          className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          { router.route !== '/' && <div className='lg:px-2'></div> }
          { router.route !== '/' && <div className='hidden xl:block'>{slotRight}</div> }
        </div>
      </main>
      {/* 首页的 Footer 也由 LayoutIndex 自己管理 */}
      { router.route !== '/' && <Footer /> }
      {HEO_LOADING_COVER && <LoadingCover />}
    </div>
  )
}

/**
 * 首页 - 全新抽屉式门户设计
 */
const LayoutIndex = props => {
    // 定义标签及其对应的图标
  const tabs = [
    { name: '文章', icon: <FaRegNewspaper className='mr-2' /> },
    { name: 'HSK', icon: <FaBook className='mr-2' /> },
    { name: '口语', icon: <FaMicrophone className='mr-2' /> },
    { name: '练习', icon: <FaFlask className='mr-2' /> }
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].name);

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      setActiveTab(tabs[(currentIndex + 1) % tabs.length].name);
    },
    onSwipedRight: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      setActiveTab(tabs[(currentIndex - 1 + tabs.length) % tabs.length].name);
    },
    trackMouse: true
  });

  const renderContent = () => {
    // ... 内容渲染逻辑 ...
    switch (activeTab) {
        case '文章':
          return (
            <div className='p-4'>
              {siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}
            </div>
          );
        case 'HSK':
          return <iframe key="hsk" src="about:blank" title="HSK" style={{ width: '100%', height: '80vh', border: 'none' }} />;
        case '口语':
          return <iframe key="kouyu" src="about:blank" title="口语" style={{ width: '100%', height: '80vh', border: 'none' }} />;
        case '练习':
          return <iframe key="lianxi" src="about:blank" title="练习" style={{ width: '100%', height: '80vh', border: 'none' }} />;
        default:
          return null;
      }
  };

  return (
    // 整个页面容器，带背景图
    <div 
        className='relative w-full h-screen overflow-y-auto bg-cover bg-center' 
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=2070')" }}
    >
      {/* 顶部固定的英雄区 (占屏约30%) */}
      <div className='relative z-0 flex flex-col justify-center items-center w-full h-[35vh] p-4 text-white text-center'>
        <div className='absolute inset-0 bg-black/30'></div> {/* 半透明遮罩，让文字更清晰 */}
        <h1 className='text-4xl md:text-5xl font-extrabold z-10' style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>中缅文培训中心</h1>
        <p className='mt-2 text-lg z-10' style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>价格 & Slogan</p>
        <div className='flex space-x-4 mt-4 z-10'>
            {/* 直播小卡片 */}
            <a href="#" className='px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-2 hover:bg-white/30 transition-colors'><FaTiktok /><span className='font-semibold'>TikTok</span></a>
            <a href="#" className='px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-2 hover:bg-white/30 transition-colors'><FaFacebook /><span className='font-semibold'>Facebook</span></a>
            <a href="#" className='px-4 py-2 bg-white/20 backdrop-blur-sm rounded-lg flex items-center space-x-2 hover:bg-white/30 transition-colors'><FaYoutube /><span className='font-semibold'>YouTube</span></a>
        </div>
      </div>

      {/* "抽屉"内容区，可以向上滚动覆盖顶部 */}
      <div className='relative z-10 min-h-[65vh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl'>
        {/* 粘性分类导航 (带磨砂效果) */}
        <div className='sticky top-0 z-20 bg-white/70 dark:bg-black/50 backdrop-blur-lg rounded-t-2xl'>
          <div className='flex justify-center border-b border-gray-200 dark:border-gray-700'>
            {tabs.map(tab => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(tab.name)}
                className={`flex items-center justify-center px-4 py-4 text-lg font-semibold transition-colors duration-300 focus:outline-none whitespace-nowrap
                  ${activeTab === tab.name 
                    ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'
                  }`}
              >
                {tab.icon} {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 手势内容区 */}
        <div {...handlers} className="w-full">
            {renderContent()}
        </div>
      </div>
       {/* 页脚可以放在这里，也可以移除 */}
       {/* <Footer/> */}
    </div>
  );
};


/**
 * 博客列表 (保持不变)
 */
const LayoutPostList = props => {
  return (
    <div id='post-outer-wrapper' className='px-5  md:px-0'>
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
 * 搜索 (保持不变)
 */
const LayoutSearch = props => {
  const { keyword } = props
  const router = useRouter()
  const currentSearch = keyword || router?.query?.s

  useEffect(() => {
    if (currentSearch) {
      setTimeout(() => {
        replaceSearchResult({
          doms: document.getElementsByClassName('replace'),
          search: currentSearch,
          target: { element: 'span', className: 'text-red-500 border-b border-dashed' }
        })
      }, 100)
    }
  }, [currentSearch])
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
 * 归档 (保持不变)
 */
const LayoutArchive = props => {
  const { archivePosts } = props
  return (
    <div className='p-5 rounded-xl border dark:border-gray-600 max-w-6xl w-full bg-white dark:bg-[#1e1e1e]'>
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
 * 文章详情 (保持不变)
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
    siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL') ||
    siteConfig('COMMENT_VALINE_APP_ID') || siteConfig('COMMENT_GISCUS_REPO') ||
    siteConfig('COMMENT_CUSDIS_APP_ID') || siteConfig('COMMENT_UTTERRANCES_REPO') ||
    siteConfig('COMMENT_GITALK_CLIENT_ID') || siteConfig('COMMENT_WEBMENTION_ENABLE')

  const router = useRouter()
  useEffect(() => {
    if (!post) {
      setTimeout(() => {
        if (isBrowser) {
          const article = document.querySelector('#article-wrapper #notion-article')
          if (!article) {
            router.push('/404').then(() => console.warn('找不到页面', router.asPath))
          }
        }
      }, siteConfig('POST_WAITING_TIME_FOR_404') * 1000)
    }
  }, [post, router])

  return (
    <>
      <div
        className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2 lg:py-4 `}>
        {lock && <PostLock validPassword={validPassword} />}
        {!lock && post && (
          <div className='mx-auto md:w-full md:px-5'>
            <article id='article-wrapper' itemScope itemType='https://schema.org/Movie'>
              <section className='wow fadeInUp p-5 justify-center mx-auto' data-wow-delay='.2s'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
            </article>
            {fullWidth ? null : (
              <div className={`${commentEnable && post ? '' : 'hidden'}`}>
                <hr className='my-4 border-dashed' />
                <div className='py-2'><AdSlot /></div>
                <div className='duration-200 overflow-x-auto px-5'>
                  <div className='text-2xl dark:text-white'><i className='fas fa-comment mr-1' />{locale.COMMON.COMMENTS}</div>
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
 * 404 (保持不变)
 */
const Layout404 = () => {
  const { onLoading, fullWidth } = useGlobal()
  return (
    <main id='wrapper-outer' className={`flex-grow ${fullWidth ? '' : 'max-w-4xl'} w-screen mx-auto px-5`}>
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
          <div className='error-content flex flex-col md:flex-row w-full mt-12 h-[30rem] md:h-96 justify-center items-center bg-white dark:bg-[#1B1C20] border dark:border-gray-800 rounded-3xl'>
            <LazyImage className='error-img h-60 md:h-full p-4' src={'https://bu.dusays.com/2023/03/03/6401a7906aa4a.gif'}></LazyImage>
            <div className='error-info flex-1 flex flex-col justify-center items-center space-y-4'>
              <h1 className='error-title font-extrabold md:text-9xl text-7xl dark:text-white'>404</h1>
              <div className='dark:text-white'>请尝试站内搜索寻找文章</div>
              <SmartLink href='/'><button className='bg-blue-500 py-2 px-4 text-white shadow rounded-lg hover:bg-blue-600 hover:shadow-md duration-200 transition-all'>回到主页</button></SmartLink>
            </div>
          </div>
        </Transition>
      </div>
    </main>
  )
}

/**
 * 分类列表 (保持不变)
 */
const LayoutCategoryIndex = props => {
  const { categoryOptions } = props
  const { locale } = useGlobal()
  return (
    <div id='category-outer-wrapper' className='mt-8 px-5 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>{locale.COMMON.CATEGORY}</div>
      <div id='category-list' className='duration-200 flex flex-wrap m-10 justify-center'>
        {categoryOptions?.map(category => (
          <SmartLink key={category.name} href={`/category/${category.name}`} passHref legacyBehavior>
            <div className={'group mr-5 mb-5 flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'}>
              <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />{category.name}
              <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>{category.count}</div>
            </div>
          </SmartLink>
        ))}
      </div>
    </div>
  )
}

/**
 * 标签列表 (保持不变)
 */
const LayoutTagIndex = props => {
  const { tagOptions } = props
  const { locale } = useGlobal()
  return (
    <div id='tag-outer-wrapper' className='px-5 mt-8 md:px-0'>
      <div className='text-4xl font-extrabold dark:text-gray-200 mb-5'>{locale.COMMON.TAGS}</div>
      <div id='tag-list' className='duration-200 flex flex-wrap space-x-5 space-y-5 m-10 justify-center'>
        {tagOptions.map(tag => (
          <SmartLink key={tag.name} href={`/tag/${tag.name}`} passHref legacyBehavior>
            <div className={'group flex flex-nowrap items-center border bg-white text-2xl rounded-xl dark:hover:text-white px-4 cursor-pointer py-3 hover:text-white hover:bg-indigo-600 transition-all hover:scale-110 duration-150'}>
              <HashTag className={'w-5 h-5 stroke-gray-500 stroke-2'} />{tag.name}
              <div className='bg-[#f1f3f8] ml-1 px-2 rounded-lg group-hover:text-indigo-600 '>{tag.count}</div>
            </div>
          </SmartLink>
        ))}
      </div>
    </div>
  )
}

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
        }

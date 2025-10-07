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
import { FaTiktok, FaFacebook, FaYoutube, FaRegNewspaper, FaBook, FaMicrophone, FaFlask, FaGraduationCap } from 'react-icons/fa'
import { Menu as MenuIcon, X as XIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion';

/**
 * 基础布局 (恢复原始状态)
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  
  // 首页将由 LayoutIndex 完全接管，所以这里对首页不做任何特殊处理
  if (router.route === '/') {
    return <>{children}</>
  }
  
  const headerSlot = (
    <header>
      <Header {...props} />
      {router.route === '/' ? (<><NoticeBar /><Hero {...props} /></>) : null}
      {fullWidth || props.post ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )

  const slotRight = router.route === '/404' || fullWidth ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'
  const HEO_HERO_BODY_REVERSE = siteConfig('HEO_HERO_BODY_REVERSE', false, CONFIG)
  const HEO_LOADING_COVER = siteConfig('HEO_LOADING_COVER', true, CONFIG)

  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />
      {headerSlot}
      <main id='wrapper-outer' className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div id='container-inner' className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>{slotRight}</div>
        </div>
      </main>
      <Footer />
      {HEO_LOADING_COVER && <LoadingCover />}
    </div>
  )
}

// 首页专用的简化 Header
const HomePageHeader = ({ onMenuClick }) => {
    return (
        <header className='fixed top-0 left-0 z-50 p-4'>
            <button onClick={onMenuClick} className='p-2 rounded-full bg-black/20 backdrop-blur-md hover:bg-black/30 text-white transition-colors'>
                <MenuIcon size={24}/>
            </button>
        </header>
    );
};

// 首页专用的底部导航栏
const BottomNavBar = () => {
    const navItems = [
        { href: '/', icon: 'fas fa-home', label: '主页'},
        { href: '/ai-assistant', icon: 'fas fa-robot', label: 'AI助手'},
        { href: '/community', icon: 'fas fa-users', label: '社区'},
        { href: '/messages', icon: 'fas fa-comment-dots', label: '消息'},
        { href: '/profile', icon: 'fas fa-user', label: '我'},
    ];
    const router = useRouter();

    return (
        <nav className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 flex justify-around items-center'>
            {navItems.map(item => (
                <SmartLink key={item.href} href={item.href} className='flex flex-col items-center justify-center w-1/5'>
                    <i className={`${item.icon} text-xl ${router.pathname === item.href ? 'text-blue-500' : 'text-gray-500'}`}></i>
                    <span className={`text-xs mt-1 ${router.pathname === item.href ? 'text-blue-500' : 'text-gray-500'}`}>{item.label}</span>
                </SmartLink>
            ))}
        </nav>
    );
};

/**
 * 首页 - 最终修复版
 */
const LayoutIndex = props => {
  const tabs = [
    { name: '文章', icon: <FaRegNewspaper size={28} /> },
    { name: 'HSK', icon: <FaGraduationCap size={28} /> },
    { name: '口语', icon: <FaMicrophone size={28} /> },
    { name: '练习', icon: <FaFlask size={28} /> },
    { name: '书籍', icon: <FaBook size={28} /> }
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].name);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [backgroundUrl, setBackgroundUrl] = useState('');

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1434725039720-aaad6dd32dfe?auto=format&fit=crop&q=80&w=1942',
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  }, []);

  const contentSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].name);
    },
    onSwipedRight: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].name);
    },
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
    delta: 50 // 调整回50，避免过于灵敏导致和侧滑栏手势冲突
  });

  const sidebarSwipeHandlers = useSwipeable({
      onSwipedRight: () => setIsSidebarOpen(true),
      trackMouse: true,
      delta: 80 // 侧滑栏需要更大的滑动距离才触发，避免误操作
  });

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-white dark:bg-black flex flex-col overflow-hidden`}>
        <Style/>
        
        {/* --- 侧边栏 --- */}
        <AnimatePresence>
            {isSidebarOpen && (
                <>
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className='fixed inset-0 bg-black/50 z-[99]'
                    />
                    <motion.div
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className='fixed top-0 left-0 h-full w-2/3 max-w-sm bg-white/70 dark:bg-black/70 backdrop-blur-xl shadow-2xl z-[100]'
                    >
                        <div className='p-4 h-full'>
                            <button onClick={() => setIsSidebarOpen(false)} className='absolute top-4 right-4 p-2 text-gray-600 dark:text-gray-300'><XIcon/></button>
                            <h2 className='text-2xl font-bold mt-12 dark:text-white'>设置</h2>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* --- 页面主体 --- */}
        <div className='relative flex-grow w-full h-full overflow-hidden' {...sidebarSwipeHandlers}>
            <HomePageHeader onMenuClick={() => setIsSidebarOpen(true)} />

            {/* --- 滚动容器 --- */}
            {/* [修复] 添加 overscroll-behavior-y: contain; 阻止滚动穿透 */}
            <div className='relative h-full w-full overflow-y-auto overscroll-behavior-y-contain'>
                {/* 背景层 (固定) */}
                <div className='absolute top-0 left-0 right-0 h-[45vh] z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />

                {/* 空白占位，将内容推到英雄区下方 */}
                <div className='h-[45vh] flex flex-col justify-end p-4 text-white'>
                    <h1 className='text-4xl font-extrabold' style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>中缅文培训中心</h1>
                    <p className='mt-2 text-lg w-full md:w-2/3' style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                </div>

                {/* "抽屉"内容区 */}
                <div className='relative z-10 bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-16'>
                    {/* [修复] 卡片布局现在是"抽屉"的一部分，会随之滚动 */}
                    <div className='p-4 -mt-16'>
                        <div className='grid grid-cols-2 grid-rows-2 gap-4 h-40'>
                            <a href="#" className='row-span-1 col-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80')"}}>
                                <div className='absolute inset-0 bg-black/30 flex items-center justify-center text-white'><FaTiktok size={32}/></div>
                            </a>
                            <a href="#" className='row-start-2 col-start-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('https://images.unsplash.com/photo-1633675254053-f72b6383b160?w=800&q=80')"}}>
                                <div className='absolute inset-0 bg-black/30 flex items-center justify-center text-white'><FaFacebook size={32}/></div>
                            </a>
                            <div className='row-span-2 col-start-2 rounded-xl overflow-hidden bg-black'>
                                <iframe width="100%" height="100%" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" title="YouTube video player" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                            </div>
                        </div>
                    </div>
                    
                    <div className='sticky top-0 z-20 bg-white/80 dark:bg-black/70 backdrop-blur-lg'>
                        <div className='flex justify-around border-b border-gray-200 dark:border-gray-700'>
                            {tabs.map(tab => (
                            <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex flex-col items-center justify-center w-1/5 pt-3 pb-2 transition-colors duration-300 focus:outline-none ${activeTab === tab.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'}`}>
                                {tab.icon}
                                <span className='text-sm font-semibold mt-1'>{tab.name}</span>
                                <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.name ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                            </button>
                            ))}
                        </div>
                    </div>

                    {/* [修复] 添加 overscroll-behavior-x: contain; 阻止浏览器侧滑手势 */}
                    <main {...contentSwipeHandlers} className="overflow-hidden overscroll-behavior-x-contain">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeTab} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}>
                                {activeTab === '文章' && <div className='p-4 bg-white dark:bg-gray-900'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
                                {activeTab === 'HSK' && <iframe key="hsk" src="about:blank" title="HSK" className="w-full h-[calc(100vh-210px)] border-none"/>}
                                {activeTab === '口语' && <iframe key="kouyu" src="about:blank" title="口语" className="w-full h-[calc(100vh-210px)] border-none"/>}
                                {activeTab === '练习' && <iframe key="lianxi" src="about:blank" title="练习" className="w-full h-[calc(100vh-210px)] border-none"/>}
                                {activeTab === '书籍' && <iframe key="shuji" src="about:blank" title="书籍" className="w-full h-[calc(100vh-210px)] border-none"/>}
                            </motion.div>
                        </AnimatePresence>
                    </main>
                </div>
            </div>
            <BottomNavBar/>
        </div>
    </div>
  );
};

// =========================================================================
// =============  ✅ 所有其他组件完整恢复如下  ✅ ===================
// =========================================================================

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

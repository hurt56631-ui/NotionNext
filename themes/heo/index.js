/**
 *   HEO 主题说明 - 最终修复版 v2
 *  - 恢复所有被省略的组件代码，确保功能完整。
 *  - AI 助手页面不再需要登录。
 *  - 修复手势在 iframe 上失效的问题 (采用
 明捕获层方案)。
 *  - 美化直播卡片，增加 LIVE 标签和背景图。
 *  - 优化 "贴吧式" 两层滚动。
 *  - [新增] 实现 Telegram 风格的“跟手”拖动侧边栏动画。
 *  - [新增] 修复手势捕获层导致文章无法点击和页面无法滚动的问题。
 *  - [新增] 优化直播卡片图标样式，使其更小巧并放置在右下角。
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
import { useEffect, useState, useRef } from 'react'
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
import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })

/**
 * 基础布局
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  
  if (router.route === '/') { return <>{children}</> }
  
  const headerSlot = (
    <header>
      <Header {...props} />
      {router.route === '/' ? (<><NoticeBar /><Hero {...props} /></>) : null}
      {fullWidth || props.post ? null : <PostHeader {...props} isDarkMode={isDarkMode} />}
    </header>
  )

  const slotRight = router.route === '/404' || fullWidth ? null : <SideRight {...props} />
  const maxWidth = fullWidth ? 'max-w-[96rem] mx-auto' : 'max-w-[86rem]'
  
  useEffect(() => { loadWowJS() }, [])

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} bg-[#f7f9fe] dark:bg-[#18171d] h-full min-h-screen flex flex-col scroll-smooth`}>
      <Style />
      {headerSlot}
      <main id='wrapper-outer' className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div id='container-inner' className='w-full mx-auto lg:flex justify-center relative z-10'>
          <div className={`w-full h-auto ${className || ''}`}>{slotTop}{children}</div>
          <div className='lg:px-2'></div>
          <div className='hidden xl:block'>{slotRight}</div>
        </div>
      </main>
      <Footer />
      {siteConfig('HEO_LOADING_COVER', true, CONFIG) && <LoadingCover />}
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
        { href: '/', icon: 'fas fa-home', label: '主页', auth: false },
        { href: '/ai-assistant', icon: 'fas fa-robot', label: 'AI助手', auth: false },
        { href: '/community', icon: 'fas fa-users', label: '社区', auth: true },
        { href: '/messages', icon: 'fas fa-comment-dots', label: '消息', auth: true },
        { href: '/profile', icon: 'fas fa-user', label: '我', auth: true },
    ];
    const router = useRouter();
    const { user, authLoading } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleLinkClick = (e, item) => {
        if (item.auth && !authLoading && !user) {
            e.preventDefault();
            setShowLoginModal(true);
        }
    };

    return (
        <>
            <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
            <nav className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 flex justify-around items-center'>
                {navItems.map(item => (
                    <SmartLink key={item.href} href={item.href} onClick={(e) => handleLinkClick(e, item)} className={`flex flex-col items-center justify-center w-1/5 ${authLoading && item.auth ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <i className={`${item.icon} text-xl ${router.pathname === item.href ? 'text-blue-500' : 'text-gray-500'}`}></i>
                        <span className={`text-xs mt-1 ${router.pathname === item.href ? 'text-blue-500' : 'text-gray-500'}`}>{item.label}</span>
                    </SmartLink>
                ))}
            </nav>
        </>
    );
};

// 纤细滚动条样式
const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
    `}</style>
);

/**
 * 首页 - "真·贴吧式"滚动最终修复版
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

  // --- 跟手侧边栏状态 ---
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const sidebarRef = useRef(null);

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1506748686214-e9df14d4d9d0?auto=format&fit=crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=2070'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);
  }, []);
  
  // --- 手势处理逻辑 ---
  // 内容区域左右滑动切换 Tab (已修复滚动冲突)
  const contentSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].name);
    },
    onSwipedRight: () => {
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].name);
    },
    onSwiping: (e) => {
      // 关键修复：只在水平滑动时阻止默认事件，允许垂直滚动
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.event.preventDefault();
      }
    },
    preventDefaultTouchmoveEvent: false, // 允许页面垂直滚动
    trackMouse: true,
    delta: 40
  });

  // 侧边栏拖动 (Telegram 风格)
  const sidebarSwipeHandlers = useSwipeable({
      onSwiping: (e) => {
        // 从屏幕左侧 25% 范围内向右拖动时触发
        if (e.initial[0] < window.innerWidth * 0.25 && e.deltaX > 0 && !isSidebarOpen) {
          setIsDragging(true);
          const sidebarWidth = sidebarRef.current ? sidebarRef.current.offsetWidth : 0;
          // 限制最大拖动距离
          setDragX(Math.min(e.deltaX, sidebarWidth));
        }
      },
      onSwiped: (e) => {
        if (isDragging) {
            const sidebarWidth = sidebarRef.current ? sidebarRef.current.offsetWidth : 0;
            // 如果拖动超过侧边栏宽度的 1/3，则打开
            if (e.deltaX > sidebarWidth / 3) {
                setIsSidebarOpen(true);
            }
        }
        setIsDragging(false);
        setDragX(0);
      },
      onSwipedLeft: () => {
        // 在侧边栏打开时，向左滑动可关闭
        if (isSidebarOpen) {
            setIsSidebarOpen(false);
        }
      },
      trackMouse: true
  });
  
  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-white dark:bg-black flex flex-col overflow-hidden`} {...sidebarSwipeHandlers}>
        <Style/>
        <CustomScrollbarStyle />
        
        <AnimatePresence>
            {(isSidebarOpen || isDragging) && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ 
                        opacity: 1,
                        // 根据拖动距离实时改变背景透明度
                        backgroundColor: isDragging
                            ? `rgba(0,0,0,${Math.min((dragX / (sidebarRef.current?.offsetWidth || 1)) * 0.5, 0.5)})`
                            : 'rgba(0,0,0,0.5)'
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    onClick={() => setIsSidebarOpen(false)} 
                    className='fixed inset-0 z-[99]' 
                />
            )}
        </AnimatePresence>
            
        <motion.div
            ref={sidebarRef}
            className='fixed top-0 left-0 h-full w-2/3 max-w-sm bg-white/70 dark:bg-black/70 backdrop-blur-xl shadow-2xl z-[100]'
            // 最终状态由 isSidebarOpen 决定
            animate={{ x: isSidebarOpen ? 0 : '-100%' }}
            // 拖动时，位置由 style 实时控制
            style={{ x: isDragging ? `calc(-100% + ${dragX}px)` : undefined }}
            // 拖动时无动画，松手后执行弹簧动画
            transition={{ type: isDragging ? 'tween' : 'spring', stiffness: 300, damping: 30, duration: isDragging ? 0 : undefined }}
        >
            <div className='p-4 h-full'>
                <button onClick={() => setIsSidebarOpen(false)} className='absolute top-4 right-4 p-2 text-gray-600 dark:text-gray-300'><XIcon/></button>
                <h2 className='text-2xl font-bold mt-12 dark:text-white'>设置</h2>
            </div>
        </motion.div>
        
        <div className='relative flex-grow w-full h-full'>
            <HomePageHeader onMenuClick={() => setIsSidebarOpen(true)} />

            <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />

            <div className='absolute top-0 left-0 right-0 h-[45vh] z-10 p-4 flex flex-col justify-end text-white pointer-events-none'>
                <div className='pointer-events-auto'>
                    <h1 className='text-4xl font-extrabold' style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>中缅文培训中心</h1>
                    <p className='mt-2 text-lg w-full md:w-2/3' style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                    <div className='mt-4 grid grid-cols-3 grid-rows-2 gap-2 h-40'>
                        {/* -- 直播卡片样式优化 -- */}
                        <a href="#" className='col-span-1 row-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('/img/tiktok.jpg')"}}>
                           <div className='absolute top-1.5 left-1.5 bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded'>LIVE</div>
                           <div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'>
                                <FaTiktok size={20}/>
                                <span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span>
                           </div>
                        </a>
                         <a href="#" className='col-span-1 row-start-2 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('/img/facebook.jpg')"}}>
                            <div className='absolute top-1.5 left-1.5 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded'>LIVE</div>
                            <div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'>
                                <FaFacebook size={20}/>
                                <span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span>
                           </div>
                        </a>
                        <div className='col-span-2 col-start-2 row-span-2 rounded-xl overflow-hidden bg-black'>
                            <iframe width="100%" height="100%" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe>
                        </div>
                    </div>
                </div>
            </div>

            <div className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[45vh]' />
                <div className='relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-16 min-h-[calc(55vh+1px)]'>
                    <div className='sticky top-0 z-30 bg-white/80 dark:bg-black/70 backdrop-blur-lg rounded-t-2xl'>
                        <div className='flex justify-around border-b border-gray-200 dark:border-gray-700'>
                            {tabs.map(tab => (
                            <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex flex-col items-center justify-center w-1/5 pt-3 pb-2 transition-colors duration-300 focus:outline-none ${activeTab === tab.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                {tab.icon}
                                <span className='text-sm font-semibold mt-1'>{tab.name}</span>
                                <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.name ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                            </button>
                            ))}
                        </div>
                    </div>

                    {/* -- 修复手势区域 -- */}
                    <main className="overscroll-x-contain" {...contentSwipeHandlers}>
                        {tabs.map(tab => (
                            <div key={tab.name} className={`${activeTab === tab.name ? 'block' : 'hidden'}`}>
                                {/* 移除了阻挡点击的遮罩层，手势已绑定到父级 <main> 元素 */}
                                <div>
                                    {tab.name === '文章' && <div className='p-4'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
                                    {tab.name === 'HSK' && <iframe src="about:blank" title="HSK" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {tab.name === '口语' && <iframe src="about:blank" title="口语" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {tab.name === '练习' && <iframe src="about:blank" title="练习" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {tab.name === '书籍' && <iframe src="about:blank" title="书籍" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                </div>
                            </div>
                        ))}
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
      <div id='post-outer-wrapper' className='px-5 md:px-0'>
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

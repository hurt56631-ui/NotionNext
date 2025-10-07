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
// 新增：为门户首页引入更多图标
import { FaTiktok, FaFacebook, FaYoutube, FaRegNewspaper, FaBook, FaMicrophone, FaFlask, FaGraduationCap } from 'react-icons/fa'
import { Menu as MenuIcon, X as XIcon } from 'lucide-react'
// 为动画引入 framer-motion
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
      {router.route === '/' ? (
        <>
          <NoticeBar />
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
      {headerSlot}
      <main
        id='wrapper-outer'
        className={`flex-grow w-full ${maxWidth} mx-auto relative md:px-5`}>
        <div
          id='container-inner'
          className={`${HEO_HERO_BODY_REVERSE ? 'flex-row-reverse' : ''} w-full mx-auto lg:flex justify-center relative z-10`}>
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

// 首页专用的简化 Header，只包含菜单按钮
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
    // 您可以根据需要修改这里的链接和图标
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
 * 首页 - 最终版：两层滚动、侧边栏、随机背景
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

  // --- 随机背景图 ---
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

  // --- 手势处理 ---
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
    delta: 30
  });

  const sidebarSwipeHandlers = useSwipeable({
      onSwipedRight: () => setIsSidebarOpen(true),
      trackMouse: true,
      delta: 50
  });

  const renderContent = () => { /* ... */ }; // (已在 JSX 中内联)

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen fixed`}>
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
                            {/* 在这里放置您的设置项 */}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* --- 页面主体 (手势区域) --- */}
        <div {...sidebarSwipeHandlers} className='h-full w-full'>
            <HomePageHeader onMenuClick={() => setIsSidebarOpen(true)} />

            {/* --- 两层滚动容器 --- */}
            <div className='relative h-full w-full'>
                {/* 背景层 (固定) */}
                <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />

                {/* 内容层 (可滚动) */}
                <div className='absolute inset-0 z-10 overflow-y-auto'>
                    
                    {/* 1. 顶部英雄区 (占位，高度由内容决定) */}
                    <div className='h-[45vh] pt-20 pb-8 px-4 flex flex-col justify-end text-white'>
                        <h1 className='text-4xl font-extrabold' style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>中缅文培训中心</h1>
                        <p className='mt-2 text-lg w-full md:w-2/3' style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                        
                        <div className='mt-4 grid grid-cols-3 gap-4 h-32'>
                            <a href="#" className='col-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=80')"}}>
                                <div className='absolute inset-0 bg-black/30 flex items-center justify-center'><FaTiktok size={32}/></div>
                            </a>
                            <a href="#" className='col-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('https://images.unsplash.com/photo-1633675254053-f72b6383b160?w=800&q=80')"}}>
                                <div className='absolute inset-0 bg-black/30 flex items-center justify-center'><FaFacebook size={32}/></div>
                            </a>
                            <div className='col-span-1 rounded-xl overflow-hidden bg-black'>
                                <iframe 
                                    width="100%" height="100%" 
                                    src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" // 示例YouTube链接，请替换
                                    title="YouTube video player" 
                                    frameBorder="0" 
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                    allowFullScreen>
                                </iframe>
                            </div>
                        </div>
                    </div>

                    {/* 2. "抽屉"内容区 */}
                    <div className='relative min-h-[55vh] bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-16'> {/* pb-16 为底部导航栏留出空间 */}
                        <div className='sticky top-0 z-20 bg-white/80 dark:bg-black/70 backdrop-blur-lg rounded-t-2xl'>
                            <div className='flex justify-around border-b border-gray-200 dark:border-gray-700'>
                                {tabs.map(tab => (
                                <button
                                    key={tab.name}
                                    onClick={() => setActiveTab(tab.name)}
                                    className={`flex flex-col items-center justify-center w-1/5 pt-3 pb-2 transition-colors duration-300 focus:outline-none
                                    ${activeTab === tab.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500' }`}
                                >
                                    {tab.icon}
                                    <span className='text-sm font-semibold mt-1'>{tab.name}</span>
                                    <div className={`w-8 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.name ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                                </button>
                                ))}
                            </div>
                        </div>
                        <main {...contentSwipeHandlers} className="overflow-hidden">
                            <AnimatePresence mode="wait">
                                <motion.div key={activeTab} initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.2}}>
                                    {/* --- 内容渲染 --- */}
                                    {activeTab === '文章' && <div className='p-4 bg-white dark:bg-gray-900'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
                                    {activeTab === 'HSK' && <iframe key="hsk" src="about:blank" title="HSK" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {activeTab === '口语' && <iframe key="kouyu" src="about:blank" title="口语" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {activeTab === '练习' && <iframe key="lianxi" src="about:blank" title="练习" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                    {activeTab === '书籍' && <iframe key="shuji" src="about:blank" title="书籍" className="w-full h-[calc(100vh-150px)] border-none"/>}
                                </motion.div>
                            </AnimatePresence>
                        </main>
                    </div>
                </div>
            </div>
            <BottomNavBar/>
        </div>
    </div>
  );
};


// (其他组件 LayoutPostList, LayoutSearch, etc. 保持不变)
// ... (此处省略未修改的组件代码，请保留您文件中的原始代码)
const LayoutPostList = props => { /* ... */ };
const LayoutSearch = props => { /* ... */ };
const LayoutArchive = props => { /* ... */ };
const LayoutSlug = props => { /* ... */ };
const Layout404 = () => { /* ... */ };
const LayoutCategoryIndex = props => { /* ... */ };
const LayoutTagIndex = props => { /* ... */ };

export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}

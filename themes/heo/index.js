// themes/heo/index.js  <-- 最终修复版：恢复分类手势 & 实现高级拖拽侧边栏 & 升级快捷按钮 & 精确移除页面顶部空白

// 保持您原始文件的所有 import 语句不变
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
import { useEffect, useState, useRef, useCallback } from 'react'
import { useSwipeable } from 'react-swipeable' // ✅ 重新导入 useSwipeable

// 依赖于您项目中的 themes/heo/components/ 文件夹
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
import { FaTiktok, FaFacebook } from 'react-icons/fa'
import {
    Newspaper,
    GraduationCap,
    ClipboardCheck,
    BookOpen,
    Phone,
    MessageSquare,
    Users,
    Settings,
    LifeBuoy,
    Moon,
    Sun,
    UserCircle,
    Mic,
    BookUser,
    Video,
    Info
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'

// ✅ 导入我们所有新创建的内容块组件
import HskContentBlock from '@/components/HskPageClient'
import SpeakingContentBlock from '@/components/SpeakingContentBlock'
import PracticeContentBlock from '@/components/PracticeContentBlock'
import BooksContentBlock from '@/components/BooksContentBlock'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })
const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })


// =================================================================================
// ====================== ✅ 重写：高级拖拽侧边栏组件 ✅ ========================
// =================================================================================
const HomeSidebar = ({ isOpen, onClose, sidebarX, isDragging }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  const sidebarWidth = 288; // 侧边栏宽度 (w-72)

  const sidebarLinks = [
    { icon: <Settings size={20} />, text: '通用设置', href: '/settings' },
    { icon: <LifeBuoy size={20} />, text: '帮助中心', href: '/help' },
  ];

  // 在拖拽时禁用CSS过渡动画，以确保平滑跟随；松手后启用动画，实现吸附效果
  const transitionClass = isDragging ? '' : 'transition-transform duration-300 ease-in-out';

  return (
    <>
      {/* 遮罩层 (实现拖拽时透明度渐变) */}
      <div
        className={`fixed inset-0 bg-black z-30 transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        style={{ opacity: isOpen ? 0.5 : (sidebarX + sidebarWidth) / sidebarWidth * 0.5 }}
      />
      {/* 侧边栏内容 */}
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl z-40 transform ${transitionClass}`}
        style={{ transform: `translateX(${sidebarX}px)` }} // ✅ 核心：通过transform实时更新位置
      >
        <div className="flex flex-col h-full">
            {/* 顶部用户信息 */}
            <div className="p-6 flex items-center gap-4 border-b dark:border-gray-700">
                <UserCircle size={48} className="text-gray-500" />
                <div>
                    <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">访客</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">欢迎来到本站</p>
                </div>
            </div>
            {/* 导航链接 */}
            <nav className="flex-grow p-4 space-y-2">
                {sidebarLinks.map((link, index) => (
                    <SmartLink key={index} href={link.href} className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                        {link.icon}
                        <span className="font-medium">{link.text}</span>
                    </SmartLink>
                ))}
            </nav>
            {/* 底部操作 */}
            <div className="p-4 border-t dark:border-gray-700">
                <button
                    onClick={toggleDarkMode}
                    className="w-full flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors"
                >
                    {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    <span className="font-medium">{isDarkMode ? '切换到日间模式' : '切换到夜间模式'}</span>
                </button>
            </div>
        </div>
      </div>
    </>
  );
};


/**
 * 基础布局 (保持不变)
 */
const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()

  if (router.route === '/') { return <>{children}</> }

  const headerSlot = (
    <header>
      <Header {...props} />
      {/* [关键修复] 恢复了旧代码的正确逻辑, PostHeader (白色区域) 现在只会在文章页显示 */}
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

// 纤细滚动条样式 (保持不变)
const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
    `}</style>
);

// =================================================================================
// ====================== ✅ 重写：快捷操作按钮组件 ✅ ========================
// =================================================================================
const ActionButtons = () => {
  const actions = [
    { icon: <Phone size={24} />, text: '联系我们', href: 'tel:YOUR_PHONE_NUMBER', color: 'from-blue-500 to-sky-500' },
    { icon: <MessageSquare size={24} />, text: '在线客服', href: '#', color: 'from-green-500 to-emerald-500' },
    { icon: <Users size={24} />, text: '加入社群', href: '#', color: 'from-purple-500 to-indigo-500' },
    { icon: <BookUser size={24} />, text: '预约课程', href: '#', color: 'from-orange-500 to-amber-500' },
    { icon: <Video size={24} />, text: '视频教程', href: '#', color: 'from-red-500 to-rose-500' },
    { icon: <Info size={24} />, text: '关于我们', href: '#', color: 'from-gray-500 to-slate-500' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 my-6 px-4">
      {actions.map((action, index) => (
        <a key={index} href={action.href} className={`flex flex-col items-center justify-center p-4 rounded-xl shadow-lg hover:shadow-xl text-white bg-gradient-to-br ${action.color} transition-all duration-300 transform hover:-translate-y-1`}>
          <div className="mb-2">{action.icon}</div>
          <span className="text-sm font-semibold">{action.text}</span>
        </a>
      ))}
    </div>
  );
};


/**
 * 首页 - 终极融合版 (已重写)
 */
const LayoutIndex = props => {
  const tabs = [
    { name: '文章', icon: <Newspaper size={22} /> },
    { name: 'HSK', icon: <GraduationCap size={22} /> },
    { name: '口语', icon: <Mic size={22} /> },
    { name: '练习', icon: <ClipboardCheck size={22} /> },
    { name: '书籍', icon: <BookOpen size={22} /> }
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].name);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  const [isCategoryBarSticky, setIsCategoryBarSticky] = useState(false);
  const sentinelRef = useRef(null);
  
  // ===== ✅ 高级拖拽侧边栏 State 和 Refs =====
  const sidebarWidth = 288;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(null);
  const currentSidebarX = useRef(-sidebarWidth);

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto-format&fit-crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto-format&fit-crop&q=80&w=2070'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    const observer = new IntersectionObserver(
        ([entry]) => setIsCategoryBarSticky(!entry.isIntersecting),
        { root: null, threshold: 1.0, rootMargin: '-1px 0px 0px 0px' }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) observer.observe(currentSentinel);
    return () => { if (currentSentinel) observer.unobserve(currentSentinel); };
  }, []);

  // ===== ✅ 高级拖拽侧边栏事件处理函数 =====
  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX;
    // 边缘检测：只在屏幕最左侧 50px 内（手势拉出）或侧边栏已打开时（手势关闭）才启动拖拽
    if ((!isSidebarOpen && startX > 50)) return;

    touchStartX.current = startX;
    currentSidebarX.current = sidebarX;
    setIsDragging(true); // 开始拖拽，禁用CSS动画
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX.current;

    let newX = currentSidebarX.current + deltaX;
    newX = Math.max(-sidebarWidth, Math.min(newX, 0)); // 限制拖拽范围在 [-sidebarWidth, 0] 之间
    setSidebarX(newX);
  };

  const handleTouchEnd = () => {
    if (!isDragging || touchStartX.current === null) return;
    setIsDragging(false); // 结束拖拽，启用CSS动画
    touchStartX.current = null;

    // 根据最后的位置决定是打开还是关闭
    if (sidebarX < -sidebarWidth / 2) { // 如果拉出不足一半，则收回
        closeSidebar();
    } else { // 否则，完全打开
        openSidebar();
    }
  };

  // ===== ✅ 恢复分类切换手势处理器 =====
  const contentSwipeHandlers = useSwipeable({
      onSwipedLeft: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex < tabs.length - 1) {
              setActiveTab(tabs[currentIndex + 1].name);
          }
      },
      onSwipedRight: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex > 0) {
              setActiveTab(tabs[currentIndex - 1].name);
          }
      },
      // 关键修复：当分类栏未吸顶或正在拖动侧边栏时，禁用此滑动
      disabled: !isCategoryBarSticky || isDragging,
      preventDefaultTouchmoveEvent: true,
      trackMouse: true,
      delta: 50
  });

  // 控制侧边栏打开/关闭的函数
  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };

  const PostListComponent = siteConfig('POST_LIST_STYLE') === 'page' ? BlogPostListPage : BlogPostListScroll;

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/>
        <CustomScrollbarStyle />
        
        <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} isDragging={isDragging} />

        {/* 将拖拽事件绑定到主内容容器上 */}
        <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className='relative flex-grow w-full h-full'
        >
            <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/20'></div>

            <button
                onClick={openSidebar}
                className="absolute top-4 left-4 z-30 p-2 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors"
                aria-label="打开菜单"
            >
                <i className="fas fa-bars text-xl"></i>
            </button>
            
            <div className='absolute top-0 left-0 right-0 h-[45vh] z-10 p-4 flex flex-col justify-end text-white pointer-events-none'>
                <div className='pointer-events-auto'>
                    <h1 className='text-4xl font-extrabold' style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.7)' }}>中缅文培训中心</h1>
                    <p className='mt-2 text-lg w-full md:w-2/3' style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.7)' }}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                    <div className='mt-4 grid grid-cols-3 grid-rows-2 gap-2 h-40'>
                        <a href="#" className='col-span-1 row-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/tiktok.jpg')" }}><div className='absolute top-1 left-1 bg-pink-500 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaTiktok size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <a href="#" className='col-span-1 row-start-2 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/facebook.jpg')" }}><div className='absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaFacebook size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <div className='col-span-2 col-start-2 row-span-2 rounded-xl overflow-hidden bg-black'><iframe width="100%" height="100%" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
                    </div>
                </div>
            </div>

            <div className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div ref={sentinelRef} className='h-[45vh] flex-shrink-0' />
                <div className='relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-t-2xl shadow-2xl pb-24 min-h-[calc(55vh+1px)]'>
                    <div className='p-4 pt-6'><GlosbeSearchCard /><ActionButtons /></div>

                    <div className='sticky top-0 z-30 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-b border-t border-gray-200 dark:border-gray-700'>
                        <div className='flex justify-around'>
                            {tabs.map(tab => (
                            <button key={tab.name} onClick={() => setActiveTab(tab.name)} className={`flex flex-col items-center justify-center w-1/5 pt-2.5 pb-1.5 transition-colors duration-300 focus:outline-none ${activeTab === tab.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
                                {tab.icon}
                                <span className='text-xs font-semibold mt-1'>{tab.name}</span>
                                <div className={`w-6 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.name ? 'bg-blue-500' : 'bg-transparent'}`}></div>
                            </button>
                            ))}
                        </div>
                    </div>
                    
                    {/* ✅ 将分类滑动手势绑定到 main 元素上 */}
                    <main className="min-h-[70vh]" {...contentSwipeHandlers}>
                        {tabs.map(tab => (
                            <div key={tab.name} className={`${activeTab === tab.name ? 'block' : 'hidden'}`}>
                                <div className='p-4'>
                                    {tab.name === '文章' && <PostListComponent {...props} />}
                                    {tab.name === 'HSK' && <HskContentBlock />}
                                    {tab.name === '口语' && <SpeakingContentBlock />}
                                    {tab.name === '练习' && <PracticeContentBlock />}
                                    {tab.name === '书籍' && <BooksContentBlock />}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
            {/* ✅ 关键修复：使用全局的 Footer 组件来显示底部导航，确保逻辑统一 */}
            <Footer />
        </div>
    </div>
  );
};


// =========================================================================
// =============  ✅ 所有其他组件恢复为您的原始结构 ✅ ===================
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

// 最终修复：保持您原始文件的聚合导出结构
export {
  Layout404, LayoutArchive, LayoutBase, LayoutCategoryIndex, LayoutIndex,
  LayoutPostList, LayoutSearch, LayoutSlug, LayoutTagIndex, CONFIG as THEME_CONFIG
}

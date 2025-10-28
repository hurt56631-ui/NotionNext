// themes/heo/index.js  <-- 最终修复完整版：已重构吸顶结构、优化颜色与间距

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
import { useSwipeable } from 'react-swipeable'

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
    Heart,
    List,
    BookText
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
const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false })
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })


// =================================================================================
// ====================== ✅ 高级拖拽侧边栏组件 (保持不变) ✅ ========================
// =================================================================================
const HomeSidebar = ({ isOpen, onClose, sidebarX, isDragging }) => {
  const { isDarkMode, toggleDarkMode } = useGlobal();
  const sidebarWidth = 288;

  const sidebarLinks = [
    { icon: <Settings size={20} />, text: '通用设置', href: '/settings' },
    { icon: <LifeBuoy size={20} />, text: '帮助中心', href: '/help' },
  ];

  const transitionClass = isDragging ? '' : 'transition-transform duration-300 ease-in-out';

  return (
    <>
      <div
        className={`fixed inset-0 bg-black z-30 transition-opacity duration-300 ${isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
        style={{ opacity: isOpen ? 0.5 : (sidebarX + sidebarWidth) / sidebarWidth * 0.5 }}
      />
      <div
        className={`fixed inset-y-0 left-0 w-72 bg-white/95 dark:bg-gray-900/95 backdrop-blur-lg shadow-2xl z-40 transform ${transitionClass}`}
        style={{ transform: `translateX(${sidebarX}px)` }}
      >
        <div className="flex flex-col h-full">
            <div className="p-6 flex items-center gap-4 border-b dark:border-gray-700">
                <UserCircle size={48} className="text-gray-500" />
                <div>
                    <p className="font-semibold text-lg text-gray-800 dark:text-gray-100">访客</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">欢迎来到本站</p>
                </div>
            </div>
            <nav className="flex-grow p-4 space-y-2">
                {sidebarLinks.map((link, index) => (
                    <SmartLink key={index} href={link.href} className="flex items-center gap-4 px-4 py-3 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-700/60 transition-colors">
                        {link.icon}
                        <span className="font-medium">{link.text}</span>
                    </SmartLink>
                ))}
            </nav>
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

// 纤细滚动条样式
const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
    `}</style>
);


// =================================================================================
// ====================== 主页专用的底部导航栏 (保持不变) ========================
// =================================================================================
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

// =================================================================================
// ====================== 快捷操作按钮组件 (保持不变) ========================
// =================================================================================
const ActionButtons = ({ onOpenFavorites }) => {
  const actions = [
    { icon: <Phone size={24} />, text: '联系我们', type: 'link', href: 'tel:YOUR_PHONE_NUMBER', color: 'from-blue-500 to-sky-500' },
    { icon: <MessageSquare size={24} />, text: '在线客服', type: 'link', href: '#', color: 'from-green-500 to-emerald-500' },
    { icon: <Users size={24} />, text: '加入社群', type: 'link', href: '#', color: 'from-purple-500 to-indigo-500' },
    { icon: <Heart size={24} />, text: '收藏单词', type: 'words', color: 'from-orange-500 to-amber-500' },
    { icon: <List size={24} />, text: '收藏短句', type: 'sentences', color: 'from-red-500 to-rose-500' },
    { icon: <BookText size={24} />, text: '收藏语法', type: 'grammar', color: 'from-gray-500 to-slate-500' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 mb-6 px-4">
      {actions.map((action, index) => {
        const content = (
          <>
            <div className="mb-2">{action.icon}</div>
            <span className="text-sm font-semibold">{action.text}</span>
          </>
        );
        const className = `flex flex-col items-center justify-center p-4 rounded-xl shadow-lg hover:shadow-xl text-white bg-gradient-to-br ${action.color} transition-all duration-300 transform hover:-translate-y-1 w-full`;

        if (action.type === 'link') {
          return (
            <a key={index} href={action.href} className={className}>
              {content}
            </a>
          );
        }

        return (
          <button key={index} onClick={() => onOpenFavorites(action.type)} className={className}>
            {content}
          </button>
        );
      })}
    </div>
  );
};


// =================================================================================
// ====================== IndexedDB 辅助函数 (保持不变) ========================
// =================================================================================
const DB_NAME = 'ChineseLearningDB';
const SENTENCE_STORE_NAME = 'favoriteSentences';
const WORD_STORE_NAME = 'favoriteWords'; // 单词收藏存储名

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject('数据库打开失败');
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SENTENCE_STORE_NAME)) {
        db.createObjectStore(SENTENCE_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WORD_STORE_NAME)) {
        db.createObjectStore(WORD_STORE_NAME, { keyPath: 'id' });
      }
    };
  });
}

async function getAllFavorites(storeName) {
    try {
        const db = await openDB();
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(new Error('Failed to retrieve items: ' + event.target.errorCode));
        });
    } catch (error) {
        console.error("IndexedDB Error:", error);
        return [];
    }
}


/**
 * 首页 - 终极融合版 (已应用所有修改)
 */
const LayoutIndex = props => {
  const router = useRouter(); 
  const { books, speakingCourses, sentenceCards, allWords } = props;

  const tabs = [
    { name: '文章', icon: <Newspaper size={22} /> },
    { name: 'HSK', icon: <GraduationCap size={22} /> },
    { name: '口语', icon: <Mic size={22} /> },
    { name: '练习', icon: <ClipboardCheck size={22} /> },
    { name: '书籍', icon: <BookOpen size={22} /> }
  ];
  
  const [activeTab, setActiveTab] = useState(tabs[0].name);
  const [backgroundUrl, setBackgroundUrl] = useState('');
  
  const scrollableContainerRef = useRef(null);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

  const sidebarWidth = 288;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(null);
  const currentSidebarX = useRef(-sidebarWidth);

  const [sentenceCardData, setSentenceCardData] = useState(null);
  const [wordCardData, setWordCardData] = useState(null);
  const isSentenceFavoritesCardOpen = router.asPath.includes('#favorite-sentences');
  const isWordFavoritesCardOpen = router.asPath.includes('#favorite-words');

  const handleOpenFavorites = useCallback(async (type) => {
    if (type === 'sentences') {
        const sentences = await getAllFavorites(SENTENCE_STORE_NAME);
        if (sentences && sentences.length > 0) {
            setSentenceCardData(sentences.map(s => ({ id: s.id, sentence: s.chinese, translation: s.burmese, pinyin: s.pinyin, imageUrl: s.imageUrl })));
            setWordCardData(null);
            router.push(router.asPath + '#favorite-sentences', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何短句。');
        }
    } else if (type === 'words') {
        const words = await getAllFavorites(WORD_STORE_NAME);
        if (words && words.length > 0) {
            setWordCardData(words);
            setSentenceCardData(null);
            router.push(router.asPath + '#favorite-words', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何单词。');
        }
    } else if (type === 'grammar') {
        alert('“收藏语法”功能正在开发中，敬请期待！');
    }
  }, [router]); 

  const handleCloseFavorites = useCallback(() => {
    setSentenceCardData(null);
    setWordCardData(null);
    if (window.location.hash.includes('#favorite')) {
        router.back();
    }
  }, [router]);

  useEffect(() => {
    const container = scrollableContainerRef.current;
    if (!container) return;

    const threshold = 10;
    const handleScroll = () => {
      const currentY = container.scrollTop;
      const maxScrollY = container.scrollHeight - container.clientHeight;

      if (!ticking.current) {
        window.requestAnimationFrame(() => {
          const diff = currentY - lastScrollY.current;
          if (Math.abs(diff) > threshold) {
            if (diff > 0) {
              setIsNavVisible(false);
            } else {
              setIsNavVisible(true);
            }
            lastScrollY.current = currentY;
          }
          if (currentY < 50 || currentY >= maxScrollY - 50) {
            setIsNavVisible(true);
          }
          ticking.current = false;
        });
        ticking.current = true;
      }
    };
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    const handlePopState = () => {
      const hash = window.location.hash;
      if (!hash.includes('favorite-sentences') && !hash.includes('favorite-words')) {
        setSentenceCardData(null);
        setWordCardData(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    const backgrounds = [
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto-format&fit-crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto-format&fit-crop&q=80&w=2070'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    return () => { 
        container.removeEventListener('scroll', handleScroll);
        window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleTouchStart = (e) => {
    const startX = e.touches[0].clientX;
    if ((!isSidebarOpen && startX > 50)) return;
    touchStartX.current = startX;
    currentSidebarX.current = sidebarX;
    setIsDragging(true);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX.current === null) return;
    const currentX = e.touches[0].clientX;
    const deltaX = currentX - touchStartX.current;
    let newX = currentSidebarX.current + deltaX;
    newX = Math.max(-sidebarWidth, Math.min(newX, 0));
    setSidebarX(newX);
  };

  const handleTouchEnd = () => {
    if (!isDragging || touchStartX.current === null) return;
    setIsDragging(false);
    touchStartX.current = null;
    if (sidebarX < -sidebarWidth / 2) {
        closeSidebar();
    } else {
        openSidebar();
    }
  };

  const contentSwipeHandlers = useSwipeable({
      onSwipedLeft: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].name);
      },
      onSwipedRight: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].name);
      },
      disabled: isDragging,
      preventDefaultTouchmoveEvent: true,
      trackMouse: true,
      delta: 50
  });

  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };
  const PostListComponent = siteConfig('POST_LIST_STYLE') === 'page' ? BlogPostListPage : BlogPostListScroll;

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/>
        <CustomScrollbarStyle />
        <HomeSidebar isOpen={isSidebarOpen} onClose={closeSidebar} sidebarX={sidebarX} isDragging={isDragging} />

        <div onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} className='relative flex-grow w-full h-full'>
            <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/20'></div>

            <button onClick={openSidebar} className="absolute top-4 left-4 z-30 p-2 text-white bg-black/20 rounded-full hover:bg-black/40 transition-colors" aria-label="打开菜单">
                <i className="fas fa-bars text-xl"></i>
            </button>
            
            <div className='absolute top-0 left-0 right-0 h-[40vh] z-10 p-4 flex flex-col justify-end text-white pointer-events-none'>
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

            <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[40vh] flex-shrink-0' />
                <div className='relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-24 min-h-[calc(60vh+1px)]'>
                    
                    {/* ✅ 静态头部：包含搜索和操作按钮，会随页面滚动 */}
                    <div className='bg-violet-50 dark:bg-gray-800 pt-6 rounded-t-2xl'>
                       <div className='px-4'><GlosbeSearchCard /></div>
                       <ActionButtons onOpenFavorites={handleOpenFavorites} />
                    </div>

                    {/* ✅ 吸顶分类栏：只包含分类，独立于上方内容 */}
                    <div className={`sticky top-0 z-20 transition-transform duration-300 ease-in-out ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                        {/* 背景色与上方头部一致，并带有毛玻璃效果 */}
                        <div className='bg-violet-50/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-t border-gray-200 dark:border-gray-700'>
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
                    </div>
                    
                    {/* ✅ 主内容区 */}
                    <main {...contentSwipeHandlers}>
                        {tabs.map(tab => (
                            <div key={tab.name} className={`${activeTab === tab.name ? 'block' : 'hidden'}`}>
                                <div className='p-4'> 
                                    {tab.name === '文章' && <PostListComponent {...props} />}
                                    {tab.name === 'HSK' && <HskContentBlock words={allWords} />}
                                    {tab.name === '口语' && <SpeakingContentBlock speakingCourses={speakingCourses} sentenceCards={sentenceCards} />}
                                    {tab.name === '练习' && <PracticeContentBlock />}
                                    {tab.name === '书籍' && <BooksContentBlock notionBooks={books} />}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
            
            <BottomNavBar />
        </div>

        {/* 收藏组件 (保持不变) */}
        <ShortSentenceCard
            sentences={sentenceCardData || []}
            isOpen={isSentenceFavoritesCardOpen}
            onClose={handleCloseFavorites}
            progressKey="favorites-sentences" 
        />
        <WordCard
            words={wordCardData || []}
            isOpen={isWordFavoritesCardOpen}
            onClose={handleCloseFavorites}
            progressKey="favorites-words" 
        />
    </div>
  );
};


// =========================================================================
// =============  其他所有组件，保持原样，一字不漏  ===================
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
  const { locale } = useGlobal()
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

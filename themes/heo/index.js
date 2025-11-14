// themes/heo/index.js <-- 最终修复完整版：已解决初始加载吸顶问题和滑动冲突，并修复了手势返回问题

// =================================================================================
// ======================  所有 import 语句已更新  ========================
// =================================================================================
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
import { Transition, Dialog } from '@headlessui/react'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useEffect, useState, useRef, useCallback, Fragment } from 'react'
import { useSwipeable } from 'react-swipeable'

// 依赖于您项目中的 themes/heo/components/ 文件夹
import BlogPostArchive from './components/BlogPostArchive'
import BlogPostListPage from './components/BlogPostListPage'
import BlogPostListScroll from './components/BlogPostListScroll'
import CategoryBar from './components/CategoryBar'
import FloatTocButton from './components/FloatTocButton'
import Footer from './components/Footer'
import Header from './components/Header'
import { NoticeBar } from './components/NoticeBar'
import PostHeader from './components/PostHeader'
import { PostLock } from './components/PostLock'
import SearchNav from './components/SearchNav'
import SideRight from './components/SideRight'

import CONFIG from './config'
import { Style } from './style'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import { FaTiktok, FaFacebook, FaTelegramPlane } from 'react-icons/fa'
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
    BookText,
    SpellCheck2
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'

// 导入内容块组件
import HskContentBlock from '@/components/HskPageClient'
import SpeakingContentBlock from '@/components/SpeakingContentBlock'
import PracticeContentBlock from '@/components/PracticeContentBlock'
import BooksContentBlock from '@/components/BooksContentBlock'
import WordsContentBlock from '@/components/WordsContentBlock' // ✅ 导入新的单词组件
import AiChatAssistant from '@/components/AiChatAssistant'

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })
const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })
const ShortSentenceCard = dynamic(() => import('@/components/ShortSentenceCard'), { ssr: false })
const WordCard = dynamic(() => import('@/components/WordCard'), { ssr: false })


// =================================================================================
// ====================== 所有其他组件 (HomeSidebar, LayoutBase, 等) 保持不变 ========================
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

const LayoutBase = props => {
  const { children, slotTop, className } = props
  const { fullWidth, isDarkMode } = useGlobal()
  const router = useRouter()
  // 首页布局由 LayoutIndex 接管
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

const CustomScrollbarStyle = () => (
    <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(150, 150, 150, 0.3); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(100, 100, 100, 0.4); }
    `}</style>
);

// =================================================================================
// ======================  BottomNavBar 组件 (最终版) ========================
// =================================================================================
const BottomNavBar = ({ onOpenAiDrawer }) => {
    const navItems = [
        { type: 'link', href: '/', label: '学习', icon: 'fas fa-graduation-cap', mainTabs: ['articles', 'words', 'hsk', 'speaking', 'grammar'] },
        { type: 'button', label: 'AI助手', icon: 'fas fa-robot' },
        { type: 'link', href: '/?tab=practice', label: '练习', icon: 'fas fa-clipboard-check' },
        { type: 'link', href: '/?tab=books', label: '书籍', icon: 'fas fa-book-open' },
    ];
    const router = useRouter();

    const isActive = (item) => {
        if (item.type === 'button') return false; 
        const currentTab = router.query.tab || 'articles';

        if (item.href.startsWith('/?tab=')) {
            const tab = item.href.split('=')[1];
            return currentTab === tab;
        }
        if (item.href === '/') {
            return router.pathname === '/' && item.mainTabs.includes(currentTab);
        }
        return router.pathname === item.href;
    };

    return (
        <nav className='fixed bottom-0 left-0 right-0 h-16 bg-white/80 dark:bg-black/80 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.1)] z-50 flex justify-around items-center md:hidden'>
            {navItems.map(item => {
                if (item.type === 'button') {
                    return (
                        <button key={item.label} onClick={onOpenAiDrawer} className='flex flex-col items-center justify-center w-1/4 text-gray-500 dark:text-gray-400'>
                            <i className={`${item.icon} text-xl`}></i>
                            <span className='text-xs mt-1'>{item.label}</span>
                        </button>
                    );
                }
                return (
                     <SmartLink key={item.label} href={item.href} className={`flex flex-col items-center justify-center w-1/4 ${isActive(item) ? 'text-blue-500' : 'text-gray-500'}`}>
                        <i className={`${item.icon} text-xl`}></i>
                        <span className={`text-xs mt-1`}>{item.label}</span>
                    </SmartLink>
                );
            })}
        </nav>
    );
};

// =================================================================================
// ====================== ActionButtons 组件 (保持不变) =======================
// =================================================================================
const ActionButtons = ({ onOpenFavorites, onOpenContact }) => {
  const actions = [
    { icon: <Phone size={24} />, text: '联系我们', type: 'contact', color: 'from-blue-500 to-sky-500' },
    { icon: <MessageSquare size={24} />, text: '在线客服', type: 'link', href: '#', color: 'from-green-500 to-emerald-500' },
    { icon: <Users size={24} />, text: '加入社群', type: 'link', href: '#', color: 'from-purple-500 to-indigo-500' },
    { icon: <Heart size={24} />, text: '收藏单词', type: 'words', color: 'from-orange-500 to-amber-500' },
    { icon: <List size={24} />, text: '收藏短句', type: 'sentences', color: 'from-red-500 to-rose-500' },
    { icon: <BookText size={24} />, text: '收藏语法', type: 'grammar', color: 'from-gray-500 to-slate-500' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4 px-4">
      {actions.map((action, index) => {
        const content = ( <> <div className="mb-2">{action.icon}</div> <span className="text-sm font-semibold">{action.text}</span> </> );
        const className = `flex flex-col items-center justify-center p-4 rounded-xl shadow-lg hover:shadow-xl text-white bg-gradient-to-br ${action.color} transition-all duration-300 transform hover:-translate-y-1 w-full`;
        
        if (action.type === 'link') {
          return ( <a key={index} href={action.href} className={className}> {content} </a> );
        }
        if (action.type === 'contact') {
          return ( <button key={index} onClick={onOpenContact} className={className}> {content} </button> );
        }
        return ( <button key={index} onClick={() => onOpenFavorites(action.type)} className={className}> {content} </button> );
      })}
    </div>
  );
};

const DB_NAME = 'ChineseLearningDB';
const SENTENCE_STORE_NAME = 'favoriteSentences';
const WORD_STORE_NAME = 'favoriteWords';

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

// =================================================================================
// ======================  ContactPanel 组件 (保持不变) ============================
// =================================================================================
const ContactPanel = ({ isOpen, onClose }) => {
    const socialLinks = [
        { name: 'Facebook', href: 'https://www.facebook.com/share/1ErXyBbrZ1', icon: <FaFacebook size={32} />, color: 'text-blue-600' },
        { name: 'TikTok', href: 'https://www.tiktok.com/@mmzh.onlione?_r=1&_t=ZS-91OzyDddPu8', icon: <FaTiktok size={32} />, color: 'text-black dark:text-white' },
        { name: 'Telegram', href: 'https://t.me/hurt8888', icon: <FaTelegramPlane size={32} />, color: 'text-sky-500' }
    ];

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                                <Dialog.Title as="h3" className="text-lg font-bold leading-6 text-gray-900 dark:text-gray-100">
                                    联系我们
                                </Dialog.Title>
                                <div className="mt-4">
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                        通过以下方式与我们取得联系，我们期待您的咨询。
                                    </p>
                                </div>

                                <div className="mt-6 space-y-4">
                                    {socialLinks.map(link => (
                                        <a
                                            key={link.name}
                                            href={link.href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-4 p-4 rounded-lg bg-gray-100 dark:bg-gray-700/50 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                                        >
                                            <div className={link.color}>{link.icon}</div>
                                            <div>
                                                <p className="font-semibold text-gray-800 dark:text-gray-200">{link.name}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">点击跳转</p>
                                            </div>
                                        </a>
                                    ))}
                                </div>

                                <div className="mt-6">
                                    <button
                                        type="button"
                                        className="inline-flex justify-center rounded-md border border-transparent bg-blue-100 dark:bg-blue-900/50 px-4 py-2 text-sm font-medium text-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-800 w-full"
                                        onClick={onClose}
                                    >
                                        关闭
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};


// =================================================================================
// ======================  LayoutIndex 组件 (最终版) ========================
// =================================================================================
const LayoutIndex = props => {
  const router = useRouter();
  const { books, speakingCourses, sentenceCards, allWords } = props;

  const tabs = [
    { name: '文章', key: 'articles', icon: <Newspaper size={22} /> },
    { name: '单词', key: 'words', icon: <BookText size={22} /> },
    { name: 'HSK', key: 'hsk', icon: <GraduationCap size={22} /> },
    { name: '口语', key: 'speaking', icon: <Mic size={22} /> },
    { name: '语法', key: 'grammar', icon: <SpellCheck2 size={22} /> },
    { name: '练习', key: 'practice', icon: <ClipboardCheck size={22} /> },
    { name: '书籍', key: 'books', icon: <BookOpen size={22} /> }
  ];
  
  const displayTabs = tabs.filter(tab => ['文章', '单词', 'HSK', '口语', '语法'].includes(tab.name));

  const [activeTab, setActiveTab] = useState(null); 

  useEffect(() => {
    if (router.isReady) {
      const tabFromQuery = router.query.tab;
      const validTab = tabs.find(t => t.key === tabFromQuery);
      setActiveTab(validTab ? validTab.name : tabs[0].name);
    }
  }, [router.isReady, router.query.tab]);
  
  const handleTabChange = (tabName) => {
    const newTabKey = tabs.find(t => t.name === tabName)?.key;
    if (newTabKey) {
      router.push(`/?tab=${newTabKey}`, undefined, { shallow: true });
    }
  };

  const [backgroundUrl, setBackgroundUrl] = useState('');
  const scrollableContainerRef = useRef(null);
  const stickySentinelRef = useRef(null);
  const lastScrollY = useRef(0);
  const [isStickyActive, setIsStickyActive] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const mainContentRef = useRef(null);
  const sidebarWidth = 288;
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [sidebarX, setSidebarX] = useState(-sidebarWidth);
  const [isDragging, setIsDragging] = useState(false);
  const touchStartX = useRef(null);
  const currentSidebarX = useRef(-sidebarWidth);
  const [sentenceCardData, setSentenceCardData] = useState(null);
  const [wordCardData, setWordCardData] = useState(null);
  const isSentenceFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-sentences' : false;
  const isWordFavoritesCardOpen = isBrowser ? window.location.hash === '#favorite-words' : false;
  const [isContactPanelOpen, setIsContactPanelOpen] = useState(false);
  
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const handleOpenAiDrawer = () => {
      router.push(router.asPath + '#ai-chat', undefined, { shallow: true });
      setIsAiDrawerOpen(true);
  };
  const handleCloseAiDrawer = () => {
      if (window.location.hash === '#ai-chat') {
        router.back();
      } else {
        setIsAiDrawerOpen(false);
      }
  };

  useEffect(() => {
    const handlePopState = () => {
        if (window.location.hash !== '#ai-chat') {
            setIsAiDrawerOpen(false);
        }
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);


  const handleOpenFavorites = useCallback(async (type) => {
    if (type === 'sentences') {
        const sentences = await getAllFavorites(SENTENCE_STORE_NAME);
        if (sentences?.length > 0) {
            setSentenceCardData(sentences.map(s => ({ id: s.id, sentence: s.chinese, translation: s.burmese, pinyin: s.pinyin, imageUrl: s.imageUrl })));
            router.push('#favorite-sentences', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何短句。');
        }
    } else if (type === 'words') {
        const words = await getAllFavorites(WORD_STORE_NAME);
        if (words?.length > 0) {
            setWordCardData(words);
            router.push('#favorite-words', undefined, { shallow: true });
        } else {
            alert('您还没有收藏任何单词。');
        }
    } else if (type === 'grammar') {
        alert('“收藏语法”功能正在开发中，敬请期待！');
    }
  }, [router]); 

  const handleCloseFavorites = useCallback(() => {
    router.push(router.pathname, undefined, { shallow: true });
  }, [router]);

  useEffect(() => {
    const handlePopStateFavorites = () => {
      if (!window.location.hash.startsWith('#favorite')) {
        setSentenceCardData(null);
        setWordCardData(null);
      }
    };
    window.addEventListener('popstate', handlePopStateFavorites);

    const backgrounds = [
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto-format&fit-crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto-format&fit-crop&q=80&w=2070'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    const container = scrollableContainerRef.current;
    if (!container) return;

    let ticking = false;
    const handleScroll = () => {
      if (!isStickyActive) {
          lastScrollY.current = container.scrollTop;
          return;
      }
      const currentY = container.scrollTop;
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const diff = currentY - lastScrollY.current;
          if (Math.abs(diff) > 10) {
            setIsNavVisible(diff <= 0);
          }
          lastScrollY.current = currentY;
          ticking = false;
        });
        ticking = true;
      }
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    
    const observer = new IntersectionObserver(
        ([entry]) => {
            const shouldBeSticky = !entry.isIntersecting && entry.boundingClientRect.top < 0;
            setIsStickyActive(shouldBeSticky);
            if (!shouldBeSticky) {
                setIsNavVisible(true);
            }
        }, { threshold: 0 }
    );
      
    const currentSentinel = stickySentinelRef.current;
    if (currentSentinel) observer.observe(currentSentinel);
    
    return () => { 
        container.removeEventListener('scroll', handleScroll);
        if (currentSentinel) observer.unobserve(currentSentinel);
        window.removeEventListener('popstate', handlePopStateFavorites);
    };
  }, [isStickyActive, router]);

  const contentSwipeHandlers = useSwipeable({
      onSwipedLeft: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex < tabs.length - 1) handleTabChange(tabs[currentIndex + 1].name);
      },
      onSwipedRight: () => {
          const currentIndex = tabs.findIndex(t => t.name === activeTab);
          if (currentIndex > 0) handleTabChange(tabs[currentIndex - 1].name);
      },
      preventDefaultTouchmoveEvent: true,
      trackMouse: true,
      delta: 50
  });

  const handleTouchStart = (e) => {
    if (!isSidebarOpen && mainContentRef.current?.contains(e.target)) return;
    const startX = e.touches[0].clientX;
    if (!isSidebarOpen && startX > window.innerWidth * 0.4) return;
    touchStartX.current = startX;
    currentSidebarX.current = sidebarX;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (!isDragging || touchStartX.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    const newX = Math.max(-sidebarWidth, Math.min(currentSidebarX.current + deltaX, 0));
    setSidebarX(newX);
  };
  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    touchStartX.current = null;
    if (sidebarX < -sidebarWidth / 2) closeSidebar();
    else openSidebar();
  };
  const openSidebar = () => { setIsSidebarOpen(true); setSidebarX(0); };
  const closeSidebar = () => { setIsSidebarOpen(false); setSidebarX(-sidebarWidth); };
  const PostListComponent = siteConfig('POST_LIST_STYLE') === 'page' ? BlogPostListPage : BlogPostListScroll;

  const renderTabButtons = () => displayTabs.map(tab => (
    <button key={tab.name} onClick={() => handleTabChange(tab.name)} className={`flex flex-col items-center justify-center w-1/5 pt-2.5 pb-1.5 transition-colors duration-300 focus:outline-none ${activeTab === tab.name ? 'text-blue-500' : 'text-gray-500 dark:text-gray-400'}`}>
        {tab.icon}
        <span className='text-xs font-semibold mt-1'>{tab.name}</span>
        <div className={`w-6 h-0.5 mt-1 rounded-full transition-all duration-300 ${activeTab === tab.name ? 'bg-blue-500' : 'bg-transparent'}`}></div>
    </button>
  ));

  if (!activeTab) {
    return (
        <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
            {/* 加载动画 */}
        </div>
    );
  }

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
                        <a href="https://www.tiktok.com/@mmzh.onlione?_r=1&_t=ZS-91OzyDddPu8" target="_blank" rel="noopener noreferrer" className='col-span-1 row-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/tiktok.jpg')" }}><div className='absolute top-1 left-1 bg-pink-500 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaTiktok size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <a href="https://www.facebook.com/share/1ErXyBbrZ1" target="_blank" rel="noopener noreferrer" className='col-span-1 row-start-2 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{ backgroundImage: "url('/img/facebook.jpg')" }}><div className='absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaFacebook size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <div className='col-span-2 col-start-2 row-span-2 rounded-xl overflow-hidden bg-black'><iframe title="YouTube" width="100%" height="100%" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
                    </div>
                </div>
            </div>

            <div ref={scrollableContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[40vh] flex-shrink-0' />
                <div className='relative bg-white dark:bg-gray-900 rounded-t-2xl shadow-2xl pb-24 min-h-[calc(60vh+1px)]'>
                    
                    <div className='bg-violet-50 dark:bg-gray-800 rounded-t-2xl'>
                        <div className='pt-6'>
                           <div className='px-4 mb-6'><GlosbeSearchCard /></div>
                           <div className='pb-6'><ActionButtons onOpenFavorites={handleOpenFavorites} onOpenContact={() => setIsContactPanelOpen(true)} /></div>
                        </div>
                        <div ref={stickySentinelRef}></div>
                        <div className={`${isStickyActive ? 'invisible h-0' : ''} border-b border-violet-200 dark:border-gray-700`}>
                            <div className='flex justify-around'>{renderTabButtons()}</div>
                       </div>
                    </div>

                    <div className={`transition-transform duration-300 ease-in-out ${isStickyActive ? 'fixed w-full top-0 z-30' : 'hidden'} ${isNavVisible ? 'translate-y-0' : '-translate-y-full'}`}>
                        <div className='bg-violet-50/80 dark:bg-gray-800/80 backdrop-blur-lg border-b border-violet-200 dark:border-gray-700'>
                            <div className='flex justify-around max-w-[86rem] mx-auto'>{renderTabButtons()}</div>
                        </div>
                    </div>
                    
                    <main ref={mainContentRef} {...contentSwipeHandlers}>
                        {tabs.map(tab => (
                            <div key={tab.name} className={`${activeTab === tab.name ? 'block' : 'hidden'}`}>
                                <div className='p-4'> 
                                    {tab.name === '文章' && <PostListComponent {...props} />}
                                    {tab.name === '单词' && <WordsContentBlock />}
                                    {tab.name === 'HSK' && <HskContentBlock words={allWords} />}
                                    {tab.name === '口语' && <SpeakingContentBlock speakingCourses={speakingCourses} sentenceCards={sentenceCards} />}
                                    {tab.name === '语法' && <div>语法内容区待开发...</div>}
                                    {tab.name === '练习' && <PracticeContentBlock />}
                                    {tab.name === '书籍' && <BooksContentBlock notionBooks={books} />}
                                </div>
                            </div>
                        ))}
                    </main>
                </div>
            </div>
            <BottomNavBar onOpenAiDrawer={handleOpenAiDrawer} />
        </div>

        {sentenceCardData && <ShortSentenceCard sentences={sentenceCardData} isOpen={isSentenceFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-sentences" />}
        {wordCardData && <WordCard words={wordCardData} isOpen={isWordFavoritesCardOpen} onClose={handleCloseFavorites} progressKey="favorites-words" />}
        <ContactPanel isOpen={isContactPanelOpen} onClose={() => setIsContactPanelOpen(false)} />
        
        <AiChatAssistant isOpen={isAiDrawerOpen} onClose={handleCloseAiDrawer} />
    </div>
  );
};


// =================================================================================
// ======================  所有其他布局组件 (LayoutPostList, etc.) 保持不变 ========================
// =================================================================================
const LayoutPostList = props => (
    <div id='post-outer-wrapper' className='px-5  md:px-0'>
      <CategoryBar {...props} />
      {siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}
    </div>
)

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
    <div>
      <div id='post-outer-wrapper' className='px-5 md:px-0'>
        {!currentSearch ? (
          <SearchNav {...props} />
        ) : (
          <div id='posts-wrapper'>
            {siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}
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
  const router = useRouter()
  
  useEffect(() => {
    if (!post) {
      setTimeout(() => {
        if (isBrowser) {
          const article = document.getElementById('notion-article')
          if (!article) {
            router.push('/404').then(() => console.warn('找不到页面', router.asPath))
          }
        }
      }, siteConfig('POST_WAITING_TIME_FOR_404') * 1000)
    }
  }, [post, router])

  const commentEnable = siteConfig('COMMENT_TWIKOO_ENV_ID') || siteConfig('COMMENT_WALINE_SERVER_URL') || siteConfig('COMMENT_VALINE_APP_ID') || siteConfig('COMMENT_GISCUS_REPO') || siteConfig('COMMENT_CUSDIS_APP_ID') || siteConfig('COMMENT_UTTERRANCES_REPO') || siteConfig('COMMENT_GITALK_CLIENT_ID') || siteConfig('COMMENT_WEBMENTION_ENABLE')

  return (
    <>
      <div className={`w-full ${fullWidth ? '' : 'xl:max-w-5xl lg:hover:shadow lg:border'} lg:px-2 lg:py-4 bg-white dark:bg-[#18171d] dark:border-gray-600 rounded-2xl`}>
        {lock && <PostLock validPassword={validPassword} />}
        {!lock && post && (
          <div id="article-wrapper" className='px-5'>
            <article itemScope itemType='https://schema.org/Article'>
              <WWAds orientation='horizontal' className='w-full' />
              {post && <NotionPage post={post} />}
              <WWAds orientation='horizontal' className='w-full' />
            </article>
            {commentEnable && (
              <div className='px-5'>
                <hr className='my-4 border-dashed' />
                <div className='py-2'><AdSlot /></div>
                <div className='text-2xl dark:text-white'><i className='fas fa-comment mr-1' />{locale.COMMON.COMMENTS}</div>
                <Comment frontMatter={post} />
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
  const { onLoading } = useGlobal()
  return (
    <div id='error-wrapper' className='w-full mx-auto justify-center'>
        <Transition
          show={!onLoading} appear={true}
          enter='transition ease-in-out duration-700 transform order-first' enterFrom='opacity-0 translate-y-16' enterTo='opacity-100'
          leave='transition ease-in-out duration-300 transform' leaveFrom='opacity-100 translate-y-0' leaveTo='opacity-0 -translate-y-16'
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

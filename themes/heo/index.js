// themes/heo/index.js  <-- 最终修复版：保持原始导出结构，更新内部实现

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
import { isBrowser, getListByPage, formatDate } from '@/lib/utils'
import { Transition } from '@headlessui/react'
import SmartLink from '@/components/SmartLink'
import { useRouter } from 'next/router'
import { useEffect, useState, useRef } from 'react'
import { useSwipeable } from 'react-swipeable'
import CONFIG from './config'
import { Style } from './style'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'
import { FaTiktok, FaFacebook } from 'react-icons/fa'
import { 
    Newspaper, 
    GraduationCap, 
    Smile, 
    ClipboardCheck, 
    BookOpen, 
    Phone, 
    MessageSquare, 
    Users 
} from 'lucide-react'
import { useAuth } from '@/lib/AuthContext'
import dynamic from 'next/dynamic'
import Link from 'next/link'
//import { formatDate } from '@/lib/utils/formatDate'

const GlosbeSearchCard = dynamic(() => import('@/components/GlosbeSearchCard'), { ssr: false })
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false })


// ##################################################################
// # region 内部子组件定义区域                                       #
// ##################################################################

// 内部组件: BlogPostCard
const BlogPostCard = ({ post }) => {
  return (
    <Link href={`${siteConfig('SUB_PATH', '')}/${post.slug}`}>
      <article key={post.id} className="group flex flex-col shadow-md rounded-lg overflow-hidden cursor-pointer bg-white dark:bg-gray-800 hover:shadow-xl transition-shadow duration-300">
        <div className="overflow-hidden aspect-w-16 aspect-h-9">
            <LazyImage 
                src={post?.pageCover} 
                className='w-full h-48 object-cover object-center group-hover:scale-105 transition-transform duration-500' 
            />
        </div>
        <div className="p-5 flex flex-col flex-grow">
          <h2 className="text-lg font-bold mb-2 text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">{post.title}</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 flex-grow">{post.summary}</p>
          <div className="text-xs text-gray-400 dark:text-gray-500">
             {formatDate(post?.publishDate, siteConfig('LANG'))}
          </div>
        </div>
      </article>
    </Link>
  )
}

// 内部组件: BlogPostListEmpty
const BlogPostListEmpty = ({ currentSearch }) => {
  const { locale } = useGlobal()
  return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <p className="text-gray-500 dark:text-gray-400">
        {currentSearch
          ? `${locale.COMMON.SEARCH_NOT_FOUND} "${currentSearch}"`
          : locale.COMMON.NO_RESULTS}
      </p>
    </div>
  )
}

// 内部组件: Paginator
const Paginator = ({ page, postCount }) => {
  const { NOTION_CONFIG } = useGlobal()
  const router = useRouter()
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, NOTION_CONFIG)
  const totalPage = Math.ceil(postCount / POSTS_PER_PAGE)
  const currentPage = +page

  const pagePrefix = router.asPath.split('?')[0].replace(/\/page\/[0-9]+/, '').replace(/\/$/, '')

  if (totalPage <= 1) return null

  return (
    <div className="flex justify-between my-10 font-medium text-gray-700 dark:text-gray-300">
      <Link
        href={{
          pathname: currentPage - 1 === 1 ? `${pagePrefix}/` : `${pagePrefix}/page/${currentPage - 1}`,
          query: router.query
        }}
        passHref
      >
        <a className={`${currentPage === 1 ? 'invisible pointer-events-none' : 'block'} py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}>
          ← Previous
        </a>
      </Link>
      <div className="flex items-center">
        Page {currentPage} of {totalPage}
      </div>
      <Link
        href={{
          pathname: `${pagePrefix}/page/${currentPage + 1}`,
          query: router.query
        }}
        passHref
      >
        <a className={`${currentPage >= totalPage ? 'invisible pointer-events-none' : 'block'} py-2 px-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors`}>
          Next →
        </a>
      </Link>
    </div>
  )
}

// 内部组件: BlogPostListPage
const BlogPostListPage = ({ page, posts, postCount }) => {
  if (!posts || posts.length === 0) {
    return <BlogPostListEmpty />;
  }
  
  return (
    <div className="w-full">
        <div id="posts-wrapper" className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {posts?.map(post => (
                <BlogPostCard key={post.id} post={post} />
            ))}
        </div>
        <Paginator page={page} postCount={postCount} />
    </div>
  )
}

// 内部组件: BlogPostListScroll
const BlogPostListScroll = ({ posts = [], postCount, currentSearch }) => {
  const [page, setPage] = useState(1)
  const { NOTION_CONFIG } = useGlobal()
  const POSTS_PER_PAGE = siteConfig('POSTS_PER_PAGE', 12, NOTION_CONFIG)
  
  const postsToShow = getListByPage(posts, page, POSTS_PER_PAGE)

  let hasMore = false
  if (posts) {
    const totalCount = posts.length
    hasMore = page * POSTS_PER_PAGE < totalCount
  }
  
  const targetRef = useRef(null)
  const { locale } = useGlobal()

  const handleGetMore = () => {
    if (!hasMore) return
    setPage(page + 1)
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore) {
          handleGetMore()
        }
      },
      { threshold: 0.1 }
    )
    const currentTarget = targetRef.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [page, hasMore])

  if (!postsToShow || postsToShow.length === 0) {
    return <BlogPostListEmpty currentSearch={currentSearch} />
  }

  return (
     <div id="posts-wrapper" className="w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {postsToShow.map(post => (
                <BlogPostCard key={post.id} post={post} />
            ))}
        </div>
        <div ref={targetRef} className="w-full my-6 py-4 text-center cursor-pointer text-gray-500 dark:text-gray-400" onClick={handleGetMore}>
            {hasMore ? locale.COMMON.MORE : locale.COMMON.NO_MORE}
        </div>
    </div>
  )
}

// 内部组件: BlogPostArchive
const BlogPostArchive = ({ posts = [], archiveTitle }) => {
  return (
    <div className="mb-10">
      <p className="text-xl md:text-2xl my-6 font-bold text-gray-700 dark:text-gray-300">{archiveTitle}</p>
      <ul>
        {posts.map(post => (
          <li key={post.id} className="border-l-2 p-1 text-xs md:text-base items-center  hover:scale-105 hover:border-gray-500 dark:hover:border-gray-300 dark:border-gray-400 transform duration-200">
            <div id={post?.publishDay}>
              <span className="text-gray-400">{post.publishDay}</span> &nbsp;
              <Link href={`${siteConfig('SUB_PATH', '')}/${post.slug}`} passHref>
                <a className="dark:text-gray-400 dark:hover:text-gray-300 overflow-x-hidden hover:underline cursor-pointer text-gray-600">
                  {post.title}
                </a>
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

// 内部组件: CategoryBar
const CategoryBar = ({ categories, category, postCount }) => {
  const router = useRouter()
  return (
    <div className={`flex justify-between items-center font-sans overflow-x-auto
      px-5 py-3 dark:bg-transparent dark:text-gray-300 text-gray-600 bg-white shadow-md`}>
      <div className='flex-grow'>
        <Link href='/category' passHref>
          <a className={`whitespace-nowrap ${!router.query.category ? 'text-blue-500' : ''}`}>
            All ({postCount})
          </a>
        </Link>
        {categories.map(c => (
          <Link key={c.name} href={`/category/${c.name}`} passHref>
            <a className={`whitespace-nowrap ml-4 ${category === c.name ? 'text-blue-500' : ''}`}>
              {c.name} ({c.count})
            </a>
          </Link>
        ))}
      </div>
    </div>
  )
}

// 内部组件: FloatTocButton
const FloatTocButton = ({ toc }) => {
  const [showToc, setShowToc] = useState(false);
  useEffect(() => {
    setShowToc(toc && toc.length > 0);
  }, [toc]);

  if (!showToc) return <></>;

  return (
    <div className="fixed right-4 bottom-24 z-30">
        <button
          onClick={() => {
            const tocDrawer = document.getElementById('toc-drawer');
            tocDrawer?.classList?.toggle('hidden');
          }}
          className='w-10 h-10 bg-white dark:bg-gray-800 text-black dark:text-white rounded-full shadow-md flex justify-center items-center'
          aria-label="Toggle Table of Contents"
        >
          <i className="fas fa-list-ol"></i>
        </button>
    </div>
  );
}

// 内部组件: Footer
const Footer = () => {
  const d = new Date()
  const currentYear = d.getFullYear()
  const since = siteConfig('SINCE')
  const copyrightDate = since && since !== currentYear ? since + '-' + currentYear : currentYear

  return (
    <footer
      className='relative z-10 dark:bg-black flex-shrink-0 bg-white justify-center text-center m-auto w-full leading-6 text-sm p-6 dark:text-gray-400'
    >
      <span>
        &copy; {copyrightDate} {siteConfig('AUTHOR')}. All Rights Reserved.
      </span>
    </footer>
  )
}

// 内部组件: Header (简化占位符)
const Header = (props) => {
    return <header className='h-16 bg-white dark:bg-gray-900 shadow-md sticky top-0 z-40'></header>;
}

// 内部组件: Hero (占位符)
const Hero = (props) => {
    return <div className='w-full h-96 bg-gray-200 dark:bg-gray-800'></div>;
}

// 内部组件: NoticeBar (占位符)
const NoticeBar = () => {
    const { locale } = useGlobal();
    return <div className='w-full p-2 bg-blue-100 text-center text-blue-800 text-sm'>{locale?.COMMON?.NOTICE || '通知内容'}</div>;
}

// 内部组件: PostHeader
const PostHeader = ({ post }) => {
  if (!post) return <></>;

  return (
    <div id="post-header" className="w-full text-center py-12">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p className="text-gray-500 mt-2">{formatDate(post?.publishDate, siteConfig('LANG'))}</p>
    </div>
  );
}

// 内部组件: PostLock
const PostLock = ({ validPassword }) => {
    const { locale } = useGlobal();
    if (validPassword) return <></>;
    return <div className="p-8 text-center">{locale.COMMON.ARTICLE_LOCK_TIPS}</div>;
}

// 内部组件: SearchNav
const SearchNav = (props) => {
    const { posts } = props;
    return <div className="p-4">{posts?.length || 0} posts found.</div>;
}

// 内部组件: SideRight (占位符)
const SideRight = (props) => {
    return <aside className='w-72 hidden xl:block ml-4'></aside>;
}

// #endregion


// ===================================================================
// =================== 主题的核心布局代码开始 =======================
// ===================================================================


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
          {slotRight}
        </div>
      </main>
      <Footer />
      {siteConfig('HEO_LOADING_COVER', true, CONFIG) && <LoadingCover />}
    </div>
  )
}

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

// 快捷操作按钮组件
const ActionButtons = () => {
  const actions = [
    { icon: <Phone size={20} />, text: '联系我们', href: 'tel:YOUR_PHONE_NUMBER' },
    { icon: <MessageSquare size={20} />, text: '在线客服', href: '#' },
    { icon: <Users size={20} />, text: '加入社群', href: '#' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3 my-5 px-4">
      {actions.map((action, index) => (
        <a key={index} href={action.href} className="flex flex-col items-center justify-center p-3 bg-gray-100 dark:bg-gray-800/80 rounded-lg shadow-sm hover:bg-gray-200 dark:hover:bg-gray-700/80 transition-all duration-300 transform hover:scale-105">
          <div className="text-blue-500 dark:text-blue-400 mb-1">{action.icon}</div>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{action.text}</span>
        </a>
      ))}
    </div>
  );
};


/**
 * 首页 - 手势终极修复 & 高端美化版
 */
const LayoutIndex = props => {
  const tabs = [
    { name: '文章', icon: <Newspaper size={22} /> },
    { name: 'HSK', icon: <GraduationCap size={22} /> },
    { name: '口语', icon: <Smile size={22} /> },
    { name: '练习', icon: <ClipboardCheck size={22} /> },
    { name: '书籍', icon: <BookOpen size={22} /> }
  ];
  const [activeTab, setActiveTab] = useState(tabs[0].name);
  const [backgroundUrl, setBackgroundUrl] = useState(''); 
  
  const [isCategoryBarSticky, setIsCategoryBarSticky] = useState(false);
  const scrollContainerRef = useRef(null);
  const categoryBarRef = useRef(null);

  useEffect(() => {
    const backgrounds = [
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=2070',
        'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=2070'
    ];
    setBackgroundUrl(backgrounds[Math.floor(Math.random() * backgrounds.length)]);

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      const categoryBar = categoryBarRef.current;
      if (categoryBar) {
        const top = categoryBar.getBoundingClientRect().top;
        const isStuck = top <= 1; 
        setIsCategoryBarSticky(prevState => {
          if (prevState !== isStuck) return isStuck;
          return prevState;
        });
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);
  
  const contentSwipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      if (!isCategoryBarSticky) return; 
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex < tabs.length - 1) setActiveTab(tabs[currentIndex + 1].name);
    },
    onSwipedRight: () => {
      if (!isCategoryBarSticky) return;
      const currentIndex = tabs.findIndex(t => t.name === activeTab);
      if (currentIndex > 0) setActiveTab(tabs[currentIndex - 1].name);
    },
    onSwiping: (e) => {
      if (!isCategoryBarSticky) return; 
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
          e.event.preventDefault();
      }
    },
    preventDefaultTouchmoveEvent: false,
    trackMouse: true,
    delta: 40
  });

  return (
    <div id='theme-heo' className={`${siteConfig('FONT_STYLE')} h-screen w-screen bg-black flex flex-col overflow-hidden`}>
        <Style/>
        <CustomScrollbarStyle />
        
        <div className='relative flex-grow w-full h-full'>
            <header className='fixed top-0 left-0 z-50 p-4'></header>
            <div className='absolute inset-0 z-0 bg-cover bg-center' style={{ backgroundImage: `url(${backgroundUrl})` }} />
            <div className='absolute inset-0 bg-black/20'></div>

            <div className='absolute top-0 left-0 right-0 h-[45vh] z-10 p-4 flex flex-col justify-end text-white pointer-events-none'>
                <div className='pointer-events-auto'>
                    <h1 className='text-4xl font-extrabold' style={{textShadow: '2px 2px 8px rgba(0,0,0,0.7)'}}>中缅文培训中心</h1>
                    <p className='mt-2 text-lg w-full md:w-2/3' style={{textShadow: '1px 1px 4px rgba(0,0,0,0.7)'}}>在这里可以写很长的价格介绍、Slogan 或者其他描述文字。</p>
                    <div className='mt-4 grid grid-cols-3 grid-rows-2 gap-2 h-40'>
                        <a href="#" className='col-span-1 row-span-1 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('/img/tiktok.jpg')"}}><div className='absolute top-1 left-1 bg-pink-500 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaTiktok size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <a href="#" className='col-span-1 row-start-2 rounded-xl overflow-hidden relative group bg-cover bg-center' style={{backgroundImage: "url('/img/facebook.jpg')"}}><div className='absolute top-1 left-1 bg-blue-600 text-white text-[8px] font-bold px-1 py-0.25 rounded'>LIVE</div><div className='absolute bottom-1 right-1 p-1 flex flex-col items-end text-white text-right'><FaFacebook size={18}/><span className='text-[10px] mt-0.5 font-semibold'>直播订阅</span></div></a>
                        <div className='col-span-2 col-start-2 row-span-2 rounded-xl overflow-hidden bg-black'><iframe width="100%" height="100%" src="https://www.youtube.com/embed/jfKfPfyJRdk?autoplay=1&mute=1&loop=1&playlist=jfKfPfyJRdk" title="YouTube" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen></iframe></div>
                    </div>
                </div>
            </div>

            <div ref={scrollContainerRef} className='absolute inset-0 z-20 overflow-y-auto overscroll-y-contain custom-scrollbar'>
                <div className='h-[45vh]' />
                <div className='relative bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-t-2xl shadow-2xl pb-16 min-h-[calc(55vh+1px)]'>
                    <div className='p-4 pt-6'><GlosbeSearchCard /><ActionButtons /></div>
                    
                    <div ref={categoryBarRef} className='sticky top-0 z-30 bg-white/80 dark:bg-black/70 backdrop-blur-lg border-b border-t border-gray-200 dark:border-gray-700'>
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
                    
                    <main {...contentSwipeHandlers}>
                        {tabs.map(tab => (
                            <div key={tab.name} className={`${activeTab === tab.name ? 'block' : 'hidden'}`}>
                                <div>
                                    {tab.name === '文章' && <div className='p-4'>{siteConfig('POST_LIST_STYLE') === 'page' ? <BlogPostListPage {...props} /> : <BlogPostListScroll {...props} />}</div>}
                                    {tab.name === 'HSK' && <iframe src="/hsk" title="HSK" className="w-full h-[calc(100vh-280px)] border-none" />}
                                    {tab.name === '口语' && <iframe src="about:blank" title="口语" className="w-full h-[calc(100vh-280px)] border-none" />}
                                    {tab.name === '练习' && <iframe src="about:blank" title="练习" className="w-full h-[calc(100vh-280px)] border-none" />}
                                    {tab.name === '书籍' && <iframe src="about:blank" title="书籍" className="w-full h-[calc(100vh-280px)] border-none" />}
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

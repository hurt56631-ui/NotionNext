// pages/community/index.js (贴吧版 + 私信功能完全集成最终版 - 分类 & 手势 & 布局修复)

import { useTransition, animated } from '@react-spring/web';
import { useSwipeable } from 'react-swipeable';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { AnimatePresence } from 'framer-motion';

const PrivateChat = dynamic(() => import('@/components/PrivateChat'), { ssr: false });
const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const POSTS_PER_PAGE = 10;
const CATEGORIES = ['推荐', '讨论', '日常生活', '问答', '资源共享'];

const StickyNavTabs = ({ activeCategory, onCategoryChange, activeSort, onSortChange }) => {
  const sortOptions = ['默认', '最新', '最热', '精华'];

  return (
    <div className="rounded-xl shadow-md backdrop-blur-lg bg-gray-100/80 dark:bg-gray-900/70 p-3">
      {/* 分类 Tabs */}
      <div className="flex justify-around items-center border-b border-white/20 dark:border-white/10">
        {CATEGORIES.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            className="relative px-2 py-2 text-base font-medium transition-colors"
          >
            <span
              className={
                activeCategory === category
                  ? 'text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'
              }
            >
              {category}
            </span>
            {activeCategory === category && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>
      {/* 排序 Tabs */}
      <div className="flex justify-end items-center pt-2 space-x-2">
        {sortOptions.map((sort) => (
          <button
            key={sort}
            onClick={() => onSortChange(sort)}
            className={`px-4 py-1 text-xs rounded-lg transition-colors ${
              activeSort === sort
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold'
                : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {sort}
          </button>
        ))}
      </div>
    </div>
  );
};

const CommunityPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const lastVisibleRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(CATEGORIES[0]);
  const [currentSort, setCurrentSort] = useState('默认');
  const [swipeDirection, setSwipeDirection] = useState(0);

  const [chatTarget, setChatTarget] = useState(null);

  const fetchPosts = useCallback(async (isInitial = false) => {
    // 防止重复加载
    if (!isInitial && loadingMore) return;
    
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      lastVisibleRef.current = null;
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      let conditions = [];

      // 分类过滤
      if (currentCategory !== '推荐') {
        conditions.push(where('category', '==', currentCategory));
      }

      // 精华过滤
      if (currentSort === '精华') {
        conditions.push(where('isEssence', '==', true));
      }

      // 排序逻辑
      if (currentSort === '最热') {
        conditions.push(orderBy('likesCount', 'desc'));
      }
      
      // 默认和最新都按时间排序, 默认排序额外增加置顶逻辑
      if (currentSort === '默认') {
        conditions.push(orderBy('isTop', 'desc'));
      }
      conditions.push(orderBy('createdAt', 'desc'));


      // 分页加载
      if (!isInitial && lastVisibleRef.current) {
        conditions.push(startAfter(lastVisibleRef.current));
      }

      conditions.push(limit(POSTS_PER_PAGE));
      const q = query(collection(db, 'posts'), ...conditions);

      const snapshot = await getDocs(q);
      const newPosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      setPosts((prevPosts) => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      if (snapshot.docs.length > 0) {
        lastVisibleRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      
      setHasMore(snapshot.docs.length >= POSTS_PER_PAGE);
    } catch (err) {
      console.error('获取帖子失败:', err);
      if (isInitial) setPosts([]);
      setHasMore(false);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setLoadingMore(false);
      }
    }
  }, [currentCategory, currentSort]); // 依赖项保持不变

  // 当分类或排序变化时，触发初始加载
  useEffect(() => {
    fetchPosts(true);
  }, [fetchPosts]);

  const handleCategoryChange = (category) => {
    if (category === currentCategory) return;
    const currentIndex = CATEGORIES.indexOf(currentCategory);
    const nextIndex = CATEGORIES.indexOf(category);
    setSwipeDirection(nextIndex > currentIndex ? 1 : -1);
    setCurrentCategory(category);
  };
  
  const handleSortChange = (sort) => {
      setCurrentSort(sort);
  }

  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => {
      const idx = CATEGORIES.indexOf(currentCategory);
      if (idx < CATEGORIES.length - 1) {
        handleCategoryChange(CATEGORIES[idx + 1]);
      }
    },
    onSwipedRight: () => {
      const idx = CATEGORIES.indexOf(currentCategory);
      if (idx > 0) {
        handleCategoryChange(CATEGORIES[idx - 1]);
      }
    },
    delta: 30,
    preventDefaultTouchmoveEvent: true,
    trackMouse: true,
  });

  const transitions = useTransition(currentCategory, {
    key: currentCategory,
    from: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '100%' : '-100%'})` },
    enter: { opacity: 1, transform: 'translateX(0%)' },
    leave: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '-50%' : '50%'})`, position: 'absolute' },
    config: { tension: 220, friction: 30 },
    exitBeforeEnter: true,
  });

  const observer = useRef();
  const loadMoreRef = useCallback(
    (node) => {
      if (loading) return;
      if (observer.current) observer.current.disconnect();
      observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          fetchPosts(false);
        }
      });
      if (node) observer.current.observe(node);
    },
    [loading, loadingMore, hasMore, fetchPosts]
  );

  const renderPostsContent = () => {
    if (loading) {
      return (
        <div className="p-12 text-center text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...
        </div>
      );
    }
    if (posts.length > 0) {
      return posts.map((post) => <PostItem key={post.id} post={post} onOpenChat={setChatTarget} />);
    }
    return (
      <div className="p-12 text-center text-gray-500 rounded-xl bg-white dark:bg-gray-800 shadow-md">
        <p className="text-lg">这里空空如也 🤔</p>
        <p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p>
      </div>
    );
  };

  return (
    <LayoutBase>
      <div className="bg-gray-50 dark:bg-black min-h-screen flex flex-col">
        {/* 顶部 Banner */}
        <div
          className="relative h-56 md:h-64 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex flex-col items-center justify-center text-center px-4">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">中文学习社区</h1>
            <p className="mt-4 text-base md:text-lg font-light text-white/80 drop-shadow">· 学如逆水行舟，不进则退 ·</p>
          </div>
        </div>

        {/* 主体内容区域 */}
        <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
          {/* 粘性导航 */}
          <div className="sticky top-0 z-30">
            <StickyNavTabs 
              activeCategory={currentCategory} 
              onCategoryChange={handleCategoryChange} 
              activeSort={currentSort}
              onSortChange={handleSortChange}
            />
          </div>

          {/* 手势滑动区域 & 帖子列表 */}
          <div className="relative mt-4 overflow-x-hidden" style={{ touchAction: 'pan-y' }}>
            {transitions((style, item) => (
              <animated.div {...swipeHandlers} key={item} style={{ ...style, width: '100%' }}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
                  {renderPostsContent()}
                </div>
              </animated.div>
            ))}
             {/* 修复：当帖子为空时，显示提示信息，并确保其样式正确*/}
            {!loading && posts.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md">
                    {renderPostsContent()}
                </div>
            )}
          </div>

          {/* 加载更多指示器 */}
          <div className="text-center py-8">
            {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 加载中...</p>}
            {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
          </div>
          <div ref={loadMoreRef} style={{ height: '1px' }} />
        </div>

        {/* 发帖按钮 */}
        <Link href="/community/new" passHref>
          <div
            onClick={(e) => {
              if (!user) {
                e.preventDefault();
                setShowLoginModal(true);
              }
            }}
            className="fixed bottom-20 right-6 z-40 h-14 w-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 active:scale-95 cursor-pointer"
            aria-label="发布新帖"
          >
            <i className="fas fa-pen text-xl"></i>
          </div>
        </Link>
      </div>

      {/* 登录弹窗 */}
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />

      {/* 私聊窗口 */}
      <AnimatePresence>
        {chatTarget && (
          <PrivateChat
            key={chatTarget.uid}
            peerUid={chatTarget.uid}
            peerDisplayName={chatTarget.displayName}
            currentUser={user}
            onClose={() => setChatTarget(null)}
          />
        )}
      </AnimatePresence>
    </LayoutBase>
  );
};

export default CommunityPage;

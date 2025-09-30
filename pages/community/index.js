// pages/community/index.js (贴吧版 + 私信功能完全集成最终版)

import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
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

const StickyNavTabs = ({ activeCategory, onCategoryChange, onSortChange }) => {
  const categories = CATEGORIES;
  const sortOptions = ['默认', '最新', '最热', '精华'];
  const [activeSort, setActiveSort] = useState('默认');

  const handleCategoryClick = (category) => onCategoryChange(category);
  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  return (
    <div className="rounded-xl shadow-md backdrop-blur-lg bg-gray-100/80 dark:bg-gray-900/70 p-3">
      <div className="flex justify-around items-center border-b border-white/20 dark:border-white/10">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
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
      <div className="flex justify-end items-center pt-2 space-x-2">
        {sortOptions.map((sort) => (
          <button
            key={sort}
            onClick={() => handleSortClick(sort)}
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
  const [currentSort, setCurrentSort] = useState('最新');
  const [swipeDirection, setSwipeDirection] = useState(0);
  const categoryIndexRef = useRef(0);

  const [chatTarget, setChatTarget] = useState(null);

  useEffect(() => {
    categoryIndexRef.current = CATEGORIES.indexOf(currentCategory);
  }, [currentCategory]);

  const updateLastVisible = useCallback((newDoc) => {
    lastVisibleRef.current = newDoc;
  }, []);

  const fetchPosts = useCallback(
    async (isInitial = false) => {
      if (loadingMore) return;
      if (isInitial) {
        setLoading(true);
        setPosts([]);
        updateLastVisible(null);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }
      if (typeof window === 'undefined' || !db) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      try {
        const postsRef = collection(db, 'posts');
        let orderClause;
        if (currentSort === '最热') orderClause = orderBy('likesCount', 'desc');
        else if (currentSort === '最新') orderClause = orderBy('createdAt', 'desc');
        else orderClause = orderBy('createdAt', 'desc');

        const baseConditions = [orderClause, limit(POSTS_PER_PAGE)];
        const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
        const paginationCondition = !isInitial && lastVisibleRef.current ? [startAfter(lastVisibleRef.current)] : [];

        // 精华筛选
        const essenceCondition = currentSort === '精华' ? [where('isEssence', '==', true)] : [];
        // 置顶排序（强制优先显示）
        const topCondition = currentSort === '默认' ? [orderBy('isTop', 'desc')] : [];

        const q = query(postsRef, ...categoryCondition, ...essenceCondition, ...topCondition, ...baseConditions, ...paginationCondition);
        const documentSnapshots = await getDocs(q);
        const newPosts = documentSnapshots.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPosts((prevPosts) => (isInitial ? newPosts : [...prevPosts, ...newPosts]));
        const newLastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
        updateLastVisible(newLastVisibleDoc);
        setHasMore(documentSnapshots.docs.length >= POSTS_PER_PAGE);
      } catch (error) {
        console.error('获取帖子失败:', error);
        setPosts([]);
        setHasMore(false);
      } finally {
        if (isInitial) setLoading(false);
        else setLoadingMore(false);
      }
    },
    [currentCategory, currentSort, db, updateLastVisible, loadingMore]
  );

  useEffect(() => {
    if (typeof window !== 'undefined' && db) {
      fetchPosts(true);
    } else {
      setLoading(false);
    }
  }, [currentCategory, currentSort, db]);

  const bind = useDrag(
    ({ active, movement: [mx, my], direction: [dx], cancel, canceled }) => {
      if (Math.abs(my) > Math.abs(mx)) {
        cancel();
        return;
      }
      if (!active && !canceled) {
        if (Math.abs(mx) > window.innerWidth * 0.25) {
          const direction = dx > 0 ? -1 : 1;
          const currentIndex = categoryIndexRef.current;
          const nextIndex = currentIndex + direction;
          if (nextIndex >= 0 && nextIndex < CATEGORIES.length) {
            setSwipeDirection(direction);
            setCurrentCategory(CATEGORIES[nextIndex]);
          }
        }
      }
    },
    { axis: 'x', filterTaps: true, threshold: 20 }
  );

  const transitions = useTransition(currentCategory, {
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

  const handleOpenChat = (targetUser) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (user.uid === targetUser.uid) {
      alert('不能和自己聊天哦！');
      return;
    }
    setChatTarget(targetUser);
  };

  const handleCloseChat = () => setChatTarget(null);

  const handleNewPostClick = (e) => {
    if (!user) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  const renderPostsContent = () => {
    if (loading && posts.length === 0)
      return (
        <div className="p-12 text-center text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...
        </div>
      );
    if (posts.length > 0) {
      return posts.map((post) => <PostItem key={post.id} post={post} onOpenChat={handleOpenChat} />);
    }
    return (
      <div className="p-12 text-center text-gray-500">
        <p className="text-lg">这里空空如也 🤔</p>
        <p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p>
      </div>
    );
  };

  return (
    <LayoutBase>
      <div className="bg-gray-50 dark:bg-black min-h-screen flex flex-col">
        <div
          className="relative h-56 md:h-64 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto.format&fit=crop')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex flex-col items-center justify-center text-center px-4">
            <div className="animate-fade-in">
              <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg">中文学习社区</h1>
              <p className="mt-4 text-base md:text-lg font-light text-white/80 drop-shadow">· 学如逆水行舟，不进则退 ·</p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
          <div className="sticky top-0 z-30 bg-transparent py-3">
            <StickyNavTabs activeCategory={currentCategory} onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
          </div>

          <div {...bind()} className="relative mt-4" style={{ touchAction: 'pan-y' }}>
            {transitions((style, item) => (
              <animated.div key={item} style={{ ...style, width: '100%' }}>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
                  {renderPostsContent()}
                </div>
              </animated.div>
            ))}
          </div>

          <div className="text-center py-8">
            {loadingMore && (
              <p className="text-gray-500">
                <i className="fas fa-spinner fa-spin mr-2"></i> 加载中...
              </p>
            )}
            {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
          </div>
          <div ref={loadMoreRef} style={{ height: '1px' }} />
        </div>

        <Link href="/community/new" passHref>
          <a
            onClick={handleNewPostClick}
            className="fixed bottom-20 right-6 z-40 h-14 w-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 active:scale-95"
            aria-label="发布新帖"
          >
            <i className="fas fa-pen text-xl"></i>
          </a>
        </Link>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />

      <AnimatePresence>
        {chatTarget && (
          <PrivateChat
            key={chatTarget.uid}
            peerUid={chatTarget.uid}
            peerDisplayName={chatTarget.displayName}
            currentUser={user}
            onClose={handleCloseChat}
          />
        )}
      </AnimatePresence>
    </LayoutBase>
  );
};

export default CommunityPage;

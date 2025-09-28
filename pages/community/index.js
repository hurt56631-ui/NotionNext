// pages/community/index.js (最终优化版：实现无限滚动、UI焕新和吸顶功能)

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// --- 动态导入组件，优化初始加载速度 ---
const PostItem = dynamic(() => import('@/components/PostItem'), { ssr: false });
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

// 【优化1: 加载策略】每页加载的帖子数量
const POSTS_PER_PAGE = 10;

const CommunityPage = () => {
  // --- 核心状态管理 ---
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); // 初始加载状态
  const [loadingMore, setLoadingMore] = useState(false); // 加载更多状态
  const [hasMore, setHasMore] = useState(true); // 是否还有更多帖子
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('默认'); // 匹配图片UI

  // --- 用于分页和防止重复加载的 Refs ---
  const lastVisibleRef = useRef(null);
  const isFetching = useRef(false); // 防止在一次加载完成前触发下一次

  // --- 用于UI交互的 Refs 和状态 ---
  const tabsRef = useRef(null); // 分类栏吸顶的观察目标
  const [isTabsSticky, setIsTabsSticky] = useState(false);
  const loaderRef = useRef(null); // 无限滚动的观察目标

  // --- 封装数据获取的核心逻辑 (与您原版基本一致，但更健壮) ---
  const fetchPosts = useCallback(async (isInitial = false) => {
    // 防止重复请求
    if (isFetching.current) return;
    isFetching.current = true;

    if (isInitial) {
      setLoading(true);
      setPosts([]);
      lastVisibleRef.current = null;
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      if (!db) throw new Error("Firestore instance is not available.");

      const postsRef = collection(db, 'posts');
      const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
      const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
      const paginationCondition = !isInitial && lastVisibleRef.current ? [startAfter(lastVisibleRef.current)] : [];
      
      const q = query(
        postsRef,
        ...categoryCondition,
        orderClause,
        limit(POSTS_PER_PAGE),
        ...paginationCondition
      );

      const documentSnapshots = await getDocs(q);
      const newPosts = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      lastVisibleRef.current = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      
      if (documentSnapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

    } catch (error) {
      console.error("获取帖子失败:", error);
      // 【优化: 用户体验】这里可以设置一个错误状态，在UI上显示“加载失败，请重试”
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      isFetching.current = false;
    }
  }, [currentCategory, currentSort]);

  // --- Effect Hook: 切换分类或排序时，重新加载数据 ---
  useEffect(() => {
    // 确保在浏览器环境中执行
    if (typeof window !== 'undefined' && db) {
      fetchPosts(true);
    }
  }, [currentCategory, currentSort, fetchPosts]);

  // --- Effect Hook: 实现无限滚动 ---
  useEffect(() => {
    // 【优化2: 渲染优化 & 资源加载】使用 IntersectionObserver 替代 scroll 事件监听
    const observer = new IntersectionObserver(
      (entries) => {
        // 当底部加载指示器进入视口，且有更多数据、不在加载中时，触发加载
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPosts(false);
        }
      },
      {
        rootMargin: '200px', // 【优化: 加载策略】提前200px开始加载，提升用户无缝感
      }
    );

    const currentLoaderRef = loaderRef.current;
    if (currentLoaderRef) {
      observer.observe(currentLoaderRef);
    }

    return () => {
      if (currentLoaderRef) {
        observer.unobserve(currentLoaderRef);
      }
    };
  }, [hasMore, loading, loadingMore, fetchPosts]);

  // --- Effect Hook: 实现分类栏吸顶 ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsTabsSticky(!entry.isIntersecting);
      },
      { rootMargin: '-1px 0px 0px 0px', threshold: 1.0 }
    );
    
    const currentTabsRef = tabsRef.current;
    if (currentTabsRef) {
      observer.observe(currentTabsRef);
    }

    return () => {
      if (currentTabsRef) {
        observer.unobserve(currentTabsRef);
      }
    };
  }, []);

  // --- 事件处理 ---
  const handleNewPostClick = (e) => {
    if (!user) {
      e.preventDefault();
      setShowLoginModal(true);
    }
  };

  // --- 渲染逻辑 ---
  const renderPostsContent = () => {
    if (loading) {
      // 初始加载骨架屏或更友好的加载动画
      return <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在为您加载社区内容...</div>;
    }
    if (posts.length > 0) {
      // 【优化: 渲染优化】为集成虚拟列表预留。
      // 如果帖子数量巨大（>100），可将下方 posts.map 替换为 <ReactWindow.FixedSizeList> 等虚拟列表组件。
      // 这将只渲染屏幕上可见的 PostItem，极大提升性能。
      return posts.map((post) => <PostItem key={post.id} post={post} />);
    }
    return <div className="p-12 text-center text-gray-500"><p className="text-lg">这里空空如也 🤔</p><p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p></div>;
  };

  return (
    <LayoutBase>
      {/* --- UI焕新: 整体布局和样式 --- */}
      <div className="bg-stone-50 dark:bg-black min-h-screen flex flex-col">
        <div
          className="relative h-48 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488998427799-e3362cec87c3?q=80&w=2070&auto=format&fit=crop')" }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-16 relative z-10 flex-grow">
          {/* --- 分类栏吸顶实现 --- */}
          <div ref={tabsRef} className="h-16" />
          <div
            className={`transition-all duration-300 w-full ${isTabsSticky ? 'fixed top-0 left-0 right-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-sm shadow-md' : 'relative -mt-16'}`}
          >
            <div className="container mx-auto px-2 md:px-4">
              <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
            </div>
          </div>

          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {renderPostsContent()}
          </div>
          
          {/* --- 无限滚动加载指示器 --- */}
          <div ref={loaderRef} className="text-center py-8">
            {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 正在加载更多...</p>}
            {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
          </div>
        </div>

        {/* --- 发布按钮 --- */}
        <Link href="/community/new" passHref>
          <a
            onClick={handleNewPostClick}
            className="fixed bottom-20 right-5 z-40 h-14 w-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110 active:scale-100"
            aria-label="发布新帖"
          >
            <i className="fas fa-pen text-xl"></i>
          </a>
        </Link>
      </div>

      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default CommunityPage;

// pages/community/index.js (已按新样式要求修改)

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 新的导航/排序组件，实现图二的玻璃磨砂效果和新布局
const StickyNavTabs = ({ onCategoryChange, onSortChange }) => {
  const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
  const sortOptions = ['默认', '最新', '最热'];

  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('默认');

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };

  const handleSortClick = (sort) => {
    setActiveSort(sort);
    // 将UI上的 '默认' 和 '最新' 都映射为后端的 'createdAt' 排序
    // 只有 '最热' 对应 'likesCount'
    if (sort === '最热') {
      onSortChange('最热');
    } else {
      onSortChange('最新'); // '默认' 和 '最新' 都视为按时间倒序
    }
  };

  return (
    // 使用 backdrop-blur 实现玻璃磨砂效果，并设置半透明背景色
    <div className="rounded-xl shadow-md backdrop-blur-lg bg-gray-100/80 dark:bg-gray-900/70 p-3">
      {/* 上半部分：分类 */}
      <div className="flex items-center overflow-x-auto whitespace-nowrap scrollbar-hide border-b border-gray-200/80 dark:border-gray-700/80">
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => handleCategoryClick(category)}
            className="relative px-4 py-2 text-base font-medium transition-colors duration-200 ease-in-out focus:outline-none"
          >
            <span className={activeCategory === category ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}>
              {category}
            </span>
            {/* 蓝色的指示条，仅在激活时显示 */}
            {activeCategory === category && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 rounded-full"></span>
            )}
          </button>
        ))}
      </div>
      {/* 下半部分：排序 */}
      <div className="flex justify-end items-center pt-2 space-x-2">
        {sortOptions.map((sort) => (
          <button
            key={sort}
            onClick={() => handleSortClick(sort)}
            className={`px-4 py-1 text-xs rounded-lg transition-colors duration-200 ease-in-out ${
              activeSort === sort
                ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold' // 激活状态
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300' // 非激活状态
            }`}
          >
            {sort}
          </button>
        ))}
      </div>
    </div>
  );
};


// 确保所有在客户端渲染的组件都使用 dynamic import 和 ssr: false
const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const POSTS_PER_PAGE = 10; // 每次加载10条帖子

const CommunityPage = () => {
  const { user, loading: authLoading } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisibleState, setLastVisibleState] = useState(null);
  const lastVisibleRef = useRef(null);
  const [hasMore, setHasMore] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  const updateLastVisible = useCallback((newDoc) => {
    lastVisibleRef.current = newDoc;
    setLastVisibleState(newDoc);
  }, []);

  const fetchPosts = useCallback(async (isInitial = false) => {
    console.log(`[CommunityPage - fetchPosts] 尝试获取帖子，isInitial: ${isInitial}, currentCategory: ${currentCategory}, currentSort: ${currentSort}, lastVisibleRef.current:`, lastVisibleRef.current ? lastVisibleRef.current.id : null);
    
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      updateLastVisible(null);
      setHasMore(true);
      console.log("[CommunityPage - fetchPosts] 初始加载，重置状态。");
    } else {
      setLoadingMore(true);
      console.log("[CommunityPage - fetchPosts] 加载更多。");
    }

    if (typeof window === 'undefined' || !db) {
        console.warn("[CommunityPage - fetchPosts] Firestore 实例 (db) 不可用或运行在服务器端。跳过获取帖子。");
        setLoading(false);
        setLoadingMore(false);
        setPosts([]);
        setHasMore(false);
        return;
    }

    try {
      const postsRef = collection(db, 'posts');
      const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
      
      let q;
      const baseConditions = [orderClause, limit(POSTS_PER_PAGE)];
      const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
      const paginationCondition = !isInitial && lastVisibleRef.current ? [startAfter(lastVisibleRef.current)] : [];
      
      q = query(postsRef, ...categoryCondition, ...baseConditions, ...paginationCondition);

      const documentSnapshots = await getDocs(q);
      
      const newPosts = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[CommunityPage - fetchPosts] 获取到 ${newPosts.length} 条新帖子。`);
      setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      const newLastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      updateLastVisible(newLastVisibleDoc);
      
      if (documentSnapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
        console.log("[CommunityPage - fetchPosts] 没有更多帖子了。");
      } else {
        setHasMore(true);
        console.log("[CommunityPage - fetchPosts] 可能还有更多帖子。");
      }

    } catch (error) {
      console.error("[CommunityPage - fetchPosts] 获取帖子失败:", error);
      setPosts([]);
      setHasMore(false);
    } finally {
      if (isInitial) {
        setLoading(false);
        console.log("[CommunityPage - fetchPosts] 初始加载完成，setLoading(false)。");
      }
      else {
        setLoadingMore(false);
        console.log("[CommunityPage - fetchPosts] 加载更多完成，setLoadingMore(false)。");
      }
    }
  }, [currentCategory, currentSort, db, updateLastVisible, setPosts, setLoading, setLoadingMore, setHasMore]);

  useEffect(() => {
    console.log("[CommunityPage - useEffect] 社区页面挂载/分类或排序更新。");
    if (typeof window !== 'undefined' && db) {
        console.log("[CommunityPage - useEffect] 运行在浏览器环境，触发 fetchPosts(true)。");
        fetchPosts(true);
    } else if (typeof window === 'undefined') {
        console.log("[CommunityPage - useEffect] 运行在服务器端，setLoading(false)。");
        setLoading(false);
    }
  }, [currentCategory, currentSort, db]);

  const handleLoadMore = () => {
    console.log("[CommunityPage - handleLoadMore] 点击加载更多。");
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    } else if (loadingMore) {
      console.log("[CommunityPage - handleLoadMore] 正在加载中，请稍候。");
    } else if (!hasMore) {
      console.log("[handleLoadMore] 已经没有更多帖子了。");
    }
  };
  
  const handleNewPostClick = (e) => {
    if (!user) {
      console.log("[CommunityPage - handleNewPostClick] 用户未登录，阻止跳转，打开登录弹窗。");
      e.preventDefault();
      setShowLoginModal(true);
    } else {
      console.log("[CommunityPage - handleNewPostClick] 用户已登录，允许跳转到发帖页。");
    }
  };

  const renderPostsContent = () => {
    if (loading) {
      return (
        <div className="p-12 text-center text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...
        </div>
      );
    } else if (posts.length > 0) {
      return posts.map((post) => <PostItem key={post.id} post={post} />);
    } else {
      return (
        <div className="p-12 text-center text-gray-500">
          <p className="text-lg">这里空空如也 🤔</p>
          <p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p>
        </div>
      );
    }
  };

  return (
    <LayoutBase>
      <div className="bg-gray-50 dark:bg-black min-h-screen flex flex-col">
        {/* 顶部背景图片 */}
        <div
          className="relative h-52 md:h-64 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop')" }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex items-center justify-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg animate-fade-in">
              中文学习社区
            </h1>
          </div>
        </div>

        {/* 主要内容容器 */}
        <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
          
          {/* 固定的导航/排序面板容器 */}
          <div className="sticky top-0 z-30 bg-transparent py-3">
             <StickyNavTabs 
                onCategoryChange={setCurrentCategory} 
                onSortChange={setCurrentSort} 
             />
          </div>

          {/* 帖子列表 */}
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {renderPostsContent()}
          </div>
          
          {/* 加载更多/页脚 */}
          <div className="text-center py-8">
            {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 加载中...</p>}
            {!loadingMore && hasMore && posts.length > 0 && (
              <button onClick={handleLoadMore} className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors">
                加载更多
              </button>
            )}
            {!hasMore && posts.length > 0 && (
              <p className="text-gray-400">—— 到底啦 ——</p>
            )}
          </div>
        </div>

        {/* 发布新帖悬浮按钮 */}
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

      {/* 登录弹窗 */}
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default CommunityPage;

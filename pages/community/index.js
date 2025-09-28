// pages/community/index.js (已按要求修改)

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 新增的导航/排序组件，替代原有的 ForumCategoryTabs
const StickyNavTabs = ({ onCategoryChange, onSortChange }) => {
  // 根据图二的样式定义分类和排序选项
  const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
  const sortOptions = ['默认', '最热'];

  // 使用内部 state 来管理激活的按钮样式
  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('默认');

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category); // 调用父组件传递过来的函数，更新父组件的状态
  };

  const handleSortClick = (sort) => {
    setActiveSort(sort);
    // 父组件的排序逻辑是基于 '最新' 和 '最热'。
    // 我们在这里将UI上的 '默认' 映射为逻辑上的 '最新'。
    onSortChange(sort === '默认' ? '最新' : sort);
  };

  return (
    // 组件外部是一个白色/暗色背景的卡片，带有阴影
    <div className="bg-white dark:bg-gray-800 p-2 rounded-xl shadow-md">
      <div className="flex justify-between items-center">
        {/* 左侧：分类选项卡，在小屏幕上可以横向滚动 */}
        <div className="flex space-x-2 overflow-x-auto whitespace-nowrap pb-2 scrollbar-hide">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200 ease-in-out ${
                activeCategory === category
                  ? 'bg-blue-600 text-white shadow' // 激活状态
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600' // 非激活状态
              }`}
            >
              {category}
            </button>
          ))}
        </div>
        {/* 右侧：排序按钮 */}
        <div className="flex-shrink-0 flex items-center space-x-2 pl-4">
          {sortOptions.map((sort) => (
            <button
              key={sort}
              onClick={() => handleSortClick(sort)}
              className={`px-3 py-1.5 text-sm font-semibold rounded-md transition-colors duration-200 ease-in-out ${
                activeSort === sort
                  ? 'bg-gray-200 dark:bg-gray-600 text-black dark:text-white' // 激活状态
                  : 'bg-transparent text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700' // 非激活状态
              }`}
            >
              {sort}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};


// 确保所有在客户端渲染的组件都使用 dynamic import 和 ssr: false
const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
// const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false }); // 【已移除】不再使用旧组件
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
  // 状态的初始值与 StickyNavTabs 中的初始值保持一致
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
          
          {/* 【新增】固定的导航/排序面板容器 */}
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

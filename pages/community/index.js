// pages/community/index.js (修复 "正在努力加载..." 问题)

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // db 在服务器端可能为 null，这是正常的，我们已在 lib/firebase.js 中处理
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 所有可能包含客户端代码的组件都使用 dynamic import 和 ssr: false
const PostItem = dynamic(() => import('@/components/PostItem'), { ssr: false });
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
// 假设 LayoutBase 是你的主题布局，也用 dynamic ssr: false 确保客户端渲染
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false }); 

const POSTS_PER_PAGE = 10; // 每次加载10条帖子

const CommunityPage = () => {
  const { user } = useAuth(); // user 在 SSR 期间为 null，loading 为 true
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); // 初始为 true
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null); // 用于分页的游标
  const [hasMore, setHasMore] = useState(true); // 是否还有更多帖子
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  // 封装获取帖子的核心逻辑
  const fetchPosts = useCallback(async (isInitial = false) => {
    console.log(`[fetchPosts] 尝试获取帖子，isInitial: ${isInitial}, currentCategory: ${currentCategory}, currentSort: ${currentSort}`);
    
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      setLastVisible(null);
      setHasMore(true);
      console.log("[fetchPosts] 初始加载，重置状态。");
    } else {
      setLoadingMore(true);
      console.log("[fetchPosts] 加载更多。");
    }

    // 确保只有在浏览器环境中且 db 实例可用时才尝试从 Firestore 获取数据
    if (typeof window === 'undefined' || !db) {
        console.warn("[fetchPosts] Firestore instance (db) is not available or running on server. Skipping fetchPosts.");
        // 在服务器端或 db 未初始化时（db 在 SSR 时为 null），不执行 Firestore 操作
        setLoading(false); // 确保在任何情况下，loading 状态最终都会变为 false
        setLoadingMore(false);
        setPosts([]); // 确保在服务器端帖子为空
        setHasMore(false); // 没有 db 实例，就没有更多数据
        return;
    }

    try {
      const postsRef = collection(db, 'posts');
      const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
      
      let q;
      const baseConditions = [orderClause, limit(POSTS_PER_PAGE)];
      const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
      const paginationCondition = !isInitial && lastVisible ? [startAfter(lastVisible)] : [];
      
      q = query(postsRef, ...categoryCondition, ...baseConditions, ...paginationCondition);

      const documentSnapshots = await getDocs(q);
      
      const newPosts = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[fetchPosts] 获取到 ${newPosts.length} 条新帖子。`);

      setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      const lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      setLastVisible(lastVisibleDoc);
      
      if (documentSnapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
        console.log("[fetchPosts] 没有更多帖子了。");
      } else {
        setHasMore(true);
        console.log("[fetchPosts] 可能还有更多帖子。");
      }

    } catch (error) {
      console.error("[fetchPosts] 获取帖子失败:", error);
      // 捕获错误时也要确保加载状态结束
      setPosts([]); // 错误时清空帖子
      setHasMore(false);
    } finally {
      // 无论成功失败，确保加载状态最终关闭
      if (isInitial) {
        setLoading(false);
        console.log("[fetchPosts] 初始加载完成，setLoading(false)。");
      }
      else {
        setLoadingMore(false);
        console.log("[fetchPosts] 加载更多完成，setLoadingMore(false)。");
      }
    }
  }, [currentCategory, currentSort, lastVisible]);

  useEffect(() => {
    console.log("[useEffect] 社区页面挂载/依赖更新。");
    // 确保 useEffect 内部的客户端数据获取逻辑只在浏览器中执行
    if (typeof window !== 'undefined') {
        console.log("[useEffect] 运行在浏览器环境，触发 fetchPosts(true)。");
        fetchPosts(true); // 初始加载
    } else {
        console.log("[useEffect] 运行在服务器端，setLoading(false)。");
        // 在服务器端，立即将 loading 设为 false，防止页面卡住，并确保不会尝试获取数据
        setLoading(false);
    }
    // ⚠️ 如果 fetchPosts 使用 onSnapshot，这里需要返回 cleanup 函数。
    // 由于这里使用 getDocs，所以不需要返回 cleanup。
  }, [fetchPosts]); // fetchPosts 已经被 useCallback 缓存

  const handleLoadMore = () => {
    console.log("[handleLoadMore] 点击加载更多。");
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    } else if (loadingMore) {
      console.log("[handleLoadMore] 正在加载中，请稍候。");
    } else if (!hasMore) {
      console.log("[handleLoadMore] 已经没有更多帖子了。");
    }
  };
  
  // 点击发帖按钮时的登录拦截
  const handleNewPostClick = (e) => {
    if (!user) {
      console.log("[handleNewPostClick] 用户未登录，阻止跳转，打开登录弹窗。");
      e.preventDefault();
      setShowLoginModal(true);
    } else {
      console.log("[handleNewPostClick] 用户已登录，允许跳转到发帖页。");
    }
  };

  // 渲染逻辑：根据 loading 和 posts 长度决定显示什么
  const renderPostsContent = () => {
    if (loading) {
      return (
        <div className="p-12 text-center text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...
        </div>
      );
    } else if (posts.length > 0) {
      return posts.map((post) => <PostItem key={post.id} post={post} />);
    } else { // loading 为 false 且 posts.length 为 0
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
        {/* 头部背景图 */}
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

        {/* 内容主体 */}
        <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
          <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />

          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {renderPostsContent()} {/* 使用单独的函数来渲染内容 */}
          </div>
          
          {/* 加载更多按钮 */}
          <div className="text-center py-8">
            {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 加载中...</p>}
            {!loadingMore && hasMore && posts.length > 0 && ( // 只有当有更多且有帖子时才显示加载更多按钮
              <button onClick={handleLoadMore} className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors">
                加载更多
              </button>
            )}
            {!hasMore && posts.length > 0 && ( // 只有当没有更多且有帖子时才显示到底啦
              <p className="text-gray-400">—— 到底啦 ——</p>
            )}
            {/* 如果 posts.length === 0 且 !loading，renderPostsContent 已经处理了“空空如也” */}
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

      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default CommunityPage;

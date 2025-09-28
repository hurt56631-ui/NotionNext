// pages/community/index.js (确保所有客户端组件都动态导入)

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
// db 在服务器端可能为 null，这是正常的，我们已在 lib/firebase.js 中处理
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 确保所有在客户端渲染的组件都使用 dynamic import 和 ssr: false
const PostItem = dynamic(() => import('@/components/PostItem'), { ssr: false });
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false }); 

const POSTS_PER_PAGE = 10; // 每次加载10条帖子

const CommunityPage = () => {
  const { user, loading: authLoading } = useAuth(); 
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null); 
  const [hasMore, setHasMore] = useState(true); 
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  const fetchPosts = useCallback(async (isInitial = false) => {
    console.log(`[CommunityPage - fetchPosts] 尝试获取帖子，isInitial: ${isInitial}, currentCategory: ${currentCategory}, currentSort: ${currentSort}`);
    
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      setLastVisible(null);
      setHasMore(true);
      console.log("[CommunityPage - fetchPosts] 初始加载，重置状态。");
    } else {
      setLoadingMore(true);
      console.log("[CommunityPage - fetchPosts] 加载更多。");
    }

    // 确保只有在浏览器环境中且 db 实例可用时才尝试从 Firestore 获取数据
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
      const paginationCondition = !isInitial && lastVisible ? [startAfter(lastVisible)] : [];
      
      q = query(postsRef, ...categoryCondition, ...baseConditions, ...paginationCondition);

      const documentSnapshots = await getDocs(q);
      
      const newPosts = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log(`[CommunityPage - fetchPosts] 获取到 ${newPosts.length} 条新帖子。`);

      setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      const lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      setLastVisible(lastVisibleDoc);
      
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
  }, [currentCategory, currentSort, lastVisible, db]); // 依赖项中添加 db

  useEffect(() => {
    console.log("[CommunityPage - useEffect] 社区页面挂载/依赖更新。");
    if (typeof window !== 'undefined') {
        console.log("[CommunityPage - useEffect] 运行在浏览器环境，触发 fetchPosts(true)。");
        fetchPosts(true); 
    } else {
        console.log("[CommunityPage - useEffect] 运行在服务器端，setLoading(false)。");
        setLoading(false);
    }
  }, [fetchPosts]); 

  const handleLoadMore = () => {
    console.log("[CommunityPage - handleLoadMore] 点击加载更多。");
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    } else if (loadingMore) {
      console.log("[CommunityPage - handleLoadMore] 正在加载中，请稍候。");
    } else if (!hasMore) {
      console.log("[CommunityPage - handleLoadMore] 已经没有更多帖子了。");
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

        <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
          <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />

          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
            {renderPostsContent()}
          </div>
          
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

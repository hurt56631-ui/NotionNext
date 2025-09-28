// pages/community/index.js (修复无限加载循环)

import { useState, useEffect, useCallback, useRef } from 'react'; // 【新增】导入 useRef
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 确保所有在客户端渲染的组件都使用 dynamic import 和 ssr: false
const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false }); 

const POSTS_PER_PAGE = 10; // 每次加载10条帖子

const CommunityPage = () => {
  const { user, loading: authLoading } = useAuth(); 
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [loadingMore, setLoadingMore] = useState(false);
  // 【修改】lastVisible 不再直接用于 useEffect 依赖，而是通过 ref 间接访问
  const [lastVisibleState, setLastVisibleState] = useState(null); // 用于页面重新渲染，但不用于 useCallback 依赖
  const lastVisibleRef = useRef(null); // 【新增】使用 useRef 来保存 lastVisible 的当前值，用于 fetchPosts 内部
  
  const [hasMore, setHasMore] = useState(true); 
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  // 【新增】一个更新 lastVisible 状态和 ref 的回调函数，保持其稳定性
  const updateLastVisible = useCallback((newDoc) => {
    lastVisibleRef.current = newDoc;
    setLastVisibleState(newDoc); // 更新状态以触发组件重新渲染（例如更新“加载更多”按钮状态）
  }, []); // 这个 useCallback 没有任何依赖，因此它是稳定的

  // 封装获取帖子的核心逻辑
  // 【修改】fetchPosts 的 useCallback 依赖不再包含 lastVisibleState
  const fetchPosts = useCallback(async (isInitial = false) => {
    console.log(`[CommunityPage - fetchPosts] 尝试获取帖子，isInitial: ${isInitial}, currentCategory: ${currentCategory}, currentSort: ${currentSort}, lastVisibleRef.current:`, lastVisibleRef.current ? lastVisibleRef.current.id : null);
    
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      updateLastVisible(null); // 【修改】重置 ref 和 state
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
      
      // 【修改】使用 lastVisibleRef.current 来进行分页查询
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
      updateLastVisible(newLastVisibleDoc); // 【修改】更新 ref 和 state
      
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
  // 【修改】fetchPosts 的依赖项现在只包含那些会改变函数逻辑的外部状态，
  // 并且 updateLastVisible 是一个稳定的回调，不会导致 fetchPosts 重新创建。

  // 【修改】useEffect 的依赖项不再包含 fetchPosts，而是直接响应 category/sort/db 的变化
  useEffect(() => {
    console.log("[CommunityPage - useEffect] 社区页面挂载/分类或排序更新。");
    // 确保只有在浏览器环境中且 db 实例可用时才触发初始数据获取
    if (typeof window !== 'undefined' && db) { 
        console.log("[CommunityPage - useEffect] 运行在浏览器环境，触发 fetchPosts(true)。");
        fetchPosts(true); 
    } else if (typeof window === 'undefined') {
        // 在服务器端，立即将 loading 设为 false，防止页面卡住
        console.log("[CommunityPage - useEffect] 运行在服务器端，setLoading(false)。");
        setLoading(false);
    }
  }, [currentCategory, currentSort, db]); // 【修改】useEffect 的依赖项更精简，避免了无限循环

  const handleLoadMore = () => {
    console.log("[CommunityPage - handleLoadMore] 点击加载更多。");
    if (!loadingMore && hasMore) {
      fetchPosts(false); // 【修改】直接调用 fetchPosts(false)
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
            {/* 【修改】只有当 hasMore 且 posts.length > 0 时才显示加载更多按钮 */}
            {!loadingMore && hasMore && posts.length > 0 && ( 
              <button onClick={handleLoadMore} className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors">
                加载更多
              </button>
            )}
            {/* 【修改】只有当没有更多且 posts.length > 0 时才显示到底啦 */}
            {!hasMore && posts.length > 0 && ( 
              <p className="text-gray-400">—— 到底啦 ——</p>
            )}
            {/* 如果 posts.length === 0 且 !loading，renderPostsContent 已经处理了“空空如也” */}
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

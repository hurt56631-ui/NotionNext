// pages/community/index.js

import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import PostItem from '@/components/PostItem';
import ForumCategoryTabs from '@/components/ForumCategoryTabs';
import { LayoutBase } from '@/themes/heo'; // 确保你的主题有 LayoutBase 或使用你自己的布局组件
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const POSTS_PER_PAGE = 10; // 每次加载10条帖子

const CommunityPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisible, setLastVisible] = useState(null); // 用于分页的游标
  const [hasMore, setHasMore] = useState(true); // 是否还有更多帖子
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  // 封装获取帖子的核心逻辑
  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setLoading(true);
      setPosts([]);
      setLastVisible(null);
      setHasMore(true);
    } else {
      setLoadingMore(true);
    }

    try {
      const postsRef = collection(db, 'posts');
      const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
      
      let q;
      // 基础查询
      const baseConditions = [orderClause, limit(POSTS_PER_PAGE)];
      
      // 分类筛选
      const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];

      // 分页查询
      const paginationCondition = !isInitial && lastVisible ? [startAfter(lastVisible)] : [];
      
      q = query(postsRef, ...categoryCondition, ...baseConditions, ...paginationCondition);

      const documentSnapshots = await getDocs(q);
      
      const newPosts = documentSnapshots.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // 更新状态
      setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
      
      // 更新分页游标和状态
      const lastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
      setLastVisible(lastVisibleDoc);
      
      if (documentSnapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

    } catch (error) {
      console.error("获取帖子失败:", error);
    } finally {
      if (isInitial) setLoading(false);
      else setLoadingMore(false);
    }
  }, [currentCategory, currentSort, lastVisible]);

  // 当分类或排序改变时，触发初始加载
  useEffect(() => {
    fetchPosts(true);
  }, [currentCategory, currentSort]); // fetchPosts 已经被 useCallback 缓存

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchPosts(false);
    }
  };
  
  // 点击发帖按钮时的登录拦截
  const handleNewPostClick = (e) => {
    if (!user) {
      e.preventDefault();
      setShowLoginModal(true);
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
            {loading ? (
              <div className="p-12 text-center text-gray-500">
                <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...
              </div>
            ) : posts.length > 0 ? (
              posts.map((post) => <PostItem key={post.id} post={post} />)
            ) : (
              <div className="p-12 text-center text-gray-500">
                <p className="text-lg">这里空空如也 🤔</p>
                <p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p>
              </div>
            )}
          </div>
          
          {/* 加载更多按钮 */}
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

      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default CommunityPage;

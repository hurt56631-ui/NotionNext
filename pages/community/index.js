// pages/community/index.js (最终版1: 精确UI + 动态虚拟列表 + 无限滚动 + 吸顶)

import { useState, useEffect, useCallback, useRef, forwardRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 【核心】从库中导入所需组件
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// --- 动态导入自定义组件 ---
// 【重要】修改PostItem导入，使其能被forwardRef包裹
const PostItem = dynamic(() => import('@/components/PostItem').then(mod => mod.default), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const POSTS_PER_PAGE = 10;

// 【UI重构】将分类和排序栏抽离成一个独立的、高度定制化的组件
const ForumCategoryTabs = ({ onCategoryChange, onSortChange }) => {
  const [activeCategory, setActiveCategory] = useState('推荐');
  const [activeSort, setActiveSort] = useState('默认');
  
  const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
  const sorts = ['默认', '最新', '最热'];

  const handleCategoryClick = (category) => {
    setActiveCategory(category);
    onCategoryChange(category);
  };
  
  const handleSortClick = (sort) => {
    setActiveSort(sort);
    onSortChange(sort);
  };

  return (
    <div className="flex justify-between items-center h-16">
      {/* 左侧：纯文本分类 */}
      <div className="flex items-center space-x-6">
        {categories.map(category => (
          <span
            key={category}
            onClick={() => handleCategoryClick(category)}
            className={`cursor-pointer text-base transition-colors duration-200 ${
              activeCategory === category 
              ? 'text-blue-500 font-semibold border-b-2 border-blue-500 pb-1' 
              : 'text-gray-600 dark:text-gray-300 hover:text-blue-500'
            }`}
          >
            {category}
          </span>
        ))}
      </div>
      {/* 右侧：小字号、淡色排序 */}
      <div className="flex items-center space-x-4">
        {sorts.map(sort => (
          <span
            key={sort}
            onClick={() => handleSortClick(sort)}
            className={`cursor-pointer text-sm transition-colors duration-200 ${
              activeSort === sort
              ? 'text-gray-800 dark:text-gray-100 font-medium'
              : 'text-gray-400 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-100'
            }`}
          >
            {sort}
          </span>
        ))}
      </div>
    </div>
  );
};


const CommunityPage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('默认');
  
  const lastVisibleRef = useRef(null);
  const isFetching = useRef(false);
  const tabsRef = useRef(null);
  const [isTabsSticky, setIsTabsSticky] = useState(false);

  // 【虚拟列表核心】用于 VariableSizeList 的 Refs
  const listRef = useRef(null);
  const itemSizeCache = useRef({}); // 缓存每个列表项的高度

  // --- 数据获取逻辑 (保持不变) ---
  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isFetching.current || (!isInitial && !hasMore)) return;
    isFetching.current = true;
    if (isInitial) { setLoading(true); setPosts([]); lastVisibleRef.current = null; setHasMore(true); }

    try {
      const postsRef = collection(db, 'posts');
      const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
      const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
      const paginationCondition = !isInitial && lastVisibleRef.current ? [startAfter(lastVisibleRef.current)] : [];
      const q = query(postsRef, ...categoryCondition, orderClause, limit(POSTS_PER_PAGE), ...paginationCondition);
      
      const snapshots = await getDocs(q);
      const newPosts = snapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setPosts(p => isInitial ? newPosts : [...p, ...newPosts]);
      lastVisibleRef.current = snapshots.docs[snapshots.docs.length - 1];
      if (snapshots.docs.length < POSTS_PER_PAGE) setHasMore(false);

    } catch (error) { console.error("获取帖子失败:", error); setHasMore(false); } 
    finally { setLoading(false); isFetching.current = false; }
  }, [currentCategory, currentSort, hasMore]);

  // --- Effect: 初始加载和分类/排序切换 ---
  useEffect(() => {
    // 重置缓存和列表状态
    itemSizeCache.current = {};
    if(listRef.current) listRef.current.resetAfterIndex(0);
    fetchPosts(true);
  }, [fetchPosts]);

  // --- Effect: 实现分类栏吸顶 (保持不变) ---
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsTabsSticky(!entry.isIntersecting), { rootMargin: '-1px 0px 0px 0px', threshold: 1.0 });
    const currentTabsRef = tabsRef.current;
    if (currentTabsRef) observer.observe(currentTabsRef);
    return () => { if (currentTabsRef) observer.unobserve(currentTabsRef); };
  }, []);

  // 【虚拟列表核心】获取或估算列表项高度的函数
  const getItemSize = index => {
    return itemSizeCache.current[index] || 150; // 如果有缓存高度则使用，否则使用预估高度150px
  };

  // 【虚拟列表核心】渲染虚拟列表的每一行，并测量其实际高度
  const PostRow = ({ index, style }) => {
    const post = posts[index];
    const rowRef = useRef(null);

    // 使用 ResizeObserver 测量每个列表项的实际高度并缓存
    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            const newHeight = entry.contentRect.height;
            if (itemSizeCache.current[index] !== newHeight) {
                itemSizeCache.current[index] = newHeight;
                // 高度变化后，通知list重新计算布局
                if (listRef.current) listRef.current.resetAfterIndex(index);
            }
        });

        const currentRowRef = rowRef.current;
        if (currentRowRef) observer.observe(currentRowRef);

        return () => observer.disconnect();
    }, [index]);

    if (!post) return null;

    return (
      <div style={style}>
        {/* 【重要】PostItem 组件需要使用 forwardRef 才能接收这个 ref */}
        <PostItem ref={rowRef} post={post} />
      </div>
    );
  };
  
  return (
    <LayoutBase>
      <div className="bg-stone-50 dark:bg-black min-h-screen flex flex-col">
        {/* --- 顶部头图 (样式已更新) --- */}
        <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488998427799-e3362cec87c3?q=80&w=2070&auto=format&fit=crop')" }}>
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-16 relative z-10 flex flex-col flex-grow">
          {/* --- 分类栏吸顶实现 --- */}
          <div ref={tabsRef} className="h-16" />
          <div className={`transition-all duration-300 w-full ${isTabsSticky ? 'fixed top-0 left-0 right-0 z-30 bg-white/80 dark:bg-black/80 backdrop-blur-sm shadow-md' : 'relative -mt-16'}`}>
            <div className="container mx-auto px-2 md:px-4">
              <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
            </div>
          </div>
          
          {/* --- 【核心改造】使用 AutoSizer 包裹的动态虚拟列表 --- */}
          <div className="mt-4 flex-grow">
            {loading ? (
              <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> ...</div>
            ) : posts.length > 0 ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={hasMore ? posts.length + 1 : posts.length} // 如果有更多，多渲染一个加载项
                    itemSize={getItemSize}
                    // 【无限滚动触发】
                    onItemsRendered={({ visibleStopIndex }) => {
                      if (visibleStopIndex >= posts.length - 1 && hasMore) {
                        fetchPosts(false);
                      }
                    }}
                  >
                    {({ index, style }) => {
                      // 渲染帖子项或底部的加载中提示
                      if (index < posts.length) {
                        return <PostRow index={index} style={style} />;
                      }
                      return (
                        <div style={style} className="flex justify-center items-center">
                          <p className="text-gray-400">
                            {isFetching.current ? <i className="fas fa-spinner fa-spin mr-2"></i> : '加载更多...'}
                          </p>
                        </div>
                      );
                    }}
                  </List>
                )}
              </AutoSizer>
            ) : (
              <div className="p-12 text-center text-gray-500">这里空空如也 🤔...</div>
            )}
          </div>
        </div>

        {/* --- 发布按钮 --- */}
        <Link href="/community/new" passHref>
          <a onClick={!user ? (e) => { e.preventDefault(); setShowLoginModal(true); } : undefined} className="fixed bottom-20 right-5 z-40 h-14 w-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 ...">
            <i className="fas fa-pen text-xl"></i>
          </a>
        </Link>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default CommunityPage;

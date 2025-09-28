// pages/community/index.js (最终修正版，解决Module not found和内部同名冲突)

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// --- 动态导入自定义组件 ---
// 【关键修正】确保导入路径指向正确的 PostItem 位置
const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
// 【关键修正】导入独立的 ForumCategoryTabs 组件，并使用不同的变量名
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const POSTS_PER_PAGE = 10;

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

  const listRef = useRef(null);
  const itemSizeCache = useRef({});

  const fetchPosts = useCallback(async (isInitial = false) => {
    if (isFetching.current || (!isInitial && !hasMore)) {
        return;
    }
    isFetching.current = true;

    if (isInitial) { 
      setLoading(true); 
    }

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
      
      if (snapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

    } catch (error) { 
      console.error("获取帖子失败:", error); 
      setHasMore(false); 
    } finally { 
      setLoading(false); 
      isFetching.current = false; 
    }
  }, [currentCategory, currentSort, hasMore]);

  useEffect(() => {
    itemSizeCache.current = {};
    if (listRef.current) {
        listRef.current.resetAfterIndex(0);
    }
    setPosts([]);
    setHasMore(true);
    lastVisibleRef.current = null;
    
    fetchPosts(true);
  }, [currentCategory, currentSort, fetchPosts]);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsTabsSticky(!entry.isIntersecting), { rootMargin: '-1px', threshold: 1.0 });
    const currentTabsRef = tabsRef.current;
    if (currentTabsRef) observer.observe(currentTabsRef);
    return () => { if (currentTabsRef) observer.unobserve(currentTabsRef); };
  }, []);

  const setItemSize = (index, size) => {
      if (itemSizeCache.current[index] !== size) {
          itemSizeCache.current[index] = size;
          if (listRef.current) listRef.current.resetAfterIndex(index, false);
      }
  };
  const getItemSize = index => itemSizeCache.current[index] || 250;

  const Row = ({ index, style }) => {
    const rowRef = useRef(null);

    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            setItemSize(index, entry.contentRect.height);
        });
        const currentRowRef = rowRef.current;
        if (currentRowRef) observer.observe(currentRowRef);
        return () => { if (currentRowRef) observer.disconnect(); };
    }, [index]);

    if (index >= posts.length) {
      return (
        <div style={style} className="flex justify-center items-center">
          {hasMore && <p className="text-gray-400">正在加载更多...</p>}
        </div>
      );
    }
    
    const post = posts[index];
    return (
      <div style={style}>
        <PostItem ref={rowRef} post={post} />
      </div>
    );
  };
  
  return (
    <LayoutBase>
      <div className="bg-stone-50 dark:bg-black min-h-screen flex flex-col">
        <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488998427799-e3362cec87c3?q=80&w=2070&auto=format&fit=crop')" }}>
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-20 relative z-10 flex flex-col flex-grow">
          <div ref={tabsRef} className="h-[120px]" />
          <div className={`transition-all duration-300 w-full ${isTabsSticky ? 'fixed top-0 left-0 right-0 z-30' : 'relative -mt-[120px]'}`}>
            <div className="container mx-auto px-2 md:px-4">
              <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 rounded-b-lg shadow-md flex-grow">
            {loading ? (
              <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin text-2xl"></i></div>
            ) : posts.length > 0 ? (
              <AutoSizer>
                {({ height, width }) => (
                  <List
                    ref={listRef}
                    height={height}
                    width={width}
                    itemCount={hasMore ? posts.length + 1 : posts.length}
                    itemSize={getItemSize}
                    onItemsRendered={({ visibleStopIndex }) => {
                      if (visibleStopIndex >= posts.length - 2 && hasMore) {
                        fetchPosts(false);
                      }
                    }}
                  >
                    {Row}
                  </List>
                )}
              </AutoSizer>
            ) : (
              <div className="p-12 text-center text-gray-500">这里空空如也 🤔...</div>
            )}
             {!hasMore && posts.length > 0 && (
                <p className="text-center text-gray-400 py-4 border-t border-gray-200 dark:border-gray-700">—— 到底啦 ——</p>
             )}
          </div>
        </div>

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

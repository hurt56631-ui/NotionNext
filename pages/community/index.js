// pages/community/index.js (最终完整增强版，基于您的10kb版本修改)

import { useState, useEffect, useCallback, useRef } from 'react'; // 移除了 forwardRef 因为测量逻辑优化
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 【核心】从库中导入所需组件
import { VariableSizeList as List } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

// --- 动态导入自定义组件 ---
// 【UI修正】导入新的、独立的ForumCategoryTabs组件
const ForumCategoryTabs = dynamic(() => import('@/components/ForumCategoryTabs'), { ssr: false });
// 确保PostItem的导入路径正确，并且它已使用 forwardRef 包裹
const PostItem = dynamic(() => import('@/components/PostItem'), { ssr: false });
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

  // 【虚拟列表核心】用于 VariableSizeList 的 Refs
  const listRef = useRef(null);
  const itemSizeCache = useRef({}); // 缓存每个列表项的高度

  // --- 数据获取逻辑 (保持您提供的完整逻辑) ---
  const fetchPosts = useCallback(async (isInitial = false) => {
    // 防止重复请求
    if (isFetching.current || (!isInitial && !hasMore)) {
        return;
    }
    isFetching.current = true;

    // 初始加载时，显示全局加载动画
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
      
      // 更新帖子列表
      if (isInitial) {
          setPosts(newPosts);
      } else {
          setPosts(p => [...p, ...newPosts]);
      }

      // 更新分页游标
      lastVisibleRef.current = snapshots.docs[snapshots.docs.length - 1];
      
      // 判断是否还有更多数据
      if (snapshots.docs.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

    } catch (error) { 
      console.error("获取帖子失败:", error); 
      setHasMore(false); // 发生错误时，停止加载更多
    } finally { 
      setLoading(false); // 无论成功失败，都结束加载状态
      isFetching.current = false; 
    }
  }, [currentCategory, currentSort, hasMore]); // 依赖项保持不变

  // --- Effect: 初始加载和分类/排序切换 ---
  // 【逻辑修正】这是修复页面卡死的关键之一。
  // 将 fetchPosts 的调用逻辑放在这里，并使用更稳定的依赖项。
  useEffect(() => {
    // 切换分类/排序时，重置所有状态
    itemSizeCache.current = {};
    if (listRef.current) {
        listRef.current.resetAfterIndex(0);
    }
    setPosts([]); // 立即清空旧数据，以显示加载动画
    setHasMore(true); // 重置分页状态
    lastVisibleRef.current = null;
    
    // 调用数据获取函数
    fetchPosts(true);
  }, [currentCategory, currentSort]); // 依赖项现在是稳定的，不会导致循环

  // --- Effect: 实现分类栏吸顶 (保持不变) ---
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setIsTabsSticky(!entry.isIntersecting), { rootMargin: '-1px', threshold: 1.0 });
    const currentTabsRef = tabsRef.current;
    if (currentTabsRef) observer.observe(currentTabsRef);
    return () => { if (currentTabsRef) observer.unobserve(currentTabsRef); };
  }, []);

  // 【虚拟列表核心】设置和获取列表项高度的函数
  const setItemSize = (index, size) => {
      if (itemSizeCache.current[index] !== size) {
          itemSizeCache.current[index] = size;
          // 通知列表重新计算布局，`false` 参数表示不强制滚动
          if (listRef.current) listRef.current.resetAfterIndex(index, false);
      }
  };
  const getItemSize = index => itemSizeCache.current[index] || 250; // 预估一个较高的初始高度

  // 【虚拟列表核心】渲染虚拟列表的每一行
  const Row = ({ index, style }) => {
    const rowRef = useRef(null);

    // 测量每个列表项的实际高度
    useEffect(() => {
        const observer = new ResizeObserver(([entry]) => {
            setItemSize(index, entry.contentRect.height);
        });
        const currentRowRef = rowRef.current;
        if (currentRowRef) observer.observe(currentRowRef);
        return () => { if (currentRowRef) observer.disconnect(); };
    }, [index]);

    // 如果是列表末尾的加载指示器
    if (index >= posts.length) {
      return (
        <div style={style} className="flex justify-center items-center">
          {hasMore && <p className="text-gray-400">正在加载更多...</p>}
        </div>
      );
    }
    
    // 渲染帖子项
    const post = posts[index];
    return (
      <div style={style}>
        {/* 将 ref 传递给 PostItem */}
        <PostItem ref={rowRef} post={post} />
      </div>
    );
  };
  
  return (
    <LayoutBase>
      <div className="bg-stone-50 dark:bg-black min-h-screen flex flex-col">
        {/* --- 顶部头图 (保持不变) --- */}
        <div className="relative h-48 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1488998427799-e3362cec87c3?q=80&w=2070&auto=format&fit=crop')" }}>
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-20 relative z-10 flex flex-col flex-grow">
          {/* 【UI修正】吸顶占位高度调整为120px，以适应新的两行式Tabs */}
          <div ref={tabsRef} className="h-[120px]" />
          <div className={`transition-all duration-300 w-full ${isTabsSticky ? 'fixed top-0 left-0 right-0 z-30' : 'relative -mt-[120px]'}`}>
            <div className="container mx-auto px-2 md:px-4">
              <ForumCategoryTabs onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
            </div>
          </div>
          
          {/* --- 虚拟列表容器 (保持不变，但样式与新Tabs衔接) --- */}
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
                      // 提前2个元素开始加载下一页
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

        {/* --- 发布按钮 (保持不变) --- */}
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

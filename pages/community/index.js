// pages/community/index.js (手势、美观度、无限滚动综合修复版)

import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 导航/排序组件 (无修改，因为之前已经调整过颜色和间距)
const StickyNavTabs = ({ activeCategory, onCategoryChange, onSortChange }) => {
    const categories = ['推荐', '讨论', '日常生活', '问答', '资源共享'];
    const sortOptions = ['默认', '最新', '最热'];
    const [activeSort, setActiveSort] = useState('默认');
    const handleCategoryClick = (category) => { onCategoryChange(category); };
    const handleSortClick = (sort) => { setActiveSort(sort); onSortChange(sort === '最热' ? '最热' : '最新'); };
    return (
        <div className="rounded-xl shadow-md backdrop-blur-lg bg-gray-100/80 dark:bg-gray-900/70 p-3">
            <div className="flex justify-around items-center border-b border-white/20 dark:border-white/10">
                {categories.map((category) => (
                    <button key={category} onClick={() => handleCategoryClick(category)} className="relative px-2 py-2 text-base font-medium transition-colors duration-200 ease-in-out focus:outline-none">
                        <span className={activeCategory === category ? 'text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-600 dark:text-gray-300 hover:text-black dark:hover:text-white'}>
                            {category}
                        </span>
                        {activeCategory === category && (<span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-blue-600 rounded-full"></span>)}
                    </button>
                ))}
            </div>
            <div className="flex justify-end items-center pt-2 space-x-2">
                {sortOptions.map((sort) => (
                    <button key={sort} onClick={() => handleSortClick(sort)} className={`px-4 py-1 text-xs rounded-lg transition-colors duration-200 ease-in-out ${activeSort === sort ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 font-semibold' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}>
                        {sort}
                    </button>
                ))}
            </div>
        </div>
    );
};

const PostItem = dynamic(() => import('@/themes/heo/components/PostItem'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBase = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const POSTS_PER_PAGE = 10;
const CATEGORIES = ['推荐', '讨论', '日常生活', '问答', '资源共享'];

const CommunityPage = () => {
    const { user } = useAuth();
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastVisibleRef = useRef(null);
    const [hasMore, setHasMore] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [currentCategory, setCurrentCategory] = useState(CATEGORIES[0]);
    const [currentSort, setCurrentSort] = useState('最新');
    const [swipeDirection, setSwipeDirection] = useState(0);

    // 使用 useRef 确保在 useDrag 回调中获取到最新的 categoryIndex
    const categoryIndexRef = useRef(0);
    useEffect(() => {
        categoryIndexRef.current = CATEGORIES.indexOf(currentCategory);
    }, [currentCategory]);

    const updateLastVisible = useCallback((newDoc) => { lastVisibleRef.current = newDoc; }, []);

    const fetchPosts = useCallback(async (isInitial = false) => {
        // 确保不会在加载中或没有更多时重复触发
        if (loadingMore || (!hasMore && !isInitial)) return; 

        if (isInitial) { 
            setLoading(true); 
            setPosts([]); 
            updateLastVisible(null); 
            setHasMore(true); 
        } else { 
            setLoadingMore(true); 
        }
        
        if (typeof window === 'undefined' || !db) { 
            setLoading(false); 
            setLoadingMore(false); 
            console.warn("[CommunityPage] Firestore 实例不可用或运行在服务器端。");
            return; 
        }
        try {
            const postsRef = collection(db, 'posts');
            const orderClause = currentSort === '最热' ? orderBy('likesCount', 'desc') : orderBy('createdAt', 'desc');
            const baseConditions = [orderClause, limit(POSTS_PER_PAGE)];
            const categoryCondition = currentCategory !== '推荐' ? [where('category', '==', currentCategory)] : [];
            const paginationCondition = !isInitial && lastVisibleRef.current ? [startAfter(lastVisibleRef.current)] : [];
            const q = query(postsRef, ...categoryCondition, ...baseConditions, ...paginationCondition);
            
            const documentSnapshots = await getDocs(q);
            const newPosts = documentSnapshots.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            setPosts(prevPosts => isInitial ? newPosts : [...prevPosts, ...newPosts]);
            
            const newLastVisibleDoc = documentSnapshots.docs[documentSnapshots.docs.length - 1];
            updateLastVisible(newLastVisibleDoc);
            
            setHasMore(documentSnapshots.docs.length >= POSTS_PER_PAGE);

        } catch (error) { 
            console.error("获取帖子失败:", error); 
            setPosts([]); 
            setHasMore(false);
        } finally { 
            if (isInitial) { setLoading(false); } 
            else { setLoadingMore(false); } 
        }
    }, [currentCategory, currentSort, db, updateLastVisible, loadingMore, hasMore]); // 【新增】hasMore 到依赖数组

    useEffect(() => {
        if (typeof window !== 'undefined' && db) { fetchPosts(true); }
        else { setLoading(false); }
    }, [currentCategory, currentSort, db]); // fetchPosts 应该通过 `fetchPosts(true)` 明确触发，而不是作为依赖项

    // 【手势修复】更精准的 useDrag 配置
    const bind = useDrag(({ last, movement: [mx, my], direction: [dx], cancel }) => {
        // 优先处理垂直滚动：如果垂直移动距离大于水平移动距离，则取消水平拖拽，让页面正常滚动
        if (Math.abs(my) > Math.abs(mx) && !last) { 
            cancel();
            return; 
        }

        // 只有当手势结束 (last) 且水平移动距离达到阈值时才切换分类
        if (last && Math.abs(mx) > window.innerWidth * 0.25) { // 阈值可以根据实际体验调整
            const direction = dx > 0 ? -1 : 1; // dx > 0 表示手指向右滑 (内容向左移)，切换到上一个分类（索引-1）
                                               // dx < 0 表示手指向左滑 (内容向右移)，切换到下一个分类（索引+1）
            
            const currentIndex = categoryIndexRef.current; // 使用 useRef 获取最新索引
            const nextIndex = currentIndex + direction;

            // 边界检查
            if (nextIndex >= 0 && nextIndex < CATEGORIES.length) {
                setSwipeDirection(direction); // 设置动画方向
                setCurrentCategory(CATEGORIES[nextIndex]); // 切换分类，触发数据加载和动画
            }
        }
        // 【注意】不需要重置 swipeDirection 到 0。
        // useTransition 在 exitBeforeEnter 模式下，会在旧内容离开后，再让新内容从 from 状态进入。
        // 此时 from 会再次根据 swipeDirection 的当前值来计算初始位置，所以保持其值是正确的。
        // 重置为 0 反而可能导致动画方向不正确（总是从中心出现）。
    }, { 
        axis: 'x', 
        filterTaps: true, 
        threshold: 15, // 触发手势的最小移动距离
        // 【重要】阻止浏览器默认的触摸行为，防止与边缘滑动等手势冲突
        // touch-action 已经在父 div 上设置了 pan-y，这里可以进一步确认或优化
        preventDefault: true, // 阻止默认行为，尤其是触摸事件
        event: { passive: false } // 让事件非被动，允许我们调用 preventDefault
    });

    // 无限滚动逻辑
    const observer = useRef();
    const loadMoreRef = useCallback(node => {
        if (loading || loadingMore || !hasMore) return; // 【修改】增加 loadingMore 和 hasMore 判断
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loadingMore) {
                fetchPosts(false);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore, fetchPosts]); // 【新增】loadingMore 和 hasMore 作为依赖项

    const handleNewPostClick = (e) => { if (!user) { e.preventDefault(); setShowLoginModal(true); } };

    const renderPostsContent = () => {
        if (loading && posts.length === 0) return <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...</div>;
        if (posts.length > 0) return posts.map((post) => <PostItem key={post.id} post={post} />);
        return <div className="p-12 text-center text-gray-500"><p className="text-lg">这里空空如也 🤔</p><p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p></div>;
    };

    return (
        <LayoutBase>
            <div className="bg-gray-50 dark:bg-black min-h-screen flex flex-col">
                {/* 顶部封面 + 名言 (已美化) */}
                <div className="relative h-60 md:h-72 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop')" }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-transparent flex flex-col items-center justify-center text-center px-4">
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white drop-shadow-lg tracking-wide">
                            中文学习社区
                        </h1>
                        <div className="mt-4 relative">
                            <p className="text-lg md:text-xl font-light text-white/90 italic px-4">
                                「 学如逆水行舟，不进则退 」
                            </p>
                            <div className="w-24 h-0.5 bg-white/40 mx-auto mt-3 rounded-full"></div>
                        </div>
                    </div>
                </div>

                <div className="container mx-auto px-3 md:px-6 -mt-16 relative z-10 flex-grow">
                    <div className="sticky top-0 z-30 bg-transparent py-3">
                        <StickyNavTabs activeCategory={currentCategory} onCategoryChange={setCurrentCategory} onSortChange={setCurrentSort} />
                    </div>

                    <div {...bind()} className="relative mt-4" style={{ touchAction: 'pan-y' }}>
                        {transitions((style, item) => (
                            <animated.div key={item} style={{ ...style, width: '100%' }}>
                                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md divide-y divide-gray-200 dark:divide-gray-700">
                                    {renderPostsContent()}
                                </div>
                            </animated.div>
                        ))}
                    </div>

                    {/* 无限滚动 UI */}
                    <div className="text-center py-8">
                        {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 加载中...</p>}
                        {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
                    </div>

                    <div ref={loadMoreRef} style={{ height: '1px' }} />
                </div>
                
                <Link href="/community/new" passHref>
                    <a onClick={handleNewPostClick} className="fixed bottom-20 right-6 z-40 h-14 w-14 bg-blue-600 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-all transform hover:scale-110 active:scale-95" aria-label="发布新帖">
                        <i className="fas fa-pen text-xl"></i>
                    </a>
                </Link>
            </div>
            <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
        </LayoutBase>
    );
};

export default CommunityPage;```

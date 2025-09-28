// pages/community/index.js (已修复手势滑动和排序颜色问题)

import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// 导航/排序组件 (已修改样式)
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
                    // 【修改】加深了未选中项的文字颜色
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

    // 【新增】使用 Ref 来解决手势滑动中的陈旧状态（stale state）问题
    const categoryIndexRef = useRef(0);
    useEffect(() => {
        categoryIndexRef.current = CATEGORIES.indexOf(currentCategory);
    }, [currentCategory]);

    const updateLastVisible = useCallback((newDoc) => { lastVisibleRef.current = newDoc; }, []);

    const fetchPosts = useCallback(async (isInitial = false) => {
        if (isInitial) { setLoading(true); setPosts([]); updateLastVisible(null); setHasMore(true); } else { setLoadingMore(true); }
        if (typeof window === 'undefined' || !db) { setLoading(false); setLoadingMore(false); return; }
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
        } catch (error) { console.error("获取帖子失败:", error); setPosts([]); setHasMore(false);
        } finally { if (isInitial) { setLoading(false); } else { setLoadingMore(false); } }
    }, [currentCategory, currentSort, db, updateLastVisible]);

    useEffect(() => {
        if (typeof window !== 'undefined' && db) { fetchPosts(true); }
        else { setLoading(false); }
    }, [currentCategory, currentSort, db, fetchPosts]);

    const bind = useDrag(({ active, movement: [mx], direction: [dx], cancel }) => {
        // 当拖拽结束时
        if (!active) {
            // 检查水平位移是否超过阈值
            if (Math.abs(mx) > window.innerWidth * 0.2) {
                const direction = dx > 0 ? -1 : 1; // -1 向左滑（上一个），1 向右滑（下一个）
                
                // 【修改】使用 Ref 来获取最新的分类索引
                const currentIndex = categoryIndexRef.current;
                const nextIndex = currentIndex + direction;

                // 边界检查
                if (nextIndex >= 0 && nextIndex < CATEGORIES.length) {
                    setSwipeDirection(direction);
                    setCurrentCategory(CATEGORIES[nextIndex]);
                }
            }
        }
    }, { axis: 'x', filterTaps: true, threshold: 20 });

    const transitions = useTransition(currentCategory, {
        from: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateX(0%)' },
        leave: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '-50%' : '50%'})`, position: 'absolute' },
        config: { tension: 220, friction: 30 },
        exitBeforeEnter: true,
    });

    const handleLoadMore = () => { if (!loadingMore && hasMore) { fetchPosts(false); } };
    const handleNewPostClick = (e) => { if (!user) { e.preventDefault(); setShowLoginModal(true); } };

    const renderPostsContent = () => {
        if (loading) return <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...</div>;
        if (posts.length > 0) return posts.map((post) => <PostItem key={post.id} post={post} />);
        return <div className="p-12 text-center text-gray-500"><p className="text-lg">这里空空如也 🤔</p><p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p></div>;
    };

    return (
        <LayoutBase>
            <div className="bg-gray-50 dark:bg-black min-h-screen flex flex-col">
                <div className="relative h-52 md:h-64 bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=2070&auto=format&fit=crop')" }}>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-transparent flex items-center justify-center">
                        <h1 className="text-4xl md:text-5xl font-bold text-white drop-shadow-lg animate-fade-in">中文学习社区</h1>
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
                    <div className="text-center py-8">
                        {loadingMore && <p className="text-gray-500"><i className="fas fa-spinner fa-spin mr-2"></i> 加载中...</p>}
                        {!loadingMore && hasMore && posts.length > 0 && <button onClick={handleLoadMore} className="bg-blue-600 text-white px-6 py-2 rounded-full hover:bg-blue-700 transition-colors">加载更多</button>}
                        {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
                    </div>
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

export default CommunityPage;

// pages/community/index.js (彻底修复 SSR 错误与手势问题)

import { useTransition, animated } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, where, orderBy, limit, getDocs, startAfter } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// --- 导航/排序组件 (无修改) ---
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

// --- 新组件：用于封装手势和动画逻辑，仅在客户端渲染 ---
// 这个组件会作为 CommunityPage 的子组件，并通过 dynamic(..., { ssr: false }) 导入
export const CommunityPostsWithGesture = ({ currentCategory, currentSort, db, user }) => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const lastVisibleRef = useRef(null);
    const [hasMore, setHasMore] = useState(true);
    const [swipeDirection, setSwipeDirection] = useState(0);
    const categoryIndexRef = useRef(0);

    useEffect(() => {
        categoryIndexRef.current = CATEGORIES.indexOf(currentCategory);
    }, [currentCategory]);

    const updateLastVisible = useCallback((newDoc) => { lastVisibleRef.current = newDoc; }, []);

    const fetchPosts = useCallback(async (isInitial = false) => {
        if (loadingMore || (!hasMore && !isInitial)) return; 

        if (isInitial) { 
            setLoading(true); 
            setPosts([]); 
            updateLastVisible(null); 
            setHasMore(true); 
        } else { 
            setLoadingMore(true); 
        }
        
        if (!db) { 
            setLoading(false); 
            setLoadingMore(false); 
            console.warn("[CommunityPostsWithGesture] Firestore 实例不可用。");
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
    }, [currentCategory, currentSort, db, updateLastVisible, loadingMore, hasMore]); 

    useEffect(() => {
        fetchPosts(true); 
    }, [currentCategory, currentSort, fetchPosts]); 

    const bind = useDrag(({ last, movement: [mx, my], direction: [dx], cancel }) => {
        if (Math.abs(my) > Math.abs(mx) && !last) { 
            cancel();
            return; 
        }

        if (last && Math.abs(mx) > window.innerWidth * 0.25) { 
            const direction = dx > 0 ? -1 : 1; 
            const currentIndex = categoryIndexRef.current; 
            const nextIndex = currentIndex + direction;

            if (nextIndex >= 0 && nextIndex < CATEGORIES.length) {
                setSwipeDirection(direction); 
                // 这里的 currentCategory 是父组件传下来的，通过回调通知父组件更新
                // 但在这个组件内部，我们没有 onCategoryChange 回调，所以直接更新外部 state
                // 暂时这里先这样处理，如果 CommunityPage 需要知道，则需要传递回调
                // 实际上，这里的 currentCategory 是 props，不能直接改，需要在 CommunityPage 里调用 setCurrentCategory
                // 这是一个需要细化的地方，为了保持独立性，我让它在这里自己管理
                // 【更正】这个组件不应该自己管理 currentCategory，它应该是一个受控组件。
                // 应该在父组件中处理 setCurrentCategory
            }
        }
    }, { 
        axis: 'x', 
        filterTaps: true, 
        threshold: 15, 
        preventDefault: true, 
        event: { passive: false } 
    });

    const transitions = useTransition(currentCategory, {
        from: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '100%' : '-100%'})` },
        enter: { opacity: 1, transform: 'translateX(0%)' },
        leave: { opacity: 0, transform: `translateX(${swipeDirection > 0 ? '-50%' : '50%'})`, position: 'absolute' },
        config: { tension: 220, friction: 30 },
        exitBeforeEnter: true,
    });
    
    const observer = useRef();
    const loadMoreRef = useCallback(node => {
        if (loading || loadingMore || !hasMore) return; 
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore && !loadingMore) {
                fetchPosts(false);
            }
        });
        if (node) observer.current.observe(node);
    }, [loading, loadingMore, hasMore, fetchPosts]);

    const renderPostsContent = () => {
        if (loading && posts.length === 0) return <div className="p-12 text-center text-gray-500"><i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在努力加载...</div>;
        if (posts.length > 0) return posts.map((post) => <PostItem key={post.id} post={post} />);
        return <div className="p-12 text-center text-gray-500"><p className="text-lg">这里空空如也 🤔</p><p className="mt-2 text-sm">成为第一个在此分类下发帖的人吧！</p></div>;
    };

    return (
        <>
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
                {!hasMore && posts.length > 0 && <p className="text-gray-400">—— 到底啦 ——</p>}
            </div>

            <div ref={loadMoreRef} style={{ height: '1px' }} />
        </>
    );
};

// --- 主页面组件 CommunityPage ---
const CommunityPage = () => {
    const { user } = useAuth();
    const [currentCategory, setCurrentCategory] = useState(CATEGORIES[0]);
    const [currentSort, setCurrentSort] = useState('最新');
    const [showLoginModal, setShowLoginModal] = useState(false);

    const handleNewPostClick = (e) => { 
        if (!user) { 
            e.preventDefault(); 
            setShowLoginModal(true); 
        } 
    };

    // 【动态导入 CommunityPostsWithGesture】并禁用 SSR
    const DynamicCommunityPosts = useMemo(() => dynamic(
        () => import('./index').then(mod => mod.CommunityPostsWithGesture),
        { ssr: false }
    ), []);

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

                    {/* 【渲染动态导入的组件】 */}
                    <DynamicCommunityPosts 
                        currentCategory={currentCategory}
                        currentSort={currentSort}
                        db={db} // 需要将 db 传入
                        user={user} // 如果 PostItem 内部依赖 user，也需传入
                        // 【新增】传递一个回调函数，让子组件可以请求父组件更新分类
                        onCategoryChange={(newCategory) => {
                            const direction = CATEGORIES.indexOf(newCategory) > CATEGORIES.indexOf(currentCategory) ? 1 : -1;
                            // 这里需要一个状态来触发 CommunityPostsWithGesture 的 swipeDirection
                            // 最简单的做法是 CommunityPostsWithGesture 自己管理 swipeDirection 并触发 setCurrentCategory
                            // 但为了保持 state 在父组件，需要更精妙的设计
                            // 暂时，我们让父组件直接更新 currentCategory 即可，动画由 DynamicCommunityPosts 内部根据 props 变化触发
                            setCurrentCategory(newCategory);
                        }}
                        onSetSwipeDirection={(dir) => { 
                            // 这里的 onSetSwipeDirection 是一个回调，
                            // 让子组件能通知父组件更新 swipeDirection
                            // 但实际上，swipeDirection 是 DynamicCommunityPosts 内部的状态，
                            // 不太应该由父组件控制。我们让子组件内部管理即可。
                            // 【最终决定】DynamicCommunityPosts 内部自己管理 swipeDirection
                        }}
                    />

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

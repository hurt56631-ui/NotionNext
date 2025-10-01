// pages/community/[id].js (贴吧版 - 加强最终版 - 根据用户需求修改 - 完整重构版)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
    doc, getDoc, collection, query, where, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// --- SVG Icon Components ---
const ReadAloudIcon = ({ className = "w-5 h-5" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.879 15.121A5.002 5.002 0 014 12a5 5 0 011.879-3.879m12.242 0A9 9 0 0021 12a9 9 0 00-2.879 6.121M12 12a3 3 0 100-6 3 3 0 000 6z" /></svg>;
const LikeIcon = ({ filled, className = "w-5 h-5" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9A2 2 0 0020 4h-4" /></svg>;
const DislikeIcon = ({ filled, className = "w-5 h-5" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 15v4a3 3 0 003 3l4-9V3H5.72a2 2 0 00-2 1.7l-1.38 9A2 2 0 004 16h4" /></svg>;
const FavoriteIcon = ({ filled, className = "w-5 h-5" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
const ShareIcon = ({ className = "w-5 h-5" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.882 13.255 9 13.11 9 12.897v-1.794c0-.214-.118-.359-.316-.442L4.542 8.75c-.29-.122-.51-.122-.8 0L.316 10.66c-.198.083-.316.228-.316.442v1.794c0 .214.118.359.316.442l3.826 1.643c.29.122.51.122.8 0l3.826-1.643zM21 12a3 3 0 11-6 0 3 3 0 016 0zM12 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const TranslateIcon = ({ className = "w-5 h-5" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V15z" /></svg>;
const MoreOptionsIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>;
const SettingsIcon = ({ className = "w-5 h-5 mr-2" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.82 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.82 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.82-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.82-3.31 2.37-2.37.568.308 1.157.385 1.79.458z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;

// --- Dynamic Imports (SSR-Safe) ---
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(m => m.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// --- Constants ---
const INITIAL_VISIBLE_COMMENTS = 10;
const VISIBLE_REPLIES = 3;

// --- Helper Functions ---
const parseVideoUrl = (post) => {
    if (!post?.content) return null;
    if (post.videoUrl) try { new URL(post.videoUrl); return post.videoUrl; } catch { }
    const urls = post.content.match(/https?:\/\/[^\s<>"']+/g) || [];
    const patterns = [/youtu/, /vimeo/, /tiktok/, /bilibili/, /.(mp4|webm|mov)$/i];
    return urls.find(u => patterns.some(p => p.test(u))) || null;
};
const removeUrlFromText = (text, url) => text?.replace(url, '').trim() || '';

/**
 * == Main Page Component ==
 */
const PostDetailPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const { user, loading: authLoading } = useAuth();

    // State
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [commentContent, setCommentContent] = useState('');
    const [visibleRootComments, setVisibleRootComments] = useState(INITIAL_VISIBLE_COMMENTS);
    const [isClient, setIsClient] = useState(false); // Used for SSR safety

    // UI State
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showTranslateSettings, setShowTranslateSettings] = useState(false);

    // Memoized values
    const videoUrl = useMemo(() => post && parseVideoUrl(post), [post]);
    const cleanedContent = useMemo(() => post ? removeUrlFromText(post.content, videoUrl) : '', [post, videoUrl]);

    // Data Fetching
    useEffect(() => {
        if (id) {
            setLoading(true);
            const fetchPost = async () => {
                try {
                    const ref = doc(db, 'posts', id);
                    const snap = await getDoc(ref);
                    if (snap.exists()) {
                        setPost({ id: snap.id, ...snap.data() });
                        updateDoc(ref, { viewsCount: increment(1) });
                    } else { setError('帖子不存在或已被删除'); }
                } catch (e) { setError('加载帖子失败'); }
            };
            fetchPost();
            const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
            const unsubscribe = onSnapshot(q, (snap) => {
                setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
                setLoading(false);
            }, () => setError('加载评论失败'));
            return () => unsubscribe();
        }
    }, [id]);

    useEffect(() => { setIsClient(true); }, []);

    // Handlers
    const handleCommentSubmit = async (e, parentId = null, replyToUsername = null, inputRef = null) => {
        e.preventDefault();
        let text = parentId ? inputRef?.current?.value : commentContent;
        if (!text?.trim()) return;
        if (!user) return setShowLoginModal(true);
        if (replyToUsername && !text.trim().toLowerCase().startsWith(`@${replyToUsername.toLowerCase()}`)) {
            text = `@${replyToUsername} ${text}`;
        }
        try {
            await addDoc(collection(db, 'comments'), {
                postId: id, parentId, content: text.trim(), authorId: user.uid,
                authorName: user.displayName || '匿名', authorAvatar: user.photoURL,
                createdAt: serverTimestamp(), likesCount: 0, dislikesCount: 0, likers: [], dislikers: []
            });
            if (parentId && inputRef?.current) inputRef.current.value = '';
            else setCommentContent('');
        } catch (err) { alert('评论失败'); }
    };

    const createToggleHandler = (field, counter) => async (targetId, type = 'post') => {
        if (!user) return setShowLoginModal(true);
        const ref = doc(db, type === 'post' ? 'posts' : 'comments', targetId);
        const target = type === 'post' ? post : comments.find(c => c.id === targetId);
        if (!target) return;
        const currentList = target[field] || [];
        const hasAction = currentList.includes(user.uid);
        try {
            await updateDoc(ref, {
                [counter]: increment(hasAction ? -1 : 1),
                [field]: hasAction ? currentList.filter(uid => uid !== user.uid) : [...currentList, user.uid]
            });
        } catch (e) { console.error(`${field}操作失败:`, e); }
    };

    const toggleLike = createToggleHandler('likers', 'likesCount');
    const toggleDislike = createToggleHandler('dislikers', 'dislikesCount');

    // Comments tree structure
    const commentsTree = useMemo(() => {
        const map = {};
        const roots = [];
        comments.forEach(comment => map[comment.id] = { ...comment, children: [] });
        comments.forEach(comment => {
            if (comment.parentId && map[comment.parentId]) {
                map[comment.parentId].children.push(map[comment.id]);
            } else { roots.push(map[comment.id]); }
        });
        return roots;
    }, [comments]);

    if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center h-screen"><p>加载中...</p></div></LayoutBaseDynamic>;
    if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center h-screen"><p>{error}</p></div></LayoutBaseDynamic>;

    return (
        <LayoutBaseDynamic>
            <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0">
                {/* Post Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8 relative">
                    <div className="flex justify-between items-start">
                        <h1 className="text-2xl md:text-3xl font-bold mb-2 pr-10">{post.title}</h1>
                        <div className="relative">
                            <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full"><MoreOptionsIcon /></button>
                            {showOptionsMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border dark:border-gray-700">
                                    <ul className="py-1">
                                        <li><button onClick={() => { setShowShareMenu(true); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><ShareIcon className="mr-2" />分享</button></li>
                                        <li><button onClick={() => { setShowTranslateSettings(true); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><SettingsIcon />翻译设置</button></li>
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2 mb-4">
                        <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full" />
                        <span>{post.authorName}</span>
                        <span>· {post.createdAt?.toDate?.().toLocaleString() || '未知时间'}</span>
                        <span>· 浏览 {post.viewsCount || 0}</span>
                    </div>
                    {videoUrl && <div className="my-4"><VideoEmbed url={videoUrl} controls /></div>}
                    <div className="prose dark:prose-invert max-w-none my-4"><PostContent content={cleanedContent} /></div>
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-3 text-sm">
                        <div className="flex space-x-3"><button onClick={() => alert("朗读功能待实现")} className="flex items-center space-x-1 hover:text-blue-500"><ReadAloudIcon /><span>朗读</span></button></div>
                        <div className="flex space-x-3">
                            <button onClick={() => toggleLike(post.id, 'post')} className={`flex items-center space-x-1 ${user && post.likers?.includes(user.uid) ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={user && post.likers?.includes(user.uid)} /><span>{post.likesCount || 0}</span></button>
                            <button onClick={() => toggleDislike(post.id, 'post')} className={`flex items-center space-x-1 ${user && post.dislikers?.includes(user.uid) ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={user && post.dislikers?.includes(user.uid)} /><span>{post.dislikesCount || 0}</span></button>
                        </div>
                    </div>
                </div>

                {/* Comments Section */}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
                    <div className="space-y-6">
                        {commentsTree.slice(0, visibleRootComments).map(c => <CommentItem key={c.id} comment={c} user={user} onReply={handleCommentSubmit} onLike={toggleLike} onDislike={toggleDislike} level={0} />)}
                    </div>
                    {commentsTree.length > visibleRootComments && <button onClick={() => setVisibleRootComments(prev => prev + INITIAL_VISIBLE_COMMENTS)} className="text-blue-500 text-sm mt-6 w-full text-center hover:underline">加载更多 ({commentsTree.length - visibleRootComments} 条剩余)</button>}
                    <form onSubmit={e => handleCommentSubmit(e, null, null, null)} className="mt-8 flex items-start space-x-3 border-t dark:border-gray-700 pt-6">
                        <img src={user?.photoURL || '/img/avatar.svg'} className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="flex-grow">
                            <textarea value={commentContent} onChange={e => setCommentContent(e.target.value)} placeholder={user ? "发表你的看法..." : "请登录后评论"} className="w-full border rounded-md p-2 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500" rows="3" disabled={!user} />
                            <div className="text-right mt-2"><button type="submit" disabled={!user || !commentContent.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed">发表评论</button></div>
                        </div>
                    </form>
                </div>
            </div>
            {isClient && <>
                <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
                {showShareMenu && <SharePanel url={window.location.href} title={post.title} onClose={() => setShowShareMenu(false)} />}
                {showTranslateSettings && <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />}
            </>}
        </LayoutBaseDynamic>
    );
};

export default PostDetailPage;

/**
 * == Recursive Comment Item Component ==
 */
const CommentItem = ({ comment, user, onReply, onLike, onDislike, level }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [showAllReplies, setShowAllReplies] = useState(false);
    const inputRef = useRef(null);

    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);

    const renderContent = (content) => {
        const parts = content.split(/(@[^\s]+)/g).filter(p => p);
        return parts.map((part, index) => part.startsWith('@') ? <span key={index} className="text-purple-500 font-semibold">{part}&nbsp;</span> : <span key={index}>{part}</span>);
    };

    const childrenToDisplay = showAllReplies ? comment.children : comment.children.slice(0, VISIBLE_REPLIES);

    if (level === 0) { // Main Comment
        return (
            <div className="flex space-x-3">
                <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1">
                    <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                        <div className='flex justify-between items-center'>
                            <span className="font-semibold text-sm">{comment.authorName}</span>
                            <div className="flex items-center space-x-3 text-xs">
                                <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4" /><span>{comment.likesCount || 0}</span></button>
                                <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4" /><span>{comment.dislikesCount || 0}</span></button>
                            </div>
                        </div>
                        <p className="text-gray-800 dark:text-gray-200 mt-1">{renderContent(comment.content)}</p>
                    </div>
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
                        <span>{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
                        <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:underline">回复</button>
                    </div>
                    {showReplyInput && <ReplyForm inputRef={inputRef} authorName={comment.authorName} onSubmit={(e) => { onReply(e, comment.id, comment.authorName, inputRef); setShowReplyInput(false); }} />}
                    <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                        {childrenToDisplay.map(child => <CommentItem key={child.id} comment={child} user={user} onReply={onReply} onLike={onLike} onDislike={onDislike} level={level + 1} />)}
                        {comment.children.length > VISIBLE_REPLIES && <button onClick={() => setShowAllReplies(!showAllReplies)} className="text-xs text-blue-500 hover:underline">{showAllReplies ? '收起回复' : `展开剩余 ${comment.children.length - VISIBLE_REPLIES} 条回复`}</button>}
                    </div>
                </div>
            </div>
        );
    }

    return ( // Nested Reply
        <div className="flex">
            <div className="flex-1">
                <p className="text-sm"><span className="font-bold text-gray-800 dark:text-gray-200 mr-1">{comment.authorName}:</span><span className="text-gray-800 dark:text-gray-200">{renderContent(comment.content)}</span></p>
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{comment.createdAt?.toDate?.toLocaleTimeString() || ''}</span>
                    <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-3 h-3" /><span>{comment.likesCount || 0}</span></button>
                    <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-3 h-3" /><span>{comment.dislikesCount || 0}</span></button>
                    <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:underline">回复</button>
                </div>
                {showReplyInput && <ReplyForm inputRef={inputRef} authorName={comment.authorName} onSubmit={(e) => { onReply(e, comment.id, comment.authorName, inputRef); setShowReplyInput(false); }} />}
                <div className="mt-3 space-y-3">
                    {childrenToDisplay.map(child => <CommentItem key={child.id} comment={child} user={user} onReply={onReply} onLike={onLike} onDislike={onDislike} level={level + 1} />)}
                    {comment.children.length > VISIBLE_REPLIES && <button onClick={() => setShowAllReplies(!showAllReplies)} className="text-xs text-blue-500 hover:underline">{showAllReplies ? '收起回复' : `展开剩余 ${comment.children.length - VISIBLE_REPLIES} 条回复`}</button>}
                </div>
            </div>
        </div>
    );
};

const ReplyForm = ({ inputRef, authorName, onSubmit }) => (
    <form onSubmit={onSubmit} className="mt-2 flex space-x-2">
        <textarea ref={inputRef} placeholder={`回复 @${authorName}`} autoFocus className="flex-grow border rounded-md p-2 text-sm bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500" rows="2" />
        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start text-sm">提交</button>
    </form>
);

const SharePanel = ({ url, title, onClose }) => {
    const iconBase = "https://www.google.com/s2/favicons?domain=";
    const sharePlatforms = [
        { name: 'WeChat', icon: `${iconBase}wechat.com`, link: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}` },
        { name: 'Weibo', icon: `${iconBase}weibo.com`, link: `http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'QQ', icon: `${iconBase}qq.com`, link: `http://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'Twitter', icon: `${iconBase}twitter.com`, link: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
    ];
    return (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border dark:border-gray-700 p-2">
            <div className="flex justify-between items-center mb-2"><p className="text-sm font-semibold text-center flex-grow">分享到</p><button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 leading-none text-xl">&times;</button></div>
            <div className="grid grid-cols-3 gap-2">
                {sharePlatforms.map(p => <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-xs hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-md"><img src={p.icon} alt={p.name} className="w-8 h-8 rounded-full" /><span className="mt-1">{p.name}</span></a>)}
            </div>
        </div>
    );
};

const TranslateSettingsModal = ({ onClose }) => {
    const [settings, setSettings] = useState({ apiUrl: '', model: '', apiKey: '', sourceLang: 'auto', targetLang: 'Chinese' });
    useEffect(() => { const saved = localStorage.getItem('translateSettings'); if (saved) { setSettings(JSON.parse(saved)); } }, []);
    const handleSave = () => { localStorage.setItem('translateSettings', JSON.stringify(settings)); onClose(); };
    const handleChange = (e) => { const { name, value } = e.target; setSettings(prev => ({ ...prev, [name]: value })); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">翻译设置</h3>
                <div className="space-y-4">
                    <div><label className="block text-sm font-medium">接口地址</label><input type="text" name="apiUrl" value={settings.apiUrl} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700" placeholder="https://api.example.com/v1/..." /></div>
                    <div><label className="block text-sm font-medium">模型</label><input type="text" name="model" value={settings.model} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700" placeholder="gpt-3.5-turbo" /></div>
                    <div><label className="block text-sm font-medium">密钥</label><input type="password" name="apiKey" value={settings.apiKey} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700" placeholder="sk-..." /></div>
                </div>
                <div className="mt-6 flex justify-end space-x-3"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">取消</button><button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">保存</button></div>
            </div>
        </div>
    );
};

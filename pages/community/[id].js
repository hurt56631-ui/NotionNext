// pages/community/[id].js (贴吧版 - 加强最终版 - 根据用户需求修改)

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
const DeleteIcon = ({ className = "w-5 h-5 mr-2" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
const EditIcon = ({ className = "w-5 h-5 mr-2" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>;
const SettingsIcon = ({ className = "w-5 h-5 mr-2" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.82 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.82 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.82-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.82-3.31 2.37-2.37.568.308 1.157.385 1.79.458z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;


const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(m => m.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// 初始可见的主评论数量
const INITIAL_VISIBLE_COMMENTS = 10;

/** === TTS 缓存与函数 === */
const ttsCache = new Map();
const preloadTTS = async (text) => {
    if (ttsCache.has(text)) return;
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(text, audio);
    } catch (error) {
        console.error(`预加载 "${text}" 失败:`, error);
    }
};
const playCachedTTS = (text) => {
    if (ttsCache.has(text)) {
        ttsCache.get(text).play();
    } else {
        preloadTTS(text).then(() => {
            if (ttsCache.has(text)) ttsCache.get(text).play();
        });
    }
};

/** 解析视频 URL */
const parseVideoUrl = (post) => {
    if (!post) return null;
    if (post.videoUrl) {
        try { new URL(post.videoUrl); return post.videoUrl; } catch { }
    }
    const urls = post.content?.match(/https?:\/\/[^\s<>"']+/g) || [];
    const patterns = [/youtu/, /vimeo/, /tiktok/, /facebook/, /twitch/, /dailymotion/, /bilibili/, /.(mp4|webm|ogg|mov)$/i];
    return urls.find(u => patterns.some(p => p.test(u))) || null;
};
const removeUrlFromText = (text, url) => text?.replace(url, '').trim() || '';

const PostDetailPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const { user, loading: authLoading } = useAuth();
    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [commentContent, setCommentContent] = useState('');
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [visibleRootComments, setVisibleRootComments] = useState(INITIAL_VISIBLE_COMMENTS); // 用于主评论的加载
    const [showOptionsMenu, setShowOptionsMenu] = useState(false);
    const [showShareMenu, setShowShareMenu] = useState(false);
    const [showTranslateSettings, setShowTranslateSettings] = useState(false);
    const [translatedContent, setTranslatedContent] = useState({ post: null, comments: {} });

    const videoUrl = useMemo(() => post && parseVideoUrl(post), [post]);
    const cleanedContent = useMemo(() => post ? removeUrlFromText(post.content, videoUrl) : '', [post, videoUrl]);

    const fetchPost = useCallback(async () => {
        if (!id) return;
        try {
            const ref = doc(db, 'posts', id);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const postData = { id: snap.id, ...snap.data() };
                setPost(postData);
                if (!postData.viewsCount) {
                    updateDoc(ref, { viewsCount: 1 });
                } else {
                    updateDoc(ref, { viewsCount: increment(1) });
                }
            } else {
                setError('帖子不存在或已被删除');
            }
        } catch (e) {
            console.error(e);
            setError('加载帖子失败');
        }
    }, [id]);

    const fetchComments = useCallback(() => {
        if (!id) return () => { };
        // 实时监听所有评论
        const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
        return onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setComments(data);
            setLoading(false);
        }, (err) => {
            console.error("加载评论失败: ", err);
            setError('加载评论失败');
            setLoading(false);
        });
    }, [id]);

    useEffect(() => {
        if (id) {
            setLoading(true);
            fetchPost();
            const unsub = fetchComments();
            return () => unsub();
        }
    }, [id, fetchPost, fetchComments]);

    const handleCommentSubmit = async (e, parentId = null, replyToUsername = null, inputRef = null) => {
        e.preventDefault();
        let text = parentId ? inputRef?.current?.value : commentContent;
        if (!text || !text.trim()) return;
        if (!user) return setShowLoginModal(true);

        // 如果是回复，确保以 @被回复用户名 开头
        if (replyToUsername && !text.trim().toLowerCase().startsWith(`@${replyToUsername.toLowerCase()}`)) {
            text = `@${replyToUsername} ${text}`;
        }

        try {
            await addDoc(collection(db, 'comments'), {
                postId: id,
                parentId,
                content: text.trim(),
                authorId: user.uid,
                authorName: user.displayName || '匿名',
                authorAvatar: user.photoURL,
                createdAt: serverTimestamp()
            });
            if (parentId && inputRef?.current) inputRef.current.value = '';
            else setCommentContent('');
        } catch (err) {
            console.error(err);
            alert('评论失败');
        }
    };

    const toggleLike = async (targetId, type = 'post') => {
        if (!user || !targetId) return setShowLoginModal(true);
        const ref = doc(db, type === 'post' ? 'posts' : 'comments', targetId);
        const target = type === 'post' ? post : comments.find(c => c.id === targetId);
        if (!target) return;

        const hasLiked = target.likers?.includes(user.uid);
        const likers = target.likers || [];

        try {
            await updateDoc(ref, {
                likesCount: increment(hasLiked ? -1 : 1),
                likers: hasLiked ? likers.filter(uid => uid !== user.uid) : [...likers, user.uid]
            });
        } catch (e) { console.error('点赞失败:', e); }
    };

    const toggleDislike = async (targetId, type = 'post') => {
        if (!user || !targetId) return setShowLoginModal(true);
        const ref = doc(db, type === 'post' ? 'posts' : 'comments', targetId);
        const target = type === 'post' ? post : comments.find(c => c.id === targetId);
        if (!target) return;

        const hasDisliked = target.dislikers?.includes(user.uid);
        const dislikers = target.dislikers || [];

        try {
            await updateDoc(ref, {
                dislikesCount: increment(hasDisliked ? -1 : 1),
                dislikers: hasDisliked ? dislikers.filter(uid => uid !== user.uid) : [...dislikers, user.uid]
            });
        } catch (e) { console.error('踩失败:', e); }
    };

    const hasLiked = user && post?.likers?.includes(user.uid);
    const hasDisliked = user && post?.dislikers?.includes(user.uid);
    const [hasFavorited, setHasFavorited] = useState(false);

    useEffect(() => {
        if (user && post) {
            const checkFavorite = async () => {
                const userDocRef = doc(db, 'users', user.uid);
                const userDoc = await getDoc(userDocRef);
                if (userDoc.exists()) {
                    const favorites = userDoc.data().favorites || [];
                    setHasFavorited(favorites.includes(post.id));
                }
            };
            checkFavorite();
        }
    }, [user, post]);

    const toggleFavorite = async () => {
        if (!user || !post) return setShowLoginModal(true);
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        const favorites = userDoc.exists() ? userDoc.data().favorites || [] : [];

        try {
            if (hasFavorited) {
                await updateDoc(userRef, { favorites: favorites.filter(pid => pid !== post.id) });
                setHasFavorited(false);
            } else {
                await updateDoc(userRef, { favorites: [...favorites, post.id] });
                setHasFavorited(true);
            }
        } catch (e) { console.error(e); }
    };

    const deletePost = async () => {
        if (!(user?.isAdmin || user?.uid === post?.authorId)) return;
        if (confirm('确认删除此帖子吗？')) {
            await deleteDoc(doc(db, 'posts', id));
            router.push('/community');
        }
    };

    const handleTranslate = async () => {
        const settings = JSON.parse(localStorage.getItem('translateSettings') || '{}');
        if (!settings.apiKey || !settings.apiUrl) {
            alert('请先在翻译设置中配置API密钥和接口地址');
            setShowTranslateSettings(true);
            return;
        }

        try {
            const postRes = await callTranslateAPI(cleanedContent, settings);
            const translatedComments = {};
            for (const comment of comments) {
                const commentRes = await callTranslateAPI(comment.content, settings);
                translatedComments[comment.id] = commentRes;
            }
            setTranslatedContent({ post: postRes, comments: translatedComments });
        } catch (error) {
            console.error('翻译失败:', error);
            alert(`翻译失败: ${error.message}`);
        }
    };

    const callTranslateAPI = async (text, settings) => {
        const { apiUrl, model, apiKey, sourceLang, targetLang } = settings;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: `Translate the following text from ${sourceLang} to ${targetLang}.` },
                    { role: 'user', content: text }
                ]
            })
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || '请求翻译API失败');
        }
        const data = await response.json();
        return data.choices[0].message.content;
    };

    // 构建评论树结构
    const commentsTree = useMemo(() => {
        const map = {};
        const roots = [];
        comments.forEach(comment => {
            map[comment.id] = { ...comment, children: [] };
        });
        comments.forEach(comment => {
            if (comment.parentId) {
                map[comment.parentId]?.children.push(map[comment.id]);
            } else {
                roots.push(map[comment.id]);
            }
        });
        return roots;
    }, [comments]);

    const handleLoadMore = () => {
        setVisibleRootComments(prev => prev + INITIAL_VISIBLE_COMMENTS);
    };


    if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center h-screen"><p>加载中...</p></div></LayoutBaseDynamic>;
    if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center h-screen"><p>{error}</p></div></LayoutBaseDynamic>;

    return (
        <LayoutBaseDynamic>
            <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8 relative">
                    <div className="flex justify-between items-start">
                        <h1 className="text-2xl md:text-3xl font-bold mb-2 pr-10">{post.title}</h1>
                        <div className="relative">
                            <button onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full">
                                <MoreOptionsIcon />
                            </button>
                            {showOptionsMenu && (
                                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border dark:border-gray-700">
                                    <ul className="py-1">
                                        <li><button onClick={() => { toggleFavorite(); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><FavoriteIcon filled={hasFavorited} className="w-5 h-5 mr-2" />{hasFavorited ? '取消收藏' : '收藏'}</button></li>
                                        <li><button onClick={() => { setShowShareMenu(true); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><ShareIcon className="w-5 h-5 mr-2" />分享</button></li>
                                        {(user?.isAdmin || user?.uid === post?.authorId) && <>
                                            <li><button onClick={() => { deletePost(); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><DeleteIcon />删除</button></li>
                                            <li><button onClick={() => { alert("修改功能待开发"); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><EditIcon />修改</button></li>
                                        </>}
                                        <li><button onClick={() => { setShowTranslateSettings(true); setShowOptionsMenu(false); }} className="w-full text-left flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"><SettingsIcon />翻译设置</button></li>
                                    </ul>
                                </div>
                            )}
                            {showShareMenu && <SharePanel url={window.location.href} title={post.title} onClose={() => setShowShareMenu(false)} />}
                        </div>
                    </div>
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2 mb-4">
                        <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full" />
                        <span>{post.authorName}</span>
                        <span>· {post.createdAt?.toDate?.().toLocaleString() || '未知时间'}</span>
                        <span>· 浏览 {post.viewsCount || 0}</span>
                    </div>
                    {videoUrl && <div className="my-4"><VideoEmbed url={videoUrl} controls /></div>}
                    <div className="prose dark:prose-invert max-w-none my-4">
                        <PostContent content={translatedContent.post || cleanedContent} />
                    </div>

                    {/* 窄化了间距，并使用更小的图标 */}
                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-3">
                        <div className="flex space-x-3">
                            <button onClick={() => playCachedTTS(cleanedContent)} className="flex items-center space-x-1 hover:text-blue-500"><ReadAloudIcon /><span>朗读</span></button>
                            <button onClick={handleTranslate} className="flex items-center space-x-1 hover:text-green-500"><TranslateIcon /><span>翻译</span></button>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={() => toggleLike(post.id, 'post')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} /><span>{post.likesCount || 0}</span></button>
                            <button onClick={() => toggleDislike(post.id, 'post')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} /><span>{post.dislikesCount || 0}</span></button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>

                    <div className="space-y-6">
                        {commentsTree.slice(0, visibleRootComments).map(c => (
                            <CommentItem
                                key={c.id}
                                comment={c}
                                onReply={handleCommentSubmit}
                                user={user}
                                onLike={toggleLike}
                                onDislike={toggleDislike}
                                translatedComments={translatedContent.comments}
                                level={0}
                            />
                        ))}
                    </div>

                    {commentsTree.length > visibleRootComments && (
                        <button onClick={handleLoadMore} className="text-blue-500 text-sm mt-6 w-full text-center hover:underline">
                            加载更多 ({commentsTree.length - visibleRootComments} 条剩余)
                        </button>
                    )}

                    <form onSubmit={e => handleCommentSubmit(e, null, null, null)} className="mt-8 flex items-start space-x-3 border-t dark:border-gray-700 pt-6">
                        <img src={user?.photoURL || '/img/avatar.svg'} className="w-10 h-10 rounded-full flex-shrink-0" />
                        <div className="flex-grow">
                            <textarea
                                value={commentContent}
                                onChange={e => setCommentContent(e.target.value)}
                                placeholder={user ? "发表你的看法..." : "请登录后评论"}
                                className="w-full border rounded-md p-2 bg-gray-100 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows="3"
                                disabled={!user}
                            />
                            <div className="text-right mt-2">
                                <button type="submit" disabled={!user || !commentContent.trim()} className="px-4 py-2 bg-blue-500 text-white rounded-md disabled:bg-gray-400 disabled:cursor-not-allowed">发表评论</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
            <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
            {showTranslateSettings && <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />}
        </LayoutBaseDynamic>
    );
};


const CommentItem = ({ comment, onReply, user, onLike, onDislike, translatedComments, level = 0 }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [showAllChildren, setShowAllChildren] = useState(false);
    const inputRef = useRef(null);

    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);

    const translatedContent = translatedComments[comment.id] || comment.content;
    
    // 解析 @用户名 (紫色)
    const renderContent = (content) => {
        const parts = content.split(/(@[^\s]+)/g).filter(p => p.length > 0);
        return parts.map((part, index) => {
            if (part.startsWith('@')) {
                return <span key={index} className="text-purple-500 font-semibold">{part} </span>;
            }
            return <span key={index}>{part}</span>;
        });
    };

    // 渲染回复操作栏 (次级评论)
    const renderReplyActionsCompact = () => (
        <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-3 h-3" /><span>{comment.likesCount || 0}</span></button>
            <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-3 h-3" /><span>{comment.dislikesCount || 0}</span></button>
            <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:underline">回复</button>
            <span className="ml-auto">{comment.createdAt?.toDate?.().toLocaleTimeString() || ''}</span>
        </div>
    );

    // 渲染次级评论内容
    const renderReplyBody = () => (
        <div className="flex-1">
            <p className="text-sm">
                <span className="font-bold text-gray-800 dark:text-gray-200 mr-1">{comment.authorName}:</span>
                <span className="text-gray-800 dark:text-gray-200">{renderContent(translatedContent)}</span>
            </p>
            {renderReplyActionsCompact()}
        </div>
    );

    // 渲染主评论内容
    const renderMainBody = () => (
        <div className="flex-1">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                <div className='flex justify-between items-center'>
                    <span className="font-semibold text-sm">{comment.authorName}</span>
                    <div className="flex items-center space-x-3">
                         <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4" /><span>{comment.likesCount || 0}</span></button>
                         <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4" /><span>{comment.dislikesCount || 0}</span></button>
                    </div>
                </div>
                <p className="text-gray-800 dark:text-gray-200 mt-1">{renderContent(translatedContent)}</p>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
                <span>{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
                <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:underline">回复</button>
                <button onClick={() => playCachedTTS(comment.content)} className="hover:text-blue-500"><ReadAloudIcon className="w-4 h-4" /></button>
            </div>
        </div>
    );


    // 决定要显示的子评论数量
    const childrenToDisplay = showAllChildren ? comment.children : comment.children.slice(0, 3);
    const hasMoreChildren = comment.children.length > 3 && !showAllChildren;

    return (
        <div className={`flex space-x-3 ${level > 0 ? 'mt-3' : ''}`}>
            {/* 主评论显示头像，次级评论不显示 */}
            {level === 0 && <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full flex-shrink-0" />}

            {/* 次级评论使用更小的占位符以对齐文本 */}
            {level > 0 && <div className='w-10 flex-shrink-0'></div>}

            <div className="flex-1">
                {level === 0 ? renderMainBody() : renderReplyBody()}

                {showReplyInput && (
                    <form onSubmit={(e) => { onReply(e, comment.id, comment.authorName, inputRef); setShowReplyInput(false); }} className="mt-2 flex space-x-2">
                        <textarea ref={inputRef} placeholder={`回复 @${comment.authorName}`} className="flex-grow border rounded-md p-2 text-sm bg-gray-100 dark:bg-gray-700 dark:border-gray-600" rows="2" />
                        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start text-sm">提交</button>
                    </form>
                )}

                {comment.children && comment.children.length > 0 && (
                    <div className={`mt-3 space-y-3 ${level === 0 ? 'border-l-2 border-gray-200 dark:border-gray-600 pl-4' : 'pl-0'}`}>
                        {childrenToDisplay.map(child => (
                            <CommentItem
                                key={child.id}
                                comment={child}
                                onReply={onReply}
                                user={user}
                                onLike={onLike}
                                onDislike={onDislike}
                                translatedComments={translatedComments}
                                level={level + 1} // 增加层级
                            />
                        ))}
                        {hasMoreChildren && (
                            <button onClick={() => setShowAllChildren(true)} className="text-xs text-blue-500 hover:underline">
                                展开剩余 {comment.children.length - 3} 条回复
                            </button>
                        )}
                         {comment.children.length > 3 && showAllChildren && (
                             <button onClick={() => setShowAllChildren(false)} className="text-xs text-blue-500 hover:underline">
                                收起回复
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


const SharePanel = ({ url, title, onClose }) => {
    // 简化为示例图标
    const iconBase = "https://www.google.com/s2/favicons?domain=";
    const sharePlatforms = [
        { name: 'WeChat', icon: `${iconBase}wechat.com&sz=128`, link: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}` },
        { name: 'Weibo', icon: `${iconBase}weibo.com&sz=128`, link: `http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'QQ', icon: `${iconBase}qq.com&sz=128`, link: `http://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'Twitter', icon: `${iconBase}twitter.com&sz=128`, link: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
        { name: 'Facebook', icon: `${iconBase}facebook.com&sz=128`, link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    ];

    return (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border dark:border-gray-700 p-2">
            <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-center flex-grow">分享到</p>
                <button onClick={onClose} className="text-gray-500 hover:text-gray-800 p-1 leading-none text-xl">&times;</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
                {sharePlatforms.map(p => (
                    <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-xs hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-md">
                        <img src={p.icon} alt={p.name} className="w-8 h-8 rounded-full" />
                        <span className="mt-1">{p.name}</span>
                    </a>
                ))}
            </div>
        </div>
    );
};

const TranslateSettingsModal = ({ onClose }) => {
    const [settings, setSettings] = useState({ apiUrl: '', model: '', apiKey: '', sourceLang: 'auto', targetLang: 'Chinese' });

    useEffect(() => {
        const saved = localStorage.getItem('translateSettings');
        if (saved) {
            setSettings(JSON.parse(saved));
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('translateSettings', JSON.stringify(settings));
        onClose();
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">翻译设置 (OpenAI 兼容接口)</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium">接口地址 (API URL)</label>
                        <input type="text" name="apiUrl" value={settings.apiUrl} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600" placeholder="https://api.example.com/v1/chat/completions" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">模型 (Model)</label>
                        <input type="text" name="model" value={settings.model} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600" placeholder="gpt-3.5-turbo" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">密钥 (API Key)</label>
                        <input type="password" name="apiKey" value={settings.apiKey} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600" placeholder="sk-..." />
                    </div>
                    <div className="flex space-x-4">
                        <div className="flex-1">
                            <label className="block text-sm font-medium">源语言</label>
                            <input type="text" name="sourceLang" value={settings.sourceLang} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600" placeholder="e.g., auto" />
                        </div>
                        <div className="flex-1">
                            <label className="block text-sm font-medium">目标语言</label>
                            <input type="text" name="targetLang" value={settings.targetLang} onChange={handleChange} className="mt-1 block w-full border rounded-md p-2 dark:bg-gray-700 dark:border-gray-600" placeholder="e.g., Chinese" />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">保存</button>
                </div>
            </div>
        </div>
    );
};

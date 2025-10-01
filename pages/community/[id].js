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

// --- Favico Icon Components ---
const ReadAloudIcon = ({ className = "w-6 h-6" }) => <img src="https://www.google.com/s2/favicons?domain=google.com&sz=128" alt="Read Aloud" className={className} />;
const LikeIcon = ({ filled, className = "w-6 h-6" }) => <img src={`https://www.google.com/s2/favicons?domain=youtube.com&sz=128`} alt="Like" className={`${className} ${filled ? 'filter-none' : 'filter grayscale'}`} />;
const DislikeIcon = ({ filled, className = "w-6 h-6" }) => <img src="https://www.google.com/s2/favicons?domain=facebook.com&sz=128" alt="Dislike" className={`${className} ${filled ? 'filter-none' : 'filter grayscale'}`} />;
const FavoriteIcon = ({ filled, className = "w-6 h-6" }) => <img src="https://www.google.com/s2/favicons?domain=github.com&sz=128" alt="Favorite" className={`${className} ${filled ? 'filter-none' : 'filter grayscale'}`} />;
const ShareIcon = ({ className = "w-6 h-6" }) => <img src="https://www.google.com/s2/favicons?domain=twitter.com&sz=128" alt="Share" className={className} />;
const TranslateIcon = ({ className = "w-6 h-6" }) => <img src="https://www.google.com/s2/favicons?domain=deepl.com&sz=128" alt="Translate" className={className} />;
const MoreOptionsIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>;
const DeleteIcon = ({ className = "w-5 h-5 mr-2" }) => <img src="https://www.google.com/s2/favicons?domain=apple.com&sz=128" alt="Delete" className={className} />;
const EditIcon = ({ className = "w-5 h-5 mr-2" }) => <img src="https://www.google.com/s2/favicons?domain=microsoft.com&sz=128" alt="Edit" className={className} />;
const SettingsIcon = ({ className = "w-5 h-5 mr-2" }) => <img src="https://www.google.com/s2/favicons?domain=amazon.com&sz=128" alt="Settings" className={className} />;


const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(m => m.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

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
    const [showAllComments, setShowAllComments] = useState(false);
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

        if (replyToUsername && !text.startsWith(`@${replyToUsername} `)) {
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

                    <div className="flex items-center justify-between text-gray-600 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-4">
                        <div className="flex space-x-4">
                            <button onClick={() => playCachedTTS(cleanedContent)} className="flex items-center space-x-1 hover:text-blue-500"><ReadAloudIcon className="w-5 h-5" /><span>朗读</span></button>
                            <button onClick={handleTranslate} className="flex items-center space-x-1 hover:text-green-500"><TranslateIcon className="w-5 h-5" /><span>翻译</span></button>
                        </div>
                        <div className="flex space-x-4">
                            <button onClick={() => toggleLike(post.id, 'post')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} /><span>{post.likesCount || 0}</span></button>
                            <button onClick={() => toggleDislike(post.id, 'post')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} /><span>{post.dislikesCount || 0}</span></button>
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>

                    <div className="space-y-4">
                        {(showAllComments ? commentsTree : commentsTree.slice(0, 3)).map(c => (
                            <CommentItem
                                key={c.id}
                                comment={c}
                                onReply={handleCommentSubmit}
                                user={user}
                                onLike={toggleLike}
                                onDislike={toggleDislike}
                                translatedComments={translatedContent.comments}
                            />
                        ))}
                    </div>

                    {commentsTree.length > 3 && (
                        <button onClick={() => setShowAllComments(!showAllComments)} className="text-blue-500 text-sm mt-4 w-full text-center">
                            {showAllComments ? '收起部分评论' : '查看全部评论'}
                        </button>
                    )}

                    <form onSubmit={e => handleCommentSubmit(e, null, null, null)} className="mt-6 flex items-start space-x-3">
                        <img src={user?.photoURL || '/img/avatar.svg'} className="w-10 h-10 rounded-full" />
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

export default PostDetailPage;

const CommentItem = ({ comment, onReply, user, onLike, onDislike, translatedComments }) => {
    const [showReply, setShowReply] = useState(false);
    const inputRef = useRef(null);
    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);
    
    const translatedContent = translatedComments[comment.id];
    const contentToDisplay = translatedContent || comment.content;

    const renderContent = () => {
        const mentionRegex = /^(@[^\s]+)\s/;
        const match = contentToDisplay.match(mentionRegex);
        if (match) {
            return (
                <>
                    <span className="text-blue-500 font-semibold">{match[1]}</span>
                    <span>{contentToDisplay.substring(match[0].length)}</span>
                </>
            );
        }
        return contentToDisplay;
    };
    
    return (
        <div className="flex space-x-3">
            <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                    <span className="font-semibold text-sm">{comment.authorName}</span>
                    <p className="text-gray-800 dark:text-gray-200 my-1">{renderContent()}</p>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
                    <span>{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
                    <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4" /><span>{comment.likesCount || 0}</span></button>
                    <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4" /><span>{comment.dislikesCount || 0}</span></button>
                    <button onClick={() => setShowReply(!showReply)} className="hover:underline">回复</button>
                    <button onClick={() => playCachedTTS(comment.content)} className="hover:text-blue-500"><ReadAloudIcon className="w-4 h-4" /></button>
                </div>

                {showReply && (
                    <form onSubmit={(e) => { onReply(e, comment.id, comment.authorName, inputRef); setShowReply(false); }} className="mt-2 flex space-x-2">
                        <textarea ref={inputRef} placeholder={`回复 @${comment.authorName}`} className="flex-grow border rounded-md p-2 text-sm bg-gray-100 dark:bg-gray-700 dark:border-gray-600" rows="2" />
                        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start">提交</button>
                    </form>
                )}

                {comment.children && comment.children.length > 0 && (
                    <div className="mt-3 space-y-3 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
                        {comment.children.map(child => (
                            <CommentItem
                                key={child.id}
                                comment={child}
                                onReply={onReply}
                                user={user}
                                onLike={onLike}
                                onDislike={onDislike}
                                translatedComments={translatedComments}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};


const SharePanel = ({ url, title, onClose }) => {
    const sharePlatforms = [
        { name: 'WeChat', icon: 'https://www.google.com/s2/favicons?domain=wechat.com&sz=128', link: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}` },
        { name: 'Weibo', icon: 'https://www.google.com/s2/favicons?domain=weibo.com&sz=128', link: `http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'QQ', icon: 'https://www.google.com/s2/favicons?domain=qq.com&sz=128', link: `http://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'Twitter', icon: 'https://www.google.com/s2/favicons?domain=twitter.com&sz=128', link: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
        { name: 'Facebook', icon: 'https://www.google.com/s2/favicons?domain=facebook.com&sz=128', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
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

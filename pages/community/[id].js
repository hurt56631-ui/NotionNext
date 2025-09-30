// pages/community/[id].js (已修复 await 语法错误)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment, serverTimestamp, runTransaction, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { ThumbsUp, ThumbsDown, Volume2, Languages, Share2, MoreVertical, Edit, Trash2, Bookmark, UserPlus, UserCheck, Flame, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';

// --- 动态导入 ---
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// --- 辅助函数 ---

// 视频链接解析
const parseVideoUrl = (postData) => {
  if (!postData) return null;
  if (postData.videoUrl && typeof postData.videoUrl === 'string' && postData.videoUrl.trim() !== '') {
    try { new URL(postData.videoUrl); return postData.videoUrl; } catch { /* not a valid URL */ }
  }
  const text = postData.content;
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const allUrls = text.match(urlRegex);
  if (!allUrls) return null;
  const videoPatterns = [/youtube\.com|youtu\.be/, /vimeo\.com/, /tiktok\.com/, /bilibili\.com/, /\.(mp4|webm|mov)$/i];
  for (const url of allUrls) { if (videoPatterns.some(p => p.test(url))) { return url; } }
  return null;
};

// 从文本中移除URL
const removeUrlFromText = (text, urlToRemove) => {
    if (!text || !urlToRemove || typeof text !== 'string') return text;
    const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedUrl, 'g');
    return text.replace(regex, '').trim();
};

// AI 翻译接口调用
const callAIHelper = async (textToTranslate, aiConfig) => {
    const { apiKey, endpoint, model } = aiConfig;
    if (!apiKey || !endpoint) { throw new Error("请在设置中配置AI翻译接口地址和密钥。"); }
    const prompt = `Translate the following text into simplified Chinese. Return only the translated text, without any introductory phrases or explanations.`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt + `\n\nText to translate:\n"""\n${textToTranslate}\n"""` }] })
        });
        if (!response.ok) { const errorBody = await response.text(); throw new Error(`AI API Error: ${response.status} ${errorBody}`); }
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) { console.error("AI Translation failed:", error); throw error; }
};

// 基于API的TTS朗读模块
const ttsCache = new Map();
let currentAudio = null;

const playTTSWithAPI = async (text, ttsConfig) => {
    if (typeof window === 'undefined') return; // 确保只在客户端执行
    if (!text || !ttsConfig.endpoint) {
        alert("请在设置中配置TTS接口地址。");
        return;
    }

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    if (ttsCache.has(text)) {
        currentAudio = ttsCache.get(text);
        currentAudio.play();
        return;
    }

    try {
        const url = `${ttsConfig.endpoint}?t=${encodeURIComponent(text)}&v=${ttsConfig.speaker || 'zh-CN-XiaoxiaoMultilingualNeural'}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(text, audio);
        currentAudio = audio;
        currentAudio.play();
    } catch (error) {
        console.error(`播放TTS失败:`, error);
        alert("朗读失败，请检查TTS接口设置或网络连接。");
    }
};


// --- 子组件 ---

const CommentForm = ({ onSubmit, placeholder, initialContent = '', buttonText = '发表评论', isSubmitting = false, user }) => {
    const [content, setContent] = useState(initialContent);
    const textareaRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim() || !user) return;
        onSubmit(content.trim());
        setContent('');
    };
    
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [content]);

    return (
        <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
                ref={textareaRef}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-none overflow-hidden"
                rows="1"
                disabled={isSubmitting || !user}
            />
            <button
                type="submit"
                disabled={isSubmitting || !content.trim() || !user}
                className="w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-blue-500"
            >
                {isSubmitting ? '提交中...' : buttonText}
            </button>
        </form>
    );
};

const CommentThread = ({ comment, replies, user, onReply, onDelete, onLike }) => {
    const [showReplies, setShowReplies] = useState(true);
    const [isReplying, setIsReplying] = useState(false);

    const isAuthor = user && user.uid === comment.authorId;
    const hasLiked = user && comment.likers?.includes(user.uid);

    return (
        <div className="flex items-start space-x-3">
            <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-9 h-9 rounded-full object-cover" />
            <div className="flex-1">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                    <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{comment.authorName}</p>
                    <p className="text-gray-700 dark:text-gray-300 break-words">{comment.content}</p>
                </div>
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{comment.createdAt?.toDate ? new Date(comment.createdAt.toDate()).toLocaleString('zh-CN', { year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                    <button onClick={() => onLike(comment.id)} className={`flex items-center gap-1 hover:text-red-500 ${hasLiked ? 'text-red-500' : ''}`}>
                        <ThumbsUp size={12} /> {comment.likesCount || 0}
                    </button>
                    <button onClick={() => setIsReplying(!isReplying)} className="hover:text-blue-500">回复</button>
                    {isAuthor && <button onClick={() => onDelete(comment.id)} className="hover:text-red-500">删除</button>}
                </div>
                
                {isReplying && (
                    <div className="mt-3">
                        <CommentForm
                            onSubmit={(content) => { onReply(content, comment.id); setIsReplying(false); }}
                            placeholder={`回复 @${comment.authorName}`}
                            buttonText="回复"
                            user={user}
                        />
                    </div>
                )}

                {replies.length > 0 && (
                    <div className="mt-3 space-y-3">
                        {showReplies ? replies.map(reply => (
                            <CommentThread key={reply.id} comment={reply} replies={[]} user={user} onReply={onReply} onDelete={onDelete} onLike={onLike} />
                        )) : null}
                        {replies.length > 0 && (
                            <button onClick={() => setShowReplies(!showReplies)} className="text-xs font-semibold text-blue-500 hover:underline">
                                {showReplies ? '收起回复' : `展开 ${replies.length} 条回复`}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};


// --- 主页面组件 ---

const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [isDisliking, setIsDisliking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [commentSortOrder, setCommentSortOrder] = useState('time');
  const [mainCommentsToShow, setMainCommentsToShow] = useState(3);
  const [translatedText, setTranslatedText] = useState({ title: null, content: null });
  const [isTranslating, setIsTranslating] = useState(false);

  const [appConfig, setAppConfig] = useState({
      ai: { endpoint: '', apiKey: '', model: 'gpt-4o-mini' },
      tts: { endpoint: 'https://t.leftsite.cn/tts', speaker: 'zh-CN-XiaoxiaoMultilingualNeural' }
  });

  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('app_config');
      if (savedConfig) {
        const parsed = JSON.parse(savedConfig);
        setAppConfig(prev => ({
            ai: { ...prev.ai, ...parsed.ai },
            tts: { ...prev.tts, ...parsed.tts }
        }));
      }
    } catch (e) { console.error("Failed to load app config from localStorage", e); }
  }, []);

  const saveAppConfig = (config) => {
    setAppConfig(config);
    localStorage.setItem('app_config', JSON.stringify(config));
  };

  const videoUrl = useMemo(() => (post ? parseVideoUrl(post) : null), [post]);
  const cleanedContent = useMemo(() => (post?.content ? (videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content) : ''), [post, videoUrl]);
  const hasLiked = useMemo(() => user && post?.likers?.includes(user.uid), [user, post?.likers]);
  const hasDisliked = useMemo(() => user && post?.dislikers?.includes(user.uid), [user, post?.dislikers]);
  const isPostAuthor = useMemo(() => user && post && user.uid === post.authorId, [user, post]);

  const commentThreads = useMemo(() => {
    const commentMap = {};
    const roots = [];
    comments.forEach(c => { commentMap[c.id] = { ...c, replies: [] }; });
    comments.forEach(c => {
        if (c.parentId && commentMap[c.parentId]) { commentMap[c.parentId].replies.push(commentMap[c.id]); } 
        else { roots.push(commentMap[c.id]); }
    });
    return roots;
  }, [comments]);
  
  const sortedMainComments = useMemo(() => {
      const sorted = [...commentThreads];
      if (commentSortOrder === 'hot') {
          sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      } else {
          sorted.sort((a, b) => (b.createdAt && a.createdAt) ? b.createdAt.toMillis() - a.createdAt.toMillis() : 0);
      }
      return sorted;
  }, [commentThreads, commentSortOrder]);

  useEffect(() => {
    if (!id || !db) return;
    setLoading(true);

    const postUnsub = onSnapshot(doc(db, 'posts', id), (docSnap) => {
        if (docSnap.exists()) setPost({ id: docSnap.id, ...docSnap.data() });
        else { setError('抱歉，帖子不存在或已被删除。'); setPost(null); }
    }, (err) => { console.error("加载帖子失败:", err); setError('加载帖子失败。'); });

    const commentsUnsub = onSnapshot(query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc')), (snapshot) => {
        setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
    }, (err) => { console.error("加载评论失败:", err); setError('加载评论失败。'); setLoading(false); });
    
    return () => { postUnsub(); commentsUnsub(); };
  }, [id]);

  useEffect(() => {
      if(user && post?.authorId) {
          getDoc(doc(db, 'users', user.uid, 'following', post.authorId)).then(docSnap => setIsFollowing(docSnap.exists()));
          getDoc(doc(db, 'users', user.uid, 'favorites', id)).then(docSnap => setIsFavorited(docSnap.exists()));
      }
  }, [id, user, post?.authorId]);

  const handleVote = async (type) => {
    if (!user) { setShowLoginModal(true); return; }
    if ((type === 'like' && isLiking) || (type === 'dislike' && isDisliking)) return;
    type === 'like' ? setIsLiking(true) : setIsDisliking(true);
    try {
        await runTransaction(db, async (t) => {
            const postRef = doc(db, 'posts', id);
            const postDoc = await t.get(postRef);
            if (!postDoc.exists()) throw "Post not found";
            const d = postDoc.data();
            const [likers, dislikers] = [d.likers || [], d.dislikers || []];
            const hasL = likers.includes(user.uid), hasD = dislikers.includes(user.uid);
            let nL = [...likers], nD = [...dislikers], lI = 0, dI = 0;
            if (type === 'like') { if (hasL) { nL = nL.filter(u => u !== user.uid); lI = -1; } else { nL.push(user.uid); lI = 1; if (hasD) { nD = nD.filter(u => u !== user.uid); dI = -1; } } }
            else { if (hasD) { nD = nD.filter(u => u !== user.uid); dI = -1; } else { nD.push(user.uid); dI = 1; if (hasL) { nL = nL.filter(u => u !== user.uid); lI = -1; } } }
            t.update(postRef, { likers: nL, dislikers: nD, likesCount: increment(lI), dislikesCount: increment(dI) });
        });
    } catch (e) { console.error("Vote failed:", e); alert("操作失败。");
    } finally { type === 'like' ? setIsLiking(false) : setIsDisliking(false); }
  };
  
  const handleShare = async () => { try { if (navigator.share) await navigator.share({ title: post.title, url: window.location.href }); else { await navigator.clipboard.writeText(window.location.href); alert('链接已复制！'); } } catch (e) { console.error('Share failed:', e); } };
  const handleFollow = async () => { if (!user || !post.authorId) { setShowLoginModal(true); return; } try { const b = writeBatch(db); const fRef1 = doc(db, 'users', user.uid, 'following', post.authorId); const fRef2 = doc(db, 'users', post.authorId, 'followers', user.uid); if (isFollowing) { b.delete(fRef1); b.delete(fRef2); } else { b.set(fRef1, { at: serverTimestamp() }); b.set(fRef2, { at: serverTimestamp() }); } await b.commit(); setIsFollowing(!isFollowing); } catch (e) { console.error("Follow failed:", e); alert("操作失败。"); } };
  const handleFavorite = async () => { if (!user) { setShowLoginModal(true); return; } try { const favRef = doc(db, 'users', user.uid, 'favorites', id); if (isFavorited) await deleteDoc(favRef); else await setDoc(favRef, { postId: id, title: post.title, at: serverTimestamp() }); setIsFavorited(!isFavorited); } catch (e) { console.error("Favorite failed:", e); alert("操作失败。"); } };
  
  // 【已修复】handleTranslate 函数
  const handleTranslate = async (type) => {
      if (isTranslating) return;
      setIsTranslating(true);
      try {
          const text = type === 'title' ? post.title : cleanedContent;
          if (text) {
              // 1. 先调用异步函数并等待结果
              const result = await callAIHelper(text, appConfig.ai);
              // 2. 拿到结果后，再同步更新状态
              setTranslatedText(prev => ({ ...prev, [type]: result }));
          }
      } catch (e) {
          alert(`翻译失败: ${e.message}`);
      } finally {
          setIsTranslating(false);
      }
  };

  const handleDeletePost = async () => { if (isPostAuthor && window.confirm("确定删除帖子吗？")) { try { await deleteDoc(doc(db, 'posts', id)); router.push('/community'); } catch (e) { console.error("Delete failed:", e); alert("删除失败。"); } } };
  const handleCommentSubmit = async (content, parentId = null) => { if (!user) { setShowLoginModal(true); return; } setIsCommenting(true); try { await addDoc(collection(db, 'comments'), { postId: id, content, parentId, authorId: user.uid, authorName: user.displayName, authorAvatar: user.photoURL, createdAt: serverTimestamp(), likesCount: 0, likers: [] }); if (!parentId) await updateDoc(doc(db, 'posts', id), { commentsCount: increment(1) }); } catch (e) { console.error("Comment failed:", e); alert("评论失败。"); } finally { setIsCommenting(false); } };
  const handleDeleteComment = async (commentId) => { const c = comments.find(c => c.id === commentId); if (user?.uid !== c?.authorId) { alert("无权删除。"); return; } if (window.confirm("确定删除评论吗？")) { try { await deleteDoc(doc(db, 'comments', commentId)); if (!c.parentId) await updateDoc(doc(db, 'posts', id), { commentsCount: increment(-1) }); } catch (e) { console.error("Delete comment failed:", e); alert("删除失败。"); } } };
  const handleLikeComment = async (commentId) => { if (!user) { setShowLoginModal(true); return; } const c = comments.find(c => c.id === commentId); const hasL = c?.likers?.includes(user.uid); try { await updateDoc(doc(db, 'comments', commentId), { likesCount: increment(hasL ? -1 : 1), likers: hasL ? c.likers.filter(u => u !== user.uid) : [...(c.likers || []), user.uid] }); } catch (e) { console.error("Like comment failed:", e); alert("操作失败。"); } };

  if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-center"><i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p className="ml-4">加载中...</p></div></LayoutBaseDynamic>;
  if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-red-500 text-center p-4"><p className="text-xl font-bold">{error || '帖子不存在。'}</p></div></LayoutBaseDynamic>;

  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            <div className="relative">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2 break-words pr-28">{post.title}</h1>
              {translatedText.title && <p className="text-lg font-semibold text-blue-500 mt-1">{translatedText.title}</p>}
              <div className="absolute top-0 right-0 flex items-center gap-1">
                <button onClick={() => playTTSWithAPI(post.title, appConfig.tts)} title="朗读标题" className="p-2 text-gray-500 hover:text-blue-500"><Volume2 size={18} /></button>
                <button onClick={() => handleTranslate('title')} title="翻译标题" className="p-2 text-gray-500 hover:text-blue-500"><Languages size={18} /></button>
                <button onClick={() => setShowSettings(true)} title="设置" className="p-2 text-gray-500 hover:text-blue-500"><MoreVertical size={18} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm mb-6">
                <div className="flex items-center space-x-3">
                    <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName || '匿名'}</p>
                        <p className="text-gray-500 dark:text-gray-400">{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : ''}</p>
                    </div>
                </div>
                {!isPostAuthor && <button onClick={handleFollow} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full ${isFollowing ? 'bg-gray-200 dark:bg-gray-600' : 'bg-green-500 text-white'}`}><UserCheck size={14} />{isFollowing ? '已关注' : '关注'}</button>}
            </div>
            {videoUrl && <div className="mb-6 rounded-lg overflow-hidden shadow-md"><VideoEmbed url={videoUrl} /></div>}
            <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200"><PostContent content={cleanedContent} /></div>
            {translatedText.content && <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-800 dark:text-blue-200">{translatedText.content}</div>}
            <div className="flex items-center justify-between mt-8 pt-4 border-t dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleVote('like')} disabled={isLiking} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${hasLiked ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}><ThumbsUp size={16} />{post.likesCount || 0}</button>
                    <button onClick={() => handleVote('dislike')} disabled={isDisliking} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm ${hasDisliked ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}><ThumbsDown size={16} />{post.dislikesCount || 0}</button>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <button onClick={() => playTTSWithAPI(cleanedContent, appConfig.tts)} title="朗读正文" className="p-2 hover:text-blue-500"><Volume2 size={18} /></button>
                    <button onClick={() => handleTranslate('content')} title="翻译正文" className="p-2 hover:text-blue-500"><Languages size={18} /></button>
                    <button onClick={handleShare} title="分享" className="p-2 hover:text-blue-500"><Share2 size={18} /></button>
                </div>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">评论 ({comments.length})</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCommentSortOrder('hot')} className={`p-1.5 rounded-md ${commentSortOrder === 'hot' ? 'bg-blue-100 dark:bg-blue-900' : ''}`}><Flame size={18} title="热度排序" /></button>
                    <button onClick={() => setCommentSortOrder('time')} className={`p-1.5 rounded-md ${commentSortOrder === 'time' ? 'bg-blue-100 dark:bg-blue-900' : ''}`}><Clock size={18} title="时间排序" /></button>
                </div>
            </div>
            <div className="mb-6"><CommentForm onSubmit={handleCommentSubmit} placeholder={user ? "发表看法..." : "登录后评论..."} isSubmitting={isCommenting} user={user} /></div>
            <div className="space-y-5">{sortedMainComments.slice(0, mainCommentsToShow).map(t => <CommentThread key={t.id} comment={t} replies={t.replies} user={user} onReply={handleCommentSubmit} onDelete={handleDeleteComment} onLike={handleLikeComment} />)}</div>
            {sortedMainComments.length > mainCommentsToShow && <div className="mt-6 text-center"><button onClick={() => setMainCommentsToShow(sortedMainComments.length)} className="text-blue-500 font-semibold flex items-center gap-1 mx-auto">查看全部 {sortedMainComments.length} 条评论<ChevronDown size={16} /></button></div>}
            {sortedMainComments.length > 3 && mainCommentsToShow === sortedMainComments.length && <div className="mt-6 text-center"><button onClick={() => setMainCommentsToShow(3)} className="text-blue-500 font-semibold flex items-center gap-1 mx-auto">收起<ChevronUp size={16} /></button></div>}
          </div>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      {showSettings && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center"><h3 className="text-lg font-bold">设置</h3><button onClick={() => setShowSettings(false)}><X size={20}/></button></div>
                  {isPostAuthor && <div className="space-y-2 border-b dark:border-gray-700 pb-4"><button onClick={() => router.push(`/community/edit/${id}`)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Edit size={16} />修改帖子</button><button onClick={handleDeletePost} className="w-full flex items-center gap-3 px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md"><Trash2 size={16} />删除帖子</button></div>}
                  <div className="space-y-2 border-b dark:border-gray-700 pb-4"><button onClick={handleFavorite} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Bookmark size={16} className={isFavorited ? 'fill-current text-yellow-500' : ''} />{isFavorited ? '已收藏' : '收藏帖子'}</button></div>
                  <div className="space-y-2 border-b dark:border-gray-700 pb-4">
                      <h4 className="font-semibold text-sm">朗读 (TTS) 设置</h4>
                      <input type="text" placeholder="TTS 接口地址" value={appConfig.tts.endpoint} onChange={e => setAppConfig(c => ({...c, tts: {...c.tts, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <input type="text" placeholder="发音人" value={appConfig.tts.speaker} onChange={e => setAppConfig(c => ({...c, tts: {...c.tts, speaker: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                  </div>
                  <div className="space-y-2">
                      <h4 className="font-semibold text-sm">AI翻译设置 (OpenAI 兼容)</h4>
                      <input type="text" placeholder="接口地址" value={appConfig.ai.endpoint} onChange={e => setAppConfig(c => ({...c, ai: {...c.ai, endpoint: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <input type="password" placeholder="密钥" value={appConfig.ai.apiKey} onChange={e => setAppConfig(c => ({...c, ai: {...c.ai, apiKey: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <input type="text" placeholder="模型" value={appConfig.ai.model} onChange={e => setAppConfig(c => ({...c, ai: {...c.ai, model: e.target.value}}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                  </div>
                  <button onClick={() => {saveAppConfig(appConfig); alert("设置已保存"); setShowSettings(false);}} className="w-full mt-2 p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">保存设置</button>
              </div>
          </div>
      )}
      {isTranslating && <div className="fixed bottom-5 right-5 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">翻译中...</div>}
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

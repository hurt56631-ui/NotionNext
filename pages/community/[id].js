// pages/community/[id].js (已根据用户需求完全重写)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment, serverTimestamp, runTransaction, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { ThumbsUp, ThumbsDown, Volume2, Languages, Share2, MoreVertical, Edit, Trash2, Bookmark, UserPlus, UserCheck, MessageSquare, Flame, Clock, X, ChevronDown, ChevronUp } from 'lucide-react';

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
    const fullPrompt = `${prompt}\n\nText to translate:\n"""\n${textToTranslate}\n"""`;
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: fullPrompt }] })
        });
        if (!response.ok) { const errorBody = await response.text(); throw new Error(`AI API Error: ${response.status} ${errorBody}`); }
        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) { console.error("AI Translation failed:", error); throw error; }
};

// 朗读文本
const playTTS = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
        alert("您的浏览器不支持朗读功能。");
        return;
    }
    // 如果正在朗读，则取消
    if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
        return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
};


// --- 子组件 ---

// 评论表单组件
const CommentForm = ({ onSubmit, placeholder, initialContent = '', buttonText = '发表评论', isSubmitting = false }) => {
    const [content, setContent] = useState(initialContent);
    const textareaRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!content.trim()) return;
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
                disabled={isSubmitting}
            />
            <button
                type="submit"
                disabled={isSubmitting || !content.trim()}
                className="w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-blue-500"
            >
                {isSubmitting ? '提交中...' : buttonText}
            </button>
        </form>
    );
};


// 楼中楼评论项组件
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
                        />
                    </div>
                )}

                {replies.length > 0 && (
                    <div className="mt-3 space-y-3">
                        {showReplies ? replies.map(reply => (
                            <CommentThread key={reply.id} comment={reply} replies={[]} user={user} onReply={onReply} onDelete={onDelete} onLike={onLike} />
                        )) : null}
                        <button onClick={() => setShowReplies(!showReplies)} className="text-xs font-semibold text-blue-500 hover:underline">
                            {showReplies ? '收起回复' : `展开 ${replies.length} 条回复`}
                        </button>
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

  // --- State ---
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 交互状态
  const [isLiking, setIsLiking] = useState(false);
  const [isDisliking, setIsDisliking] = useState(false);
  const [isCommenting, setIsCommenting] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFavorited, setIsFavorited] = useState(false);

  // 功能状态
  const [showSettings, setShowSettings] = useState(false);
  const [commentSortOrder, setCommentSortOrder] = useState('time'); // 'time' or 'hot'
  const [mainCommentsToShow, setMainCommentsToShow] = useState(3);
  const [translatedText, setTranslatedText] = useState({ title: null, content: null });
  const [isTranslating, setIsTranslating] = useState(false);

  // AI翻译设置
  const [aiConfig, setAiConfig] = useState({ endpoint: '', apiKey: '', model: 'gpt-4o-mini' });
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('ai_translation_config');
      if (savedConfig) setAiConfig(JSON.parse(savedConfig));
    } catch (e) { console.error("Failed to load AI config from localStorage", e); }
  }, []);

  const saveAiConfig = (config) => {
    setAiConfig(config);
    localStorage.setItem('ai_translation_config', JSON.stringify(config));
  };

  // --- Memos & Derived State ---
  const videoUrl = useMemo(() => (post ? parseVideoUrl(post) : null), [post]);
  const cleanedContent = useMemo(() => {
    if (!post || !post.content) return '';
    return videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
  }, [post, videoUrl]);
  
  const hasLiked = useMemo(() => user && post?.likers?.includes(user.uid), [user, post?.likers]);
  const hasDisliked = useMemo(() => user && post?.dislikers?.includes(user.uid), [user, post?.dislikers]);
  const isPostAuthor = useMemo(() => user && post && user.uid === post.authorId, [user, post]);

  // 楼中楼评论数据结构处理
  const commentThreads = useMemo(() => {
    const commentMap = {};
    const roots = [];
    comments.forEach(comment => {
        commentMap[comment.id] = { ...comment, replies: [] };
    });
    comments.forEach(comment => {
        if (comment.parentId && commentMap[comment.parentId]) {
            commentMap[comment.parentId].replies.push(commentMap[comment.id]);
        } else {
            roots.push(commentMap[comment.id]);
        }
    });
    return roots;
  }, [comments]);
  
  // 评论排序
  const sortedMainComments = useMemo(() => {
      const sorted = [...commentThreads];
      if (commentSortOrder === 'hot') {
          sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
      } else { // 'time'
          sorted.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      }
      return sorted;
  }, [commentThreads, commentSortOrder]);


  // --- 数据获取 ---
  useEffect(() => {
    if (!id || !db) return;
    setLoading(true);

    const postUnsub = onSnapshot(doc(db, 'posts', id), (docSnap) => {
        if (docSnap.exists()) {
            setPost({ id: docSnap.id, ...docSnap.data() });
        } else {
            setError('抱歉，帖子不存在或已被删除。');
            setPost(null);
        }
    }, (err) => {
        console.error("加载帖子失败:", err);
        setError('加载帖子失败，请稍后再试。');
    });

    const commentsQuery = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
    const commentsUnsub = onSnapshot(commentsQuery, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setComments(data);
        setLoading(false);
    }, (err) => {
        console.error("加载评论失败:", err);
        setError('加载评论失败。');
        setLoading(false);
    });
    
    // 获取用户关注和收藏状态
    if (user && post?.authorId) {
        const followRef = doc(db, 'users', user.uid, 'following', post.authorId);
        getDoc(followRef).then(docSnap => setIsFollowing(docSnap.exists()));
        
        const favoriteRef = doc(db, 'users', user.uid, 'favorites', id);
        getDoc(favoriteRef).then(docSnap => setIsFavorited(docSnap.exists()));
    }

    return () => {
        postUnsub();
        commentsUnsub();
    };
  }, [id, user, post?.authorId]);


  // --- 事件处理函数 ---

  // 点赞/踩
  const handleVote = async (type) => {
    if (!user) { setShowLoginModal(true); return; }
    if (type === 'like' && isLiking) return;
    if (type === 'dislike' && isDisliking) return;

    if(type === 'like') setIsLiking(true);
    else setIsDisliking(true);

    const postRef = doc(db, 'posts', id);
    try {
        await runTransaction(db, async (transaction) => {
            const postDoc = await transaction.get(postRef);
            if (!postDoc.exists()) throw "Document does not exist!";

            const data = postDoc.data();
            const likers = data.likers || [];
            const dislikers = data.dislikers || [];
            const userHasLiked = likers.includes(user.uid);
            const userHasDisliked = dislikers.includes(user.uid);
            
            let newLikers = [...likers];
            let newDislikers = [...dislikers];
            let likesIncrement = 0;
            let dislikesIncrement = 0;

            if (type === 'like') {
                if (userHasLiked) { // 取消赞
                    newLikers = newLikers.filter(uid => uid !== user.uid);
                    likesIncrement = -1;
                } else { // 点赞
                    newLikers.push(user.uid);
                    likesIncrement = 1;
                    if (userHasDisliked) { // 如果之前踩过，取消踩
                        newDislikers = newDislikers.filter(uid => uid !== user.uid);
                        dislikesIncrement = -1;
                    }
                }
            } else { // dislike
                if (userHasDisliked) { // 取消踩
                    newDislikers = newDislikers.filter(uid => uid !== user.uid);
                    dislikesIncrement = -1;
                } else { // 点踩
                    newDislikers.push(user.uid);
                    dislikesIncrement = 1;
                    if (userHasLiked) { // 如果之前赞过，取消赞
                        newLikers = newLikers.filter(uid => uid !== user.uid);
                        likesIncrement = -1;
                    }
                }
            }
            transaction.update(postRef, {
                likers: newLikers,
                dislikers: newDislikers,
                likesCount: increment(likesIncrement),
                dislikesCount: increment(dislikesIncrement)
            });
        });
    } catch (e) {
        console.error("Vote failed:", e);
        alert("操作失败，请重试。");
    } finally {
        if(type === 'like') setIsLiking(false);
        else setIsDisliking(false);
    }
  };
  
  // 分享
  const handleShare = async () => {
    const shareData = {
        title: post.title,
        text: `来看看这个帖子: ${post.title}`,
        url: window.location.href,
    };
    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            await navigator.clipboard.writeText(window.location.href);
            alert('帖子链接已复制到剪贴板！');
        }
    } catch (err) {
        console.error('Share failed:', err);
    }
  };

  // 关注
  const handleFollow = async () => {
      if (!user || !post.authorId) { setShowLoginModal(true); return; }
      const followRef = doc(db, 'users', user.uid, 'following', post.authorId);
      const followerRef = doc(db, 'users', post.authorId, 'followers', user.uid);
      try {
          if (isFollowing) {
              await deleteDoc(followRef);
              await deleteDoc(followerRef);
          } else {
              const batch = writeBatch(db);
              batch.set(followRef, { followedAt: serverTimestamp() });
              batch.set(followerRef, { followerAt: serverTimestamp() });
              await batch.commit();
          }
          setIsFollowing(!isFollowing);
      } catch (e) {
          console.error("Follow action failed:", e);
          alert("操作失败，请重试。");
      }
  };

  // 收藏
  const handleFavorite = async () => {
      if (!user) { setShowLoginModal(true); return; }
      const favoriteRef = doc(db, 'users', user.uid, 'favorites', id);
      try {
          if (isFavorited) {
              await deleteDoc(favoriteRef);
          } else {
              await setDoc(favoriteRef, {
                  postId: id,
                  title: post.title,
                  favoritedAt: serverTimestamp()
              });
          }
          setIsFavorited(!isFavorited);
      } catch (e) {
          console.error("Favorite action failed:", e);
          alert("操作失败，请重试。");
      }
  };

  // 翻译
  const handleTranslate = async (type) => {
      if (isTranslating) return;
      const text = type === 'title' ? post.title : cleanedContent;
      if (!text) return;

      setIsTranslating(true);
      try {
          const result = await callAIHelper(text, aiConfig);
          setTranslatedText(prev => ({ ...prev, [type]: result }));
      } catch (e) {
          alert(`翻译失败: ${e.message}`);
      } finally {
          setIsTranslating(false);
      }
  };
  
  // 删除帖子
  const handleDeletePost = async () => {
      if (!isPostAuthor) return;
      if (window.confirm("确定要删除这篇帖子吗？此操作不可恢复。")) {
          try {
              await deleteDoc(doc(db, 'posts', id));
              router.push('/community'); // 返回社区首页
          } catch (e) {
              console.error("Delete post failed:", e);
              alert("删除失败，请重试。");
          }
      }
  };
  
  // 提交评论
  const handleCommentSubmit = async (content, parentId = null) => {
    if (!content.trim()) return;
    if (!user) { setShowLoginModal(true); return; }
    
    setIsCommenting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id,
        content: content.trim(),
        parentId,
        authorId: user.uid,
        authorName: user.displayName || '匿名用户',
        authorAvatar: user.photoURL,
        createdAt: serverTimestamp(),
        likesCount: 0,
        likers: []
      });
      // 只有主评论才更新帖子评论数
      if (!parentId) {
        await updateDoc(doc(db, 'posts', id), { commentsCount: increment(1) });
      }
    } catch (error) {
      console.error("发表评论失败:", error);
      alert("发表评论失败，请重试。");
    } finally {
      setIsCommenting(false);
    }
  };
  
  // 删除评论
  const handleDeleteComment = async (commentId) => {
    // 简单实现，只允许评论作者删除
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!user || user.uid !== commentToDelete?.authorId) {
      alert("你没有权限删除此评论。");
      return;
    }
    if (window.confirm("确定要删除这条评论吗？")) {
      try {
        await deleteDoc(doc(db, 'comments', commentId));
        // 如果删除的是主评论，帖子评论数减一
        if (!commentToDelete.parentId) {
            await updateDoc(doc(db, 'posts', id), { commentsCount: increment(-1) });
        }
      } catch (e) {
        console.error("Delete comment failed:", e);
        alert("删除失败，请重试。");
      }
    }
  };
  
  // 评论点赞
  const handleLikeComment = async (commentId) => {
    if (!user) { setShowLoginModal(true); return; }
    const commentRef = doc(db, 'comments', commentId);
    const comment = comments.find(c => c.id === commentId);
    const hasLiked = comment?.likers?.includes(user.uid);
    
    try {
      if (hasLiked) {
        await updateDoc(commentRef, {
          likesCount: increment(-1),
          likers: comment.likers.filter(uid => uid !== user.uid)
        });
      } else {
        await updateDoc(commentRef, {
          likesCount: increment(1),
          likers: [...(comment.likers || []), user.uid]
        });
      }
    } catch (e) {
      console.error("Like comment failed:", e);
      alert("操作失败，请重试。");
    }
  };


  // --- 加载和错误UI ---
  if (authLoading || loading) {
    return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-center"><i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i><p className="ml-4 text-gray-600 dark:text-gray-300">正在加载...</p></div></LayoutBaseDynamic>;
  }
  if (error || !post) {
    return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-red-500 text-center p-4"><p className="text-xl font-bold">{error || '帖子不存在或已被删除。'}</p></div></LayoutBaseDynamic>;
  }
  

  // --- 渲染 ---
  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">

          {/* 帖子主体 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            
            {/* 标题区域 */}
            <div className="relative">
              <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-2 break-words pr-12">{post.title}</h1>
              {translatedText.title && <p className="text-lg md:text-xl font-semibold text-blue-500 mt-1">{translatedText.title}</p>}
              
              <div className="absolute top-0 right-0 flex items-center gap-2">
                <button onClick={() => playTTS(post.title)} title="朗读标题" className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"><Volume2 size={18} /></button>
                <button onClick={() => handleTranslate('title')} title="翻译标题" className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"><Languages size={18} /></button>
                <button onClick={() => setShowSettings(true)} title="设置" className="p-2 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400"><MoreVertical size={18} /></button>
              </div>
            </div>

            {/* 作者信息区域 */}
            <div className="flex items-center justify-between text-sm mb-6">
                <div className="flex items-center space-x-3">
                    <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-10 h-10 rounded-full object-cover" />
                    <div>
                        <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName || '匿名用户'}</p>
                        <p className="text-gray-500 dark:text-gray-400">{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : '未知时间'}</p>
                    </div>
                </div>
                {!isPostAuthor && (
                    <button onClick={handleFollow} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${isFollowing ? 'bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-200' : 'bg-green-500 text-white hover:bg-green-600'}`}>
                        {isFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
                        {isFollowing ? '已关注' : '关注'}
                    </button>
                )}
            </div>
            
            {/* 视频 */}
            {videoUrl && (
              <div className="mb-6 rounded-lg overflow-hidden shadow-md"><VideoEmbed url={videoUrl} playing={true} controls={true} /></div>
            )}
            
            {/* 正文 */}
            <div className="prose dark:prose-invert max-w-none text-gray-800 dark:text-gray-200">
              <PostContent content={cleanedContent} />
            </div>
            {translatedText.content && <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">{translatedText.content}</div>}

            {/* 帖子操作栏 */}
            <div className="flex items-center justify-between mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <button onClick={() => handleVote('like')} disabled={isLiking} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${hasLiked ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                        <ThumbsUp size={16} /> {post.likesCount || 0}
                    </button>
                    <button onClick={() => handleVote('dislike')} disabled={isDisliking} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${hasDisliked ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600'}`}>
                        <ThumbsDown size={16} /> {post.dislikesCount || 0}
                    </button>
                </div>
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                    <button onClick={() => playTTS(cleanedContent)} title="朗读正文" className="p-2 hover:text-blue-500"><Volume2 size={18} /></button>
                    <button onClick={() => handleTranslate('content')} title="翻译正文" className="p-2 hover:text-blue-500"><Languages size={18} /></button>
                    <button onClick={handleShare} title="分享" className="p-2 hover:text-blue-500"><Share2 size={18} /></button>
                </div>
            </div>
          </div>


          {/* 评论区 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">评论 ({comments.length})</h2>
                <div className="flex items-center gap-2">
                    <button onClick={() => setCommentSortOrder('hot')} className={`p-1.5 rounded-md ${commentSortOrder === 'hot' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Flame size={18} title="热度排序" /></button>
                    <button onClick={() => setCommentSortOrder('time')} className={`p-1.5 rounded-md ${commentSortOrder === 'time' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}><Clock size={18} title="时间排序" /></button>
                </div>
            </div>
            
            <div className="mb-6">
                <CommentForm
                    onSubmit={handleCommentSubmit}
                    placeholder={user ? "发表你的看法..." : "请登录后发表评论..."}
                    isSubmitting={isCommenting}
                />
            </div>
            
            <div className="space-y-5">
              {sortedMainComments.length > 0 ? (
                sortedMainComments.slice(0, mainCommentsToShow).map(thread => 
                  <CommentThread 
                    key={thread.id} 
                    comment={thread} 
                    replies={thread.replies}
                    user={user}
                    onReply={handleCommentSubmit}
                    onDelete={handleDeleteComment}
                    onLike={handleLikeComment}
                  />
                )
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-4">还没有人评论，快来抢沙发吧！</p>
              )}
            </div>

            {sortedMainComments.length > mainCommentsToShow && (
                <div className="mt-6 text-center">
                    <button onClick={() => setMainCommentsToShow(sortedMainComments.length)} className="text-blue-500 font-semibold hover:underline flex items-center gap-1 mx-auto">
                        查看全部 {sortedMainComments.length} 条评论 <ChevronDown size={16} />
                    </button>
                </div>
            )}
            {sortedMainComments.length > 3 && mainCommentsToShow === sortedMainComments.length && (
                 <div className="mt-6 text-center">
                    <button onClick={() => setMainCommentsToShow(3)} className="text-blue-500 font-semibold hover:underline flex items-center gap-1 mx-auto">
                        收起 <ChevronUp size={16} />
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>
      
      {/* 弹窗 */}
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      
      {/* 设置弹窗 */}
      {showSettings && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowSettings(false)}>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4 p-5 space-y-4" onClick={e => e.stopPropagation()}>
                  <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold">设置</h3>
                      <button onClick={() => setShowSettings(false)}><X size={20}/></button>
                  </div>
                  
                  {isPostAuthor && (
                    <div className="space-y-2 border-b dark:border-gray-700 pb-4">
                        <button onClick={() => router.push(`/community/edit/${id}`)} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"><Edit size={16} /> 修改帖子</button>
                        <button onClick={handleDeletePost} className="w-full flex items-center gap-3 px-3 py-2 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/50 rounded-md"><Trash2 size={16} /> 删除帖子</button>
                    </div>
                  )}

                  <div className="space-y-2 border-b dark:border-gray-700 pb-4">
                    <button onClick={handleFavorite} className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                        <Bookmark size={16} className={isFavorited ? 'fill-current text-yellow-500' : ''} /> {isFavorited ? '已收藏' : '收藏帖子'}
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                      <h4 className="font-semibold text-sm">AI翻译设置 (OpenAI 兼容)</h4>
                      <input type="text" placeholder="接口地址 (API Endpoint)" value={aiConfig.endpoint} onChange={e => setAiConfig(c => ({...c, endpoint: e.target.value}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <input type="password" placeholder="密钥 (API Key)" value={aiConfig.apiKey} onChange={e => setAiConfig(c => ({...c, apiKey: e.target.value}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <input type="text" placeholder="模型 (Model)" value={aiConfig.model} onChange={e => setAiConfig(c => ({...c, model: e.target.value}))} className="w-full p-2 border rounded text-sm bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600"/>
                      <button onClick={() => {saveAiConfig(aiConfig); alert("设置已保存"); setShowSettings(false);}} className="w-full mt-2 p-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">保存设置</button>
                  </div>
              </div>
          </div>
      )}

      {isTranslating && <div className="fixed bottom-5 right-5 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">正在翻译...</div>}

    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

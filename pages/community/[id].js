// pages/community/[id].js (最终修改版)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// --- Icon Components ---
const ReadAloudIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.879 15.121A5.002 5.002 0 014 12a5 5 0 011.879-3.879m12.242 0A9 9 0 0021 12a9 9 0 00-2.879 6.121M12 12a3 3 0 100-6 3 3 0 000 6z" /></svg>;
const LikeIcon = ({ filled, className = "w-6 h-6" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9A2 2 0 0020 4h-4" /></svg>;
const DislikeIcon = ({ filled, className = "w-6 h-6" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 15v4a3 3 0 003 3l4-9V3H5.72a2 2 0 00-2 1.7l-1.38 9A2 2 0 004 16h4" /></svg>;
const FavoriteIcon = ({ filled, className = "w-6 h-6" }) => <svg className={className} fill={filled ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
const ShareIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8m-4-6l-4-4m0 0L8 6m4-4v12" /></svg>;
const TranslateIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m4 13l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V15z" /></svg>;
const MoreOptionsIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" /></svg>;
const EmojiIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const AtIcon = ({ className = "w-6 h-6" }) => <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" /></svg>;


const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
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
    try { new URL(post.videoUrl); return post.videoUrl; } catch {}
  }
  const urls = post.content?.match(/https?:\/\/[^\s<>"']+/g) || [];
  const patterns = [/youtu/, /vimeo/, /tiktok/, /facebook/, /twitch/, /dailymotion/, /bilibili/, /\.(mp4|webm|ogg|mov)$/i];
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
      const unsub = onSnapshot(ref, (snap) => {
        if (snap.exists()) {
            const postData = { id: snap.id, ...snap.data() };
            setPost(postData);
        } else {
            setError('帖子不存在或已被删除');
        }
      });
      // Increment views once
      const docSnap = await getDoc(ref);
      if (docSnap.exists()) {
        await updateDoc(ref, { viewsCount: increment(1) });
      }
      return unsub;
    } catch (e) {
      console.error(e);
      setError('加载帖子失败');
    }
  }, [id]);

  const fetchComments = useCallback(() => {
    if (!id) return () => {};
    const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(data);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      const unsubPost = fetchPost();
      const unsubComments = fetchComments();
      return () => {
        unsubPost.then(unsub => unsub && unsub());
        unsubComments();
      };
    }
  }, [id, fetchPost, fetchComments]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentContent || !commentContent.trim()) return;
    if (!user) return setShowLoginModal(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id,
        parentId: null, // This form only handles main comments
        content: commentContent.trim(),
        authorId: user.uid,
        authorName: user.displayName || '匿名',
        authorAvatar: user.photoURL,
        createdAt: serverTimestamp()
      });
      setCommentContent('');
    } catch (err) {
      console.error(err);
      alert('评论失败');
    }
  };
  
    const handleReplySubmit = async (content, parentId) => {
    if (!content || !content.trim()) return;
    if (!user) return setShowLoginModal(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id,
        parentId,
        content: content.trim(),
        authorId: user.uid,
        authorName: user.displayName || '匿名',
        authorAvatar: user.photoURL,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error(err);
      alert('回复失败');
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
      if (hasLiked) {
        await updateDoc(ref, {
          likesCount: increment(-1),
          likers: likers.filter(uid => uid !== user.uid)
        });
      } else {
        await updateDoc(ref, {
          likesCount: increment(1),
          likers: [...likers, user.uid]
        });
      }
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
      if (hasDisliked) {
        await updateDoc(ref, {
          dislikesCount: increment(-1),
          dislikers: dislikers.filter(uid => uid !== user.uid)
        });
      } else {
        await updateDoc(ref, {
          dislikesCount: increment(1),
          dislikers: [...dislikers, user.uid]
        });
      }
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


  if (authLoading || loading) return <div className="flex justify-center items-center h-screen"><p>加载中...</p></div>;
  if (error || !post) return <div className="flex justify-center items-center h-screen"><p>{error}</p></div>;

  return (
    <>
      <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0 pb-24"> {/* Added padding-bottom for comment form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8 relative">
          <div className="flex justify-between items-start">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 pr-10">{post.title}</h1>
            <div className="relative">
              <button onClick={() => setShowOptionsMenu(prev => !prev)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full">
                <MoreOptionsIcon />
              </button>
              {showOptionsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-10 border dark:border-gray-700">
                  <ul className="py-1">
                    {(user?.isAdmin || user?.uid === post?.authorId) && <>
                      <li><a href="#" onClick={(e) => { e.preventDefault(); deletePost(); setShowOptionsMenu(false); }} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">删除</a></li>
                      <li><a href="#" onClick={(e) => { e.preventDefault(); alert("修改功能待开发"); setShowOptionsMenu(false);}} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">修改</a></li>
                    </>}
                    <li><a href="#" onClick={(e) => { e.preventDefault(); toggleFavorite(); setShowOptionsMenu(false); }} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">{hasFavorited ? '取消收藏' : '收藏'}</a></li>
                    <li><a href="#" onClick={(e) => { e.preventDefault(); setShowTranslateSettings(true); setShowOptionsMenu(false); }} className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">翻译设置</a></li>
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
          <div className="prose dark:prose-invert max-w-none my-4">
            <PostContent content={translatedContent.post || cleanedContent} />
          </div>

          <div className="flex items-center justify-end text-gray-600 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-4 space-x-5">
              <button onClick={() => playCachedTTS(cleanedContent)} className="flex items-center space-x-1.5 hover:text-blue-500"><ReadAloudIcon className="w-5 h-5" /></button>
              <button onClick={handleTranslate} className="flex items-center space-x-1.5 hover:text-green-500"><TranslateIcon className="w-5 h-5" /></button>
              <button onClick={() => toggleLike(post.id, 'post')} className={`flex items-center space-x-1.5 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-5 h-5" /><span>{post.likesCount || 0}</span></button>
              <button onClick={() => toggleDislike(post.id, 'post')} className={`flex items-center space-x-1.5 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-5 h-5" /><span>{post.dislikesCount || 0}</span></button>
              <div className="relative">
                 <button onClick={() => setShowShareMenu(prev => !prev)} className="flex items-center space-x-1.5 hover:text-indigo-500"><ShareIcon className="w-5 h-5" /></button>
                 {showShareMenu && <SharePanel url={window.location.href} title={post.title} onClose={() => setShowShareMenu(false)} />}
              </div>
              <button onClick={toggleFavorite} className={`flex items-center space-x-1.5 ${hasFavorited ? 'text-yellow-500' : 'hover:text-yellow-500'}`}><FavoriteIcon filled={hasFavorited} className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
          
          <div className="space-y-4">
            {(showAllComments ? comments.filter(c => !c.parentId) : comments.filter(c => !c.parentId).slice(0, 3))
              .map(c => (
                <CommentItem key={c.id} comment={c} comments={comments} onReply={handleReplySubmit} user={user} 
                onLike={toggleLike} onDislike={toggleDislike} translatedContent={translatedContent.comments[c.id]}/>
              ))}
          </div>

          {comments.filter(c => !c.parentId).length > 3 && (
            <button onClick={() => setShowAllComments(!showAllComments)} className="text-blue-500 text-sm mt-4 w-full text-center">
              {showAllComments ? '收起部分评论' : '查看全部评论'}
            </button>
          )}

        </div>
      </div>
      
      {/* New Chat-style Comment Form */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-900 border-t dark:border-gray-200 dark:border-gray-700">
        <div className="container mx-auto max-w-3xl p-2">
            <form onSubmit={handleCommentSubmit} className="flex items-center space-x-2">
                <div className="flex-grow bg-white dark:bg-gray-800 rounded-full flex items-center px-2">
                   <button type="button" className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><EmojiIcon /></button>
                   <button type="button" className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"><AtIcon /></button>
                   <input
                     type="text"
                     value={commentContent}
                     onChange={e => setCommentContent(e.target.value)}
                     placeholder={user ? "说点什么..." : "请登录后评论"}
                     className="w-full h-10 px-2 bg-transparent focus:outline-none text-gray-900 dark:text-white"
                     disabled={!user}
                   />
                </div>
                <button type="submit" disabled={!user || !commentContent.trim()} className="px-5 py-2 bg-blue-500 text-white rounded-full font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed">发送</button>
            </form>
        </div>
      </div>

      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      {showTranslateSettings && <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />}
    </>
  );
};

export default PostDetailPage;

const CommentItem = ({ comment, comments, onReply, user, onLike, onDislike, translatedContent }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [showAllReplies, setShowAllReplies] = useState(false);
  const childComments = comments.filter(c => c.parentId === comment.id);

  const hasLiked = user && comment.likers?.includes(user.uid);
  const hasDisliked = user && comment.dislikers?.includes(user.uid);

  const handleReplyFormSubmit = (e) => {
      e.preventDefault();
      onReply(replyContent, comment.id);
      setReplyContent('');
      setShowReplyInput(false);
  }

  return (
    <div className="flex space-x-3 border-b border-gray-100 dark:border-gray-700 pb-4 last:border-b-0">
      <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
          <span className="font-semibold text-sm">{comment.authorName}</span>
          <p className="text-gray-800 dark:text-gray-200 my-1">{translatedContent || comment.content}</p>
        </div>
        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1 pl-2">
          <span>{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
          <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4" /><span>{comment.likesCount || 0}</span></button>
          <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4" /><span>{comment.dislikesCount || 0}</span></button>
          <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:underline">回复</button>
          <button onClick={() => playCachedTTS(comment.content)} className="hover:text-blue-500"><ReadAloudIcon className="w-4 h-4" /></button>
        </div>

        {showReplyInput && (
          <form onSubmit={handleReplyFormSubmit} className="mt-2 flex space-x-2">
            <input 
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder={`回复 @${comment.authorName}`} 
                className="flex-grow border rounded-md p-2 text-sm bg-gray-50 dark:bg-gray-600 dark:border-gray-500" 
             />
            <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start">提交</button>
          </form>
        )}
        
        {childComments.length > 0 && (
           <div className="mt-3 space-y-3 border-l-2 border-gray-200 dark:border-gray-600 pl-4">
             {(showAllReplies ? childComments : childComments.slice(0, 3)).map(child => (
               <CommentReplyItem key={child.id} comment={child} onLike={onLike} onDislike={onDislike} user={user} />
             ))}
             {childComments.length > 3 && (
               <button onClick={() => setShowAllReplies(!showAllReplies)} className="text-xs text-blue-500 hover:underline">
                 {showAllReplies ? '收起回复' : `展开剩余 ${childComments.length - 3} 条回复`}
               </button>
             )}
           </div>
        )}
      </div>
    </div>
  );
};

const CommentReplyItem = ({ comment, onLike, onDislike, user }) => {
    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);

    return (
        <div className="flex space-x-2">
            <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-6 h-6 rounded-full" />
            <div className="flex-1">
                <p className="text-sm">
                    <span className="font-semibold">{comment.authorName}: </span>
                    <span className="text-gray-800 dark:text-gray-200">{comment.content}</span>
                </p>
                <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{comment.createdAt?.toDate?.().toLocaleTimeString() || ''}</span>
                    <button onClick={() => onLike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-3 h-3" /><span>{comment.likesCount || 0}</span></button>
                    <button onClick={() => onDislike(comment.id, 'comment')} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-3 h-3" /><span>{comment.dislikesCount || 0}</span></button>
                </div>
            </div>
        </div>
    );
};

const SharePanel = ({ url, title, onClose }) => {
    const sharePlatforms = [
        { name: 'WeChat', icon: 'https://img.icons8.com/color/48/000000/weixing.png', link: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}` },
        { name: 'Weibo', icon: 'https://img.icons8.com/color/48/000000/sina-weibo.png', link: `http://service.weibo.com/share/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'QQ', icon: 'https://img.icons8.com/color/48/000000/qq.png', link: `http://connect.qq.com/widget/shareqq/index.html?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}` },
        { name: 'Twitter', icon: 'https://img.icons8.com/color/48/000000/twitter.png', link: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}` },
        { name: 'Facebook', icon: 'https://img.icons8.com/color/48/000000/facebook-new.png', link: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}` },
    ];

    return (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border dark:border-gray-700 p-2">
            <p className="text-sm font-semibold text-center mb-2">分享到</p>
            <div className="grid grid-cols-3 gap-2">
                {sharePlatforms.map(p => (
                    <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-xs hover:bg-gray-100 dark:hover:bg-gray-700 p-1 rounded-md">
                        <img src={p.icon} alt={p.name} className="w-8 h-8"/>
                        <span>{p.name}</span>
                    </a>
                ))}
            </div>
             <button onClick={onClose} className="absolute top-0 right-0 text-gray-500 hover:text-gray-800 p-1">&times;</button>
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
        setSettings(prev => ({...prev, [name]: value}));
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

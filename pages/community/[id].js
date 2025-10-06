// pages/community/[id].js (最终修复版 - 解决音频警告并包含所有优化)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp, writeBatch, getDocs
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// 动态导入组件
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(m => m.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

/** === TTS 缓存与优化后的播放函数 (修复 AudioContext 警告) === */
const ttsCache = new Map(); // 缓存 Blob URL，而不是 Audio 对象
const currentAudio = { instance: null };

// 预加载只获取数据，不创建 Audio 对象
const preloadTTS = async (text) => {
  if (!text || ttsCache.has(text)) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    ttsCache.set(text, URL.createObjectURL(blob)); // 缓存可以播放的 URL
  } catch (error) {
    console.error(`预加载TTS "${text}" 失败:`, error);
  }
};

// [FIX] 在用户首次点击时才创建 Audio 对象
const playCachedTTS = (text) => {
  if (!text) return;
  if (currentAudio.instance) {
    currentAudio.instance.pause();
    currentAudio.instance.currentTime = 0;
  }

  const play = () => {
    const audioSrc = ttsCache.get(text);
    if (audioSrc) {
      const audio = new Audio(audioSrc); // 在用户手势（点击）后创建
      currentAudio.instance = audio;
      audio.play();
      audio.onended = () => { currentAudio.instance = null; };
    }
  };

  if (ttsCache.has(text)) {
    play();
  } else {
    preloadTTS(text).then(play);
  }
};


/** === 视频URL解析 (无变化) === */
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
  const { user, authLoading } = useAuth();
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const videoUrl = useMemo(() => post && parseVideoUrl(post), [post]);
  const cleanedContent = useMemo(() => post ? removeUrlFromText(post.content, videoUrl) : '', [post, videoUrl]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const postRef = doc(db, 'posts', id);
    
    const unsubscribePost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        const postData = { id: snap.id, ...snap.data() };
        setPost(postData);
        preloadTTS(postData.title);
        preloadTTS(removeUrlFromText(postData.content, parseVideoUrl(postData)));
      } else {
        setError('帖子不存在或已被删除');
        setPost(null);
      }
      setLoading(false);
    }, (err) => {
      console.error("帖子监听失败:", err);
      setError('加载帖子失败');
      setLoading(false);
    });

    updateDoc(postRef, { viewsCount: increment(1) }).catch(console.error);
    
    const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
    const unsubscribeComments = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(data);
    }, (err) => {
      console.error("评论监听失败:", err);
    });

    return () => {
      unsubscribePost();
      unsubscribeComments();
    };
  }, [id]);

  const handleCommentSubmit = async (e, parentId = null, inputRef = null) => {
    e.preventDefault();
    const text = parentId ? inputRef?.current?.value : commentContent;
    if (!text || !text.trim()) return;
    if (!user) return setShowLoginModal(true);
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
      console.error("评论失败:", err);
      alert('评论失败');
    }
  };

  const toggleLike = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const ref = doc(db, 'posts', id);
    const hasLiked = post.likers?.includes(user.uid);
    const hasDisliked = post.dislikers?.includes(user.uid);
    
    const updates = {};
    if (hasLiked) {
      updates.likesCount = increment(-1);
      updates.likers = post.likers.filter(uid => uid !== user.uid);
    } else {
      updates.likesCount = increment(1);
      updates.likers = [...(post.likers || []), user.uid];
      if (hasDisliked) {
        updates.dislikesCount = increment(-1);
        updates.dislikers = post.dislikers.filter(uid => uid !== user.uid);
      }
    }
    await updateDoc(ref, updates).catch(console.error);
  };

  const toggleDislike = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const ref = doc(db, 'posts', id);
    const hasLiked = post.likers?.includes(user.uid);
    const hasDisliked = post.dislikers?.includes(user.uid);

    const updates = {};
    if (hasDisliked) {
      updates.dislikesCount = increment(-1);
      updates.dislikers = post.dislikers.filter(uid => uid !== user.uid);
    } else {
      updates.dislikesCount = increment(1);
      updates.dislikers = [...(post.dislikers || []), user.uid];
      if (hasLiked) {
        updates.likesCount = increment(-1);
        updates.likers = post.likers.filter(uid => uid !== user.uid);
      }
    }
    await updateDoc(ref, updates).catch(console.error);
  };

  const hasLiked = useMemo(() => user && post?.likers?.includes(user.uid), [user, post?.likers]);
  const hasDisliked = useMemo(() => user && post?.dislikers?.includes(user.uid), [user, post?.dislikers]);

  const toggleFavorite = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const userRef = doc(db, 'users', user.uid);
    const hasFav = (user.favorites || []).includes(post.id); 
    try {
      if (hasFav) {
        await updateDoc(userRef, { favorites: (user.favorites || []).filter(pid => pid !== post.id) });
      } else {
        await updateDoc(userRef, { favorites: [...(user.favorites || []), post.id] });
      }
    } catch (e) { console.error("收藏失败:", e); }
  };

  const deletePost = async () => {
    if (!(user?.isAdmin || user?.uid === post?.authorId)) return;
    if (confirm('确认删除此帖子及其所有评论吗？此操作不可撤销。')) {
      try {
        const batch = writeBatch(db);
        batch.delete(doc(db, 'posts', id));
        const commentsQuery = query(collection(db, 'comments'), where('postId', '==', id));
        const commentsSnapshot = await getDocs(commentsQuery);
        commentsSnapshot.forEach(commentDoc => batch.delete(commentDoc.ref));
        await batch.commit();
        router.push('/community');
      } catch (error) {
        console.error("删除帖子失败:", error);
        alert('删除失败，请稍后再试。');
      }
    }
  };

  if (authLoading || loading) return <LayoutBaseDynamic><div className="text-center p-10">加载中...</div></LayoutBaseDynamic>;
  if (error) return <LayoutBaseDynamic><div className="text-center p-10 text-red-500">{error}</div></LayoutBaseDynamic>;
  if (!post) return <LayoutBaseDynamic><div className="text-center p-10">帖子加载完成，但内容为空。</div></LayoutBaseDynamic>;

  return (
    <LayoutBaseDynamic>
      <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0">
        <article className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8">
          <header className="flex justify-between items-start mb-4">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">{post.title}</h1>
            <div className="flex-shrink-0 flex items-center space-x-2 text-gray-500">
              <button onClick={() => playCachedTTS(post.title)} title="朗读标题" className="hover:text-blue-500">🔊</button>
              <button onClick={() => navigator.share?.({ title: post.title, url: window.location.href })} title="分享" className="hover:text-blue-500">📤</button>
              {(user?.isAdmin || user?.uid === post?.authorId) && (
                <button onClick={deletePost} className="text-red-500 hover:text-red-700 font-semibold">删除</button>
              )}
            </div>
          </header>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2 mb-4">
            <img src={post.authorAvatar || '/img/avatar.svg'} className="w-8 h-8 rounded-full object-cover" alt={post.authorName} />
            <span className="font-semibold">{post.authorName}</span>
            <span>·</span>
            <span>{post.createdAt?.toDate?.().toLocaleString() || '未知时间'}</span>
            <span>·</span>
            <span>浏览 {post.viewsCount || 0}</span>
          </div>
          {videoUrl && <div className="my-4"><VideoEmbed url={videoUrl} controls /></div>}
          {cleanedContent && (
            <div className="prose dark:prose-invert max-w-none my-4">
              <PostContent content={cleanedContent} />
              <button onClick={() => playCachedTTS(cleanedContent)} className="text-sm text-blue-500 mt-2">🔊 朗读正文</button>
            </div>
          )}
          <footer className="flex items-center space-x-4 border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
            <button onClick={toggleLike} className={`flex items-center space-x-1 ${hasLiked ? 'text-red-500 font-bold' : 'text-gray-600 dark:text-gray-300'}`} disabled={authLoading}>
              <span>👍</span><span>{post.likesCount || 0}</span>
            </button>
            <button onClick={toggleDislike} className={`flex items-center space-x-1 ${hasDisliked ? 'text-blue-500 font-bold' : 'text-gray-600 dark:text-gray-300'}`} disabled={authLoading}>
              <span>👎</span><span>{post.dislikesCount || 0}</span>
            </button>
            <button onClick={toggleFavorite} className="flex items-center space-x-1 text-gray-600 dark:text-gray-300" disabled={authLoading}>
              <span>⭐</span><span>收藏</span>
            </button>
          </footer>
        </article>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
          {comments.filter(c => !c.parentId).slice(0, showAllComments ? undefined : 3)
            .map(c => (
              <CommentItem key={c.id} comment={c} allComments={comments} onReply={handleCommentSubmit} user={user} depth={0} />
          ))}
          {comments.filter(c => !c.parentId).length > 3 && (
            <button onClick={() => setShowAllComments(!showAllComments)} className="text-blue-500 text-sm mt-2 hover:underline">
              {showAllComments ? '收起部分评论' : '展开所有评论'}
            </button>
          )}

          <form onSubmit={e => handleCommentSubmit(e, null)} className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-4">
            <textarea
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
              placeholder={user ? "写下你的评论..." : "请登录后发表评论"}
              className="w-full border rounded p-2 bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 outline-none"
              rows="3"
              disabled={authLoading || !user}
            />
            <button type="submit" disabled={authLoading || !user || !commentContent.trim()} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400 disabled:cursor-not-allowed">
              发表评论
            </button>
          </form>
        </section>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

const CommentItem = ({ comment, allComments, onReply, user, depth }) => {
  const [showReply, setShowReply] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const inputRef = useRef(null);
  const childComments = useMemo(() => allComments.filter(c => c.parentId === comment.id), [allComments, comment.id]);
  
  if (depth > 5) return null; 

  return (
    <div className={`mt-4 ${depth > 0 ? 'ml-4 sm:ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4' : ''}`}>
      <div className="flex items-start space-x-3">
        <img src={comment.authorAvatar || '/img/avatar.svg'} className="w-8 h-8 rounded-full object-cover" alt={comment.authorName} />
        <div className="flex-1">
          <div className="flex items-center space-x-2 text-sm">
            <span className="font-semibold text-gray-800 dark:text-gray-200">{comment.authorName}</span>
            <span className="text-gray-400">{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
            <button onClick={() => playCachedTTS(comment.content)} title="朗读评论" className="text-gray-400 hover:text-blue-500">🔊</button>
          </div>
          <p className="mt-1 text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{comment.content}</p>
          <div className="mt-1">
            <button onClick={() => setShowReply(!showReply)} className="text-xs text-blue-500 hover:underline">回复</button>
          </div>
          {showReply && (
            <form onSubmit={(e) => { onReply(e, comment.id, inputRef); setShowReply(false); }} className="mt-2">
              <textarea ref={inputRef} placeholder={`回复 @${comment.authorName}`} className="w-full border rounded p-2 text-sm" rows="2" />
              <button type="submit" className="mt-1 px-3 py-1 bg-blue-500 text-white text-xs rounded">提交回复</button>
            </form>
          )}
          
          <div className="mt-2">
            {childComments.slice(0, showAllReplies ? undefined : 2).map(child => (
              <CommentItem key={child.id} comment={child} allComments={allComments} onReply={onReply} user={user} depth={depth + 1} />
            ))}
            {childComments.length > 2 && (
              <button onClick={() => setShowAllReplies(!showAllReplies)} className="text-xs text-blue-500 hover:underline mt-1">
                {showAllReplies ? '收起回复' : `展开其余 ${childComments.length - 2} 条回复`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

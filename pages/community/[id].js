// pages/community/[id].js (贴吧版 - 加强最终版)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

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

  const videoUrl = useMemo(() => post && parseVideoUrl(post), [post]);
  const cleanedContent = useMemo(() => post ? removeUrlFromText(post.content, videoUrl) : '', [post, videoUrl]);

  /** 获取帖子 */
  const fetchPost = useCallback(async () => {
    if (!id) return;
    try {
      const ref = doc(db, 'posts', id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
        // 浏览量 +1
        updateDoc(ref, { viewsCount: increment(1) });
      } else {
        setError('帖子不存在或已被删除');
      }
    } catch (e) {
      console.error(e);
      setError('加载帖子失败');
    }
  }, [id]);

  /** 获取评论 */
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
      fetchPost();
      const unsub = fetchComments();
      return () => unsub();
    }
  }, [id, fetchPost, fetchComments]);

  /** 发表评论 */
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
      console.error(err);
      alert('评论失败');
    }
  };

  /** 点赞 */
  const toggleLike = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const ref = doc(db, 'posts', id);
    const hasLiked = post.likers?.includes(user.uid);
    try {
      if (hasLiked) {
        await updateDoc(ref, {
          likesCount: increment(-1),
          likers: post.likers.filter(u => u !== user.uid)
        });
      } else {
        await updateDoc(ref, {
          likesCount: increment(1),
          likers: [...(post.likers || []), user.uid]
        });
      }
    } catch (e) { console.error(e); }
  };
  const hasLiked = user && post?.likers?.includes(user.uid);

  /** 踩 */
  const toggleDislike = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const ref = doc(db, 'posts', id);
    const hasDisliked = post.dislikers?.includes(user.uid);
    try {
      if (hasDisliked) {
        await updateDoc(ref, {
          dislikesCount: increment(-1),
          dislikers: post.dislikers.filter(u => u !== user.uid)
        });
      } else {
        await updateDoc(ref, {
          dislikesCount: increment(1),
          dislikers: [...(post.dislikers || []), user.uid]
        });
      }
    } catch (e) { console.error(e); }
  };
  const hasDisliked = user && post?.dislikers?.includes(user.uid);

  /** 收藏 */
  const toggleFavorite = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const userRef = doc(db, 'users', user.uid);
    const hasFav = user.favorites?.includes(post.id);
    try {
      if (hasFav) {
        await updateDoc(userRef, { favorites: user.favorites.filter(pid => pid !== post.id) });
      } else {
        await updateDoc(userRef, { favorites: [...(user.favorites || []), post.id] });
      }
    } catch (e) { console.error(e); }
  };

  /** 删除帖子 */
  const deletePost = async () => {
    if (!(user?.isAdmin || user?.uid === post?.authorId)) return;
    if (confirm('确认删除此帖子吗？')) {
      await deleteDoc(doc(db, 'posts', id));
      router.push('/community');
    }
  };

  // --- UI ---
  if (authLoading || loading) return <LayoutBaseDynamic><p>加载中...</p></LayoutBaseDynamic>;
  if (error || !post) return <LayoutBaseDynamic><p>{error}</p></LayoutBaseDynamic>;

  return (
    <LayoutBaseDynamic>
      <div className="container mx-auto max-w-3xl py-6">
        {/* 帖子内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8">
          <div className="flex justify-between items-start">
            <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
            <div className="space-x-2">
              <button onClick={() => playCachedTTS(post.title)}>🔊</button>
              <button onClick={() => navigator.share?.({ title: post.title, url: window.location.href })}>📤</button>
              {(user?.isAdmin || user?.uid === post?.authorId) && (
                <button onClick={deletePost} className="text-red-600">⚙ 删除</button>
              )}
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500 space-x-2 mb-4">
            <img src={post.authorAvatar || '/img/avatar.svg'} className="w-8 h-8 rounded-full" />
            <span>{post.authorName}</span>
            <span>· {post.createdAt?.toDate?.().toLocaleString() || '未知时间'}</span>
            <span>· 浏览 {post.viewsCount || 0}</span>
          </div>
          {videoUrl && <VideoEmbed url={videoUrl} controls />}
          <div className="prose dark:prose-invert max-w-none my-4">
            <PostContent content={cleanedContent} />
            <button onClick={() => playCachedTTS(cleanedContent)}>🔊 朗读正文</button>
          </div>
          <div className="flex space-x-4">
            <button onClick={toggleLike} className={hasLiked ? 'text-red-500' : ''}>👍 {post.likesCount || 0}</button>
            <button onClick={toggleDislike} className={hasDisliked ? 'text-blue-500' : ''}>👎 {post.dislikesCount || 0}</button>
            <button onClick={toggleFavorite}>⭐ 收藏</button>
          </div>
        </div>

        {/* 评论区 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
          {(showAllComments ? comments.filter(c => !c.parentId) : comments.filter(c => !c.parentId).slice(0, 3))
            .map(c => (
              <CommentItem key={c.id} comment={c} comments={comments} onReply={handleCommentSubmit} user={user} />
            ))}
          {comments.filter(c => !c.parentId).length > 3 && (
            <button onClick={() => setShowAllComments(!showAllComments)} className="text-blue-500 text-sm mt-2">
              {showAllComments ? '收起评论' : '展开更多评论'}
            </button>
          )}

          {/* 评论框放最底部 */}
          <form onSubmit={e => handleCommentSubmit(e, null)} className="mt-6">
            <textarea
              value={commentContent}
              onChange={e => setCommentContent(e.target.value)}
              placeholder={user ? "写下你的评论..." : "请登录后评论"}
              className="w-full border rounded p-2"
            />
            <button type="submit" className="mt-2 px-4 py-2 bg-blue-500 text-white rounded">发表评论</button>
          </form>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

/** 评论组件 */
const CommentItem = ({ comment, comments, onReply, user }) => {
  const [showReply, setShowReply] = useState(false);
  const [showAllReplies, setShowAllReplies] = useState(false);
  const inputRef = useRef(null);
  const childComments = comments.filter(c => c.parentId === comment.id);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-4 pb-2">
      <div className="flex items-center space-x-2 mb-1">
        <img src={comment.authorAvatar || '/img/avatar.svg'} className="w-6 h-6 rounded-full" />
        <span className="font-semibold">{comment.authorName}</span>
        <span className="text-xs text-gray-400">{comment.createdAt?.toDate?.().toLocaleString() || ''}</span>
        <button onClick={() => playCachedTTS(comment.content)}>🔊</button>
      </div>
      <p className="ml-8">{comment.content}</p>
      <div className="ml-8 mt-1">
        <button onClick={() => setShowReply(!showReply)} className="text-xs text-blue-500">回复</button>
        {showReply && (
          <form onSubmit={(e) => { onReply(e, comment.id, inputRef); setShowReply(false); }} className="mt-2">
            <textarea ref={inputRef} className="w-full border rounded p-2" rows="2" />
            <button type="submit" className="mt-1 px-3 py-1 bg-blue-500 text-white rounded">提交</button>
          </form>
        )}
        {(showAllReplies ? childComments : childComments.slice(0, 6)).map(child => (
          <CommentItem key={child.id} comment={child} comments={comments} onReply={onReply} user={user} />
        ))}
        {childComments.length > 6 && (
          <button onClick={() => setShowAllReplies(!showAllReplies)} className="text-xs text-blue-500">
            {showAllReplies ? '收起回复' : '展开更多回复'}
          </button>
        )}
      </div>
    </div>
  );
};

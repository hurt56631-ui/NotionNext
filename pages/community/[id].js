// pages/community/[id].js (最终修正版)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const CommentItem = dynamic(() => import('@/components/CommentItem'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

/**
 * 【核心修正】采用 PostItem.js 中已被验证成功的、更可靠的逐行解析逻辑
 */
const parseVideoUrl = (text = '') => {
  if (!text) return null;

  const lines = text.split('\n'); // 按行分割
  for (const line of lines) {
    const url = line.trim(); // 去除每行首尾的空格
    
    // 在干净的行中匹配 URL
    const urlRegex = /(https?:\/\/[^\s<>"'()]+)/;
    const match = url.match(urlRegex);

    if (match) {
      const potentialUrl = match[0];
      const videoPatterns = [ /youtube\.com|youtu\.be/, /vimeo\.com/, /bilibili\.com/, /tiktok\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/ ];
      if (videoPatterns.some(p => p.test(potentialUrl))) {
        return potentialUrl; // 找到第一个视频链接就立即返回
      }
    }
  }

  return null; // 如果所有行都没有找到视频链接，返回 null
};


const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [commentContent, setCommentContent] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const postRef = useRef(post);
  useEffect(() => { postRef.current = post; }, [post]);

  const videoUrl = useMemo(() => {
    return post ? parseVideoUrl(post.content) : null;
  }, [post]);

  // --- 数据获取和操作函数 (保持不变) ---
  const fetchPost = useCallback(async () => { if (!id || typeof window === 'undefined' || !db) { setLoading(false); return; } try { const docRef = doc(db, 'posts', id); const docSnap = await getDoc(docRef); if (docSnap.exists()) { setPost({ id: docSnap.id, ...docSnap.data() }); } else { setError('抱歉，帖子不存在或已被删除。'); setPost(null); } } catch (err) { setError('加载帖子失败，请稍后再试。'); setPost(null); } }, [id]);
  const fetchComments = useCallback(() => { if (!id || typeof window === 'undefined' || !db) { setLoading(false); return () => {}; } const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc')); const unsubscribe = onSnapshot(q, (snapshot) => { const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); setComments(data); setLoading(false); const currentPost = postRef.current; if (currentPost && currentPost.commentsCount !== data.length) { updateDoc(doc(db, 'posts', id), { commentsCount: data.length }); } }, (err) => { setError('加载评论失败，请稍后再试。'); setComments([]); setLoading(false); }); return unsubscribe; }, [id]);
  useEffect(() => { if (id) { setLoading(true); setError(''); const unsub = fetchComments(); fetchPost(); return () => unsub(); } }, [id]);
  const handleCommentSubmit = async (e) => { e.preventDefault(); if (!commentContent.trim() || !user) { if(!user) setShowLoginModal(true); return; } setIsCommenting(true); try { await addDoc(collection(db, 'comments'), { postId: id, content: commentContent.trim(), authorId: user.uid, authorName: user.displayName || '匿名用户', authorAvatar: user.photoURL, createdAt: new Date() }); setCommentContent(''); } finally { setIsCommenting(false); } };
  const handleLike = async () => { if (!user || !post) { if(!user) setShowLoginModal(true); return; } setIsLiking(true); try { await updateDoc(doc(db, 'posts', id), { likesCount: increment(1) }); setPost(p => ({ ...p, likesCount: (p.likesCount || 0) + 1 })); } finally { setIsLiking(false); } };

  // --- 加载和错误状态的 UI (保持不变) ---
  if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen">正在加载帖子...</div></LayoutBaseDynamic>;
  if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-red-500">{error || '帖子不存在或已被删除。'}</div></LayoutBaseDynamic>;

  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4 break-words">{post.title}</h1>
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-6 space-x-3">
              <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{post.authorName}</span>
              <span>·</span>
              <span>{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : '未知时间'}</span>
            </div>
            
            <div className="content-wrapper mb-8">
              {videoUrl ? (
                <VideoEmbed url={videoUrl} />
              ) : (
                <div className="prose dark:prose-invert max-w-none">
                  {(post.content || '').split('\n').map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end">
              <button onClick={handleLike} disabled={isLiking} className="flex items-center px-4 py-2 rounded-full transition-colors duration-200 bg-red-100 text-red-600 hover:bg-red-200">
                <i className="fas fa-heart mr-2" /> 
                <span>{post.likesCount || 0}</span>
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">评论 ({comments.length})</h2>
            <div className="mb-6">
              {comments.length > 0 ? comments.map(c => <CommentItem key={c.id} comment={c} />) : <p className="text-gray-500 dark:text-gray-400 text-center">还没有人评论，快来抢沙发吧！</p>}
            </div>
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <textarea value={commentContent} onChange={e => setCommentContent(e.target.value)} placeholder={user ? "发表你的看法..." : "请登录后发表评论..."} rows="4" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y" disabled={!user || isCommenting}></textarea>
              <button type="submit" disabled={!user || isCommenting} className="w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400">
                {isCommenting ? '提交中...' : '发表评论'}
              </button>
            </form>
          </div>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

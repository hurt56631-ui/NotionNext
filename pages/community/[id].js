// pages/community/[id].js (带有调试日志的版本)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const CommentItem = dynamic(() => import('@/components/CommentItem'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const parseVideoUrl = (text = '') => {
  // 【调试日志 1】打印传入的原始文本
  console.log('[parseVideoUrl] Received content to parse:', text);

  const lines = text.split('\n');
  for (const line of lines) {
    const url = line.trim();
    const urlRegex = /(https?:\/\/[^\s<>"'()]+)/;
    const match = url.match(urlRegex);
    if (match) {
      const potentialUrl = match[0];
      const videoPatterns = [ /youtube\.com|youtu\.be/, /vimeo\.com/, /bilibili\.com/, /tiktok\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/ ];
      if (videoPatterns.some(p => p.test(potentialUrl))) {
        // 【调试日志 2】打印成功找到的 URL
        console.log('[parseVideoUrl] Found video URL:', potentialUrl);
        return potentialUrl;
      }
    }
  }
  // 【调试日志 3】如果没找到，也打印出来
  console.log('[parseVideoUrl] No video URL found, returning null.');
  return null;
};

const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // ... 其他 state 和 ref ...
  const [commentContent, setCommentContent] = useState('');
  const [isCommenting, setIsCommenting] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const postRef = useRef(post);
  useEffect(() => { postRef.current = post; }, [post]);
  
  // ... 数据获取函数保持不变 ...
  const fetchPost = useCallback(async () => { if (!id || typeof window === 'undefined' || !db) { setLoading(false); return; } try { const docRef = doc(db, 'posts', id); const docSnap = await getDoc(docRef); if (docSnap.exists()) { setPost({ id: docSnap.id, ...docSnap.data() }); } else { setError('抱歉，帖子不存在或已被删除。'); setPost(null); } } catch (err) { setError('加载帖子失败，请稍后再试。'); setPost(null); } }, [id]);
  const fetchComments = useCallback(() => { if (!id || typeof window === 'undefined' || !db) { setLoading(false); return () => {}; } const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc')); const unsubscribe = onSnapshot(q, (snapshot) => { const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); setComments(data); setLoading(false); const currentPost = postRef.current; if (currentPost && currentPost.commentsCount !== data.length) { updateDoc(doc(db, 'posts', id), { commentsCount: data.length }); } }, (err) => { setError('加载评论失败，请稍后再试。'); setComments([]); setLoading(false); }); return unsubscribe; }, [id]);
  useEffect(() => { if (id) { setLoading(true); setError(''); const unsub = fetchComments(); fetchPost(); return () => unsub(); } }, [id]);
  const handleCommentSubmit = async (e) => { e.preventDefault(); if (!commentContent.trim() || !user) { if(!user) setShowLoginModal(true); return; } setIsCommenting(true); try { await addDoc(collection(db, 'comments'), { postId: id, content: commentContent.trim(), authorId: user.uid, authorName: user.displayName || '匿名用户', authorAvatar: user.photoURL, createdAt: new Date() }); setCommentContent(''); } finally { setIsCommenting(false); } };
  const handleLike = async () => { if (!user || !post) { if(!user) setShowLoginModal(true); return; } setIsLiking(true); try { await updateDoc(doc(db, 'posts', id), { likesCount: increment(1) }); setPost(p => ({ ...p, likesCount: (p.likesCount || 0) + 1 })); } finally { setIsLiking(false); } };


  // 【调试日志 4】在组件渲染时打印 post 状态和解析结果
  if (post) {
      console.log('COMPONENT RENDER: Full post data is:', post);
      const videoUrl = parseVideoUrl(post.content);
      console.log('COMPONENT RENDER: Final videoUrl passed to VideoEmbed is:', videoUrl);
  }

  // ... 加载和错误 UI 保持不变 ...
  if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen">正在加载帖子...</div></LayoutBaseDynamic>;
  if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-red-500">{error || '帖子不存在或已被删除。'}</div></LayoutBaseDynamic>;

  // 在 return 语句中再次计算 videoUrl，确保 UI 正确
  const videoUrl = post ? parseVideoUrl(post.content) : null;
  
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
            
            <div className="flex justify-end">{/* ... 点赞按钮 ... */}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">{/* ... 评论区 ... */}</div>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

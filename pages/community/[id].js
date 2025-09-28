// pages/community/[id].js (最终版)
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import PostContent from '@/components/PostContent'; // 导入我们强大的新组件

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const CommentItem = dynamic(() => import('@/components/CommentItem'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

const formatTimestamp = (ts) => {
  if (!ts) return '未知时间';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('zh-CN');
  } catch (e) { return '日期格式错误'; }
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

  // ... 数据获取和操作函数 ...
  const fetchPost = useCallback(async () => { try { const docRef = doc(db, 'posts', id); const docSnap = await getDoc(docRef); if (docSnap.exists()) { setPost({ id: docSnap.id, ...docSnap.data() }); } else { setError('帖子不存在'); } } catch (err) { setError('加载帖子失败'); } }, [id]);
  const fetchComments = useCallback(() => { const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc')); return onSnapshot(q, (snapshot) => { setComments(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); }, () => { setError('加载评论失败'); setLoading(false); }); }, [id]);
  useEffect(() => { if (id) { setLoading(true); const unsub = fetchComments(); fetchPost(); return () => unsub(); } }, [id]);
  const handleCommentSubmit = async (e) => { e.preventDefault(); if (!commentContent.trim() || !user) return; setIsCommenting(true); try { await addDoc(collection(db, 'comments'), { postId: id, content: commentContent.trim(), authorId: user.uid, authorName: user.displayName || '匿名', authorAvatar: user.photoURL, createdAt: new Date() }); setCommentContent(''); } finally { setIsCommenting(false); } };
  const handleLike = async () => { if (!user || !post) return; setIsLiking(true); try { await updateDoc(doc(db, 'posts', id), { likesCount: increment(1) }); setPost(p => ({ ...p, likesCount: (p.likesCount || 0) + 1 })); } finally { setIsLiking(false); } };

  if (authLoading || loading) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen">正在加载...</div></LayoutBaseDynamic>;
  if (error || !post) return <LayoutBaseDynamic><div className="flex justify-center items-center min-h-screen text-red-500">{error || '帖子不存在'}</div></LayoutBaseDynamic>;

  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">{post.title}</h1>
            <div className="flex items-center text-gray-500 text-sm mb-6 space-x-3">
              <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full" />
              <span>{post.authorName}</span><span>·</span><span>{formatTimestamp(post.createdAt)}</span>
            </div>
            
            {/* 【核心修改】将整个 post 对象传递给 PostContent，并告诉它这不是预览模式 */}
            <PostContent post={post} preview={false} />
            
            <div className="flex justify-end mt-4"><button onClick={handleLike}><i className="fas fa-heart" /> {post.likesCount || 0}</button></div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-bold mb-6">评论 ({comments.length})</h2>
            <div className="mb-6">{comments.length > 0 ? comments.map(c => <CommentItem key={c.id} comment={c} />) : <p>暂无评论</p>}</div>
            <form onSubmit={handleCommentSubmit}><textarea value={commentContent} onChange={e => setCommentContent(e.target.value)} /><button type="submit" disabled={isCommenting}>发表</button></form>
          </div>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;

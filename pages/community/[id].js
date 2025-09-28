// pages/community/[id].js (确保所有客户端组件都动态导入)

import { useState, useEffect, useCallback, useRef } from 'react'; // 【新增】导入 useRef
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import dynamic from 'next/dynamic';
import PostContent from '@/components/PostContent';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const CommentItem = dynamic(() => import('@/components/CommentItem'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });

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
  
  // 【新增】使用 useRef 来存储 post 的最新值，避免在 useCallback 中直接依赖
  const postRef = useRef(post);
  useEffect(() => {
    postRef.current = post;
  }, [post]);

  const fetchPost = useCallback(async () => {
    console.log(`[PostDetailPage - fetchPost] 尝试获取帖子详情，ID: ${id}`);
    if (!id || typeof window === 'undefined' || !db) {
      setLoading(false);
      return;
    }
    try {
      const docRef = doc(db, 'posts', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
        console.log("[PostDetailPage - fetchPost] 帖子详情获取成功。");
      } else {
        setError('抱歉，帖子不存在或已被删除。');
        setPost(null);
      }
    } catch (err) {
      console.error("[PostDetailPage - fetchPost] 获取帖子详情失败:", err);
      setError('加载帖子失败，请稍后再试。');
      setPost(null);
    }
  }, [id]);

  const fetchComments = useCallback(() => {
    console.log(`[PostDetailPage - fetchComments] 尝试监听评论，帖子ID: ${id}`);
    if (!id || typeof window === 'undefined' || !db) {
      setLoading(false);
      return () => {};
    }
    const commentsCollectionRef = collection(db, 'comments');
    const q = query(commentsCollectionRef, where('postId', '==', id), orderBy('createdAt', 'asc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComments(commentsData);
      setLoading(false);
      console.log(`[PostDetailPage - fetchComments] 评论数据更新，共 ${commentsData.length} 条。`);
      
      // 【修改】使用 postRef.current 来访问最新的 post 状态，而不是直接依赖 post
      const currentPost = postRef.current;
      if (currentPost && currentPost.commentsCount !== commentsData.length) {
        updateDoc(doc(db, 'posts', id), {
            commentsCount: commentsData.length
        }).catch(e => console.error("更新评论数量失败", e));
      }

    }, (err) => {
      console.error("[PostDetailPage - fetchComments] 监听评论失败:", err);
      setError('加载评论失败，请稍后再试。');
      setComments([]);
      setLoading(false);
    });
    return unsubscribe;
  // 【修改】从依赖项中移除了 post，打破了循环
  }, [id]);

  useEffect(() => {
    if (id) {
      setLoading(true);
      setError('');
      if (typeof window !== 'undefined') {
        fetchPost();
        const unsubscribeComments = fetchComments();
        return () => {
          unsubscribeComments();
        };
      } else {
        setLoading(false);
      }
    }
  // 【修改】从依赖项中移除了 fetchPost 和 fetchComments，直接依赖 id
  }, [id]);

  // ... handleCommentSubmit 和 handleLike 函数保持不变 ...
  const handleCommentSubmit = async (e) => { e.preventDefault(); if (!commentContent.trim()) { alert('评论内容不能为空！'); return; } if (!user) { setShowLoginModal(true); return; } setIsCommenting(true); try { await addDoc(collection(db, 'comments'), { postId: id, content: commentContent.trim(), authorId: user.uid, authorName: user.displayName || user.email || '匿名用户', authorAvatar: user.photoURL || '/images/avatar-placeholder.png', createdAt: new Date(), }); setCommentContent(''); } catch (err) { console.error("[PostDetailPage - handleCommentSubmit] 发布评论失败:", err); alert('发布评论失败，请稍后再试。'); } finally { setIsCommenting(false); } };
  const handleLike = async () => { if (!user) { setShowLoginModal(true); return; } if (!db || !post || isLiking) return; setIsLiking(true); try { const postDocRef = doc(db, 'posts', id); await updateDoc(postDocRef, { likesCount: increment(1) }); setPost(prevPost => ({ ...prevPost, likesCount: (prevPost.likesCount || 0) + 1 })); } catch (err) { console.error("[PostDetailPage - handleLike] 点赞失败:", err); alert('点赞失败，请稍后再试。'); } finally { setIsLiking(false); } };

  if (authLoading || loading) {
    return (
      <LayoutBaseDynamic>
        <div className="flex justify-center items-center min-h-screen text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在加载帖子...
        </div>
      </LayoutBaseDynamic>
    );
  }
  
  if (error || !post) {
    return (
      <LayoutBaseDynamic>
        <div className="flex justify-center items-center min-h-screen text-red-500">
          <p className="text-xl">{error || '帖子不存在或已被删除。'}</p>
        </div>
      </LayoutBaseDynamic>
    );
  }

  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4 break-words">
              {post.title}
            </h1>
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-6 space-x-3">
              <img src={post.authorAvatar || '/images/avatar-placeholder.png'} alt={post.authorName} className="w-8 h-8 rounded-full" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{post.authorName}</span>
              <span>·</span>
              <span>{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : '未知时间'}</span>
              {post.category && ( <> <span>·</span> <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">{post.category}</span> </> )}
            </div>
            <div className="max-w-none text-gray-700 dark:text-gray-200 leading-relaxed mb-8">
              <PostContent content={post.content || ''} preview={false} />
            </div>
            <div className="flex justify-end">
              <button onClick={handleLike} disabled={isLiking || !user} className={`flex items-center px-4 py-2 rounded-full transition-colors duration-200 ${ isLiking ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800' }`} >
                <i className={`fas fa-heart ${user ? 'mr-2' : ''}`}></i>
                <span>{post.likesCount || 0}</span>
              </button>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">评论 ({comments.length})</h2>
            <div className="mb-6">
              {comments.length > 0 ? ( comments.map(comment => <CommentItem key={comment.id} comment={comment} />) ) : ( <p className="text-gray-500 dark:text-gray-400 text-center">还没有人评论，快来抢沙发吧！</p> )}
            </div>
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <textarea value={commentContent} onChange={(e) => setCommentContent(e.target.value)} placeholder={user ? "发表你的看法..." : "请登录后发表评论..."} rows="4" className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y" disabled={isCommenting || !user}></textarea>
              <button type="submit" disabled={isCommenting || !user} className={`w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 ${ isCommenting || !user ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700' } flex items-center justify-center`}>
                {isCommenting ? ( <> <i className="fas fa-spinner fa-spin mr-2"></i> 提交中... </> ) : ( '发表评论' )}
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

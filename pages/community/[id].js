// pages/community/[id].js (确保所有客户端组件都动态导入)

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, orderBy, onSnapshot, addDoc, updateDoc, increment } from 'firebase/firestore';
// db 在服务器端可能为 null，这是正常的，我们已在 lib/firebase.js 中处理
import { db } from '@/lib/firebase'; 
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo'; 
import dynamic from 'next/dynamic';

// 确保所有在客户端渲染的组件都使用 dynamic import 和 ssr: false
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

  const fetchPost = useCallback(async () => {
    console.log(`[PostDetailPage - fetchPost] 尝试获取帖子详情，ID: ${id}`);
    if (!id || typeof window === 'undefined' || !db) { 
      console.warn("[PostDetailPage - fetchPost] Firestore 实例 (db) 不可用或运行在服务器端。跳过获取帖子详情。");
      setLoading(false);
      return;
    }

    try {
      const postRef = doc(db, 'posts', id);
      const postSnap = await getDoc(postRef);

      if (postSnap.exists()) {
        setPost({ id: postSnap.id, ...postSnap.data() });
        console.log("[PostDetailPage - fetchPost] 帖子详情获取成功。");
      } else {
        setError('抱歉，帖子不存在或已被删除。');
        setPost(null);
        console.warn("[PostDetailPage - fetchPost] 帖子不存在。");
      }
    } catch (err) {
      console.error("[PostDetailPage - fetchPost] 获取帖子详情失败:", err);
      setError('加载帖子失败，请稍后再试。');
      setPost(null);
    } finally {
      // 不在此处设置 loading(false)，等待评论也加载
    }
  }, [id, db]); // 依赖项中添加 db

  const fetchComments = useCallback(() => {
    console.log(`[PostDetailPage - fetchComments] 尝试监听评论，帖子ID: ${id}`);
    if (!id || typeof window === 'undefined' || !db) { 
      console.warn("[PostDetailPage - fetchComments] Firestore 实例 (db) 不可用或运行在服务器端。跳过监听评论。");
      setLoading(false);
      return () => {}; // 返回空函数作为 cleanup
    }

    const commentsRef = collection(db, 'comments');
    const q = query(commentsRef, where('postId', '==', id), orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setComments(commentsData);
      setLoading(false); 
      console.log(`[PostDetailPage - fetchComments] 评论数据更新，共 ${commentsData.length} 条。`);
      
      // 检查commentsCount是否需要更新（客户端简单更新，或依赖云函数）
      if (post && post.commentsCount !== commentsData.length) {
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

    return () => unsubscribe(); 
  }, [id, post, db]); // 依赖项中添加 db

  useEffect(() => {
    if (id) {
      console.log("[PostDetailPage - useEffect] ID 变化，重置加载状态并开始获取数据。");
      setLoading(true); 
      setError('');
      // 确保只在浏览器环境中执行数据获取
      if (typeof window !== 'undefined') {
        fetchPost();
        const unsubscribeComments = fetchComments(); 
        return () => {
          unsubscribeComments();
        };
      } else {
        // 在服务器端，立即设置 loading 为 false
        setLoading(false);
        console.log("[PostDetailPage - useEffect] 运行在服务器端，setLoading(false)。");
      }
    }
  }, [id, fetchPost, fetchComments]); 


  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) {
      alert('评论内容不能为空！');
      return;
    }
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!db) {
      setError('数据库服务不可用。');
      return;
    }

    setIsCommenting(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id,
        content: commentContent.trim(),
        authorId: user.uid,
        authorName: user.displayName || user.email || '匿名用户', 
        authorAvatar: user.photoURL || '/images/avatar-placeholder.png', 
        createdAt: new Date(), 
      });
      setCommentContent(''); 
    } catch (err) {
      console.error("[PostDetailPage - handleCommentSubmit] 发布评论失败:", err);
      alert('发布评论失败，请稍后再试。');
    } finally {
      setIsCommenting(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    if (!db || !post || isLiking) return;

    setIsLiking(true);
    try {
      const postRef = doc(db, 'posts', id);
      await updateDoc(postRef, {
        likesCount: increment(1)
      });
      setPost(prevPost => ({ ...prevPost, likesCount: (prevPost.likesCount || 0) + 1 }));
    } catch (err) {
      console.error("[PostDetailPage - handleLike] 点赞失败:", err);
      alert('点赞失败，请稍后再试。');
    } finally {
      setIsLiking(false);
    }
  };


  if (authLoading || loading) {
    return (
      <LayoutBaseDynamic> {/* 使用动态导入的 LayoutBaseDynamic */}
        <div className="flex justify-center items-center min-h-screen text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在加载帖子...
        </div>
      </LayoutBaseDynamic>
    );
  }
  
  if (error || !post) {
    return (
      <LayoutBaseDynamic> {/* 使用动态导入的 LayoutBaseDynamic */}
        <div className="flex justify-center items-center min-h-screen text-red-500">
          <p className="text-xl">{error || '帖子不存在或已被删除。'}</p>
        </div>
      </LayoutBaseDynamic>
    );
  }

  return (
    <LayoutBaseDynamic> {/* 使用动态导入的 LayoutBaseDynamic */}
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          {/* 帖子内容区域 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4 break-words">
              {post.title}
            </h1>
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-6 space-x-3">
              <img
                src={post.authorAvatar || '/images/avatar-placeholder.png'}
                alt={post.authorName}
                className="w-8 h-8 rounded-full"
              />
              <span className="font-medium text-gray-700 dark:text-gray-300">{post.authorName}</span>
              <span>·</span>
              <span>{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : '未知时间'}</span>
              {post.category && (
                <>
                  <span>·</span>
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                    {post.category}
                  </span>
                </>
              )}
            </div>

            <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-200 leading-relaxed mb-8">
              <p>{post.content}</p>
            </div>

            {/* 点赞按钮 */}
            <div className="flex justify-end">
              <button
                onClick={handleLike}
                disabled={isLiking || !user}
                className={`flex items-center px-4 py-2 rounded-full transition-colors duration-200 ${
                  isLiking ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
                }`}
              >
                <i className={`fas fa-heart ${user ? 'mr-2' : ''}`}></i>
                <span>{post.likesCount || 0}</span>
              </button>
            </div>
          </div>

          {/* 评论区域 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
              评论 ({comments.length})
            </h2>

            {/* 评论列表 */}
            <div className="mb-6">
              {comments.length > 0 ? (
                comments.map(comment => <CommentItem key={comment.id} comment={comment} />)
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center">还没有人评论，快来抢沙发吧！</p>
              )}
            </div>

            {/* 评论输入框 */}
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <textarea
                value={commentContent}
                onChange={(e) => setCommentContent(e.target.value)}
                placeholder={user ? "发表你的看法..." : "请登录后发表评论..."}
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y"
                disabled={isCommenting || !user}
              ></textarea>
              <button
                type="submit"
                disabled={isCommenting || !user}
                className={`w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 ${
                  isCommenting || !user ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                } flex items-center justify-center`}
              >
                {isCommenting ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i> 提交中...
                  </>
                ) : (
                  '发表评论'
                )}
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

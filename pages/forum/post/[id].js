// pages/forum/post/[id].js
import { useState, useEffect } from 'react';
import { doc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../lib/AuthContext';
import { useRouter } from 'next/router';

const PostDetailPage = () => {
  const router = useRouter();
  const { id: postId } = router.query;
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  // 获取帖子详情
  useEffect(() => {
    if (!postId) return;
    const postRef = doc(db, 'posts', postId);
    getDoc(postRef).then((docSnap) => {
      if (docSnap.exists()) {
        setPost({ id: docSnap.id, ...docSnap.data() });
      } else {
        console.log("找不到该帖子!");
      }
      setLoading(false);
    });
  }, [postId]);

  // 实时获取评论
  useEffect(() => {
    if (!postId) return;
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const commentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setComments(commentsData);
    });
    return () => unsubscribe();
  }, [postId]);

  // 提交新评论
  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      await addDoc(commentsRef, {
        text: newComment,
        authorId: user.uid,
        authorName: user.displayName,
        authorAvatar: user.photoURL,
        createdAt: serverTimestamp(),
      });
      setNewComment('');
    } catch (error) {
      console.error("添加评论失败: ", error);
    }
  };

  if (loading) return <p>加载中...</p>;
  if (!post) return <p>帖子不存在。</p>;

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      {/* 帖子内容 */}
      <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
        <h1 className="text-3xl font-bold mb-4">{post.title}</h1>
        <div className="flex items-center text-gray-600 dark:text-gray-400 mb-6">
          <img src={post.authorAvatar} alt={post.authorName} className="w-8 h-8 rounded-full mr-2" />
          <span>由 {post.authorName} 发布于 {new Date(post.createdAt?.toDate()).toLocaleString()}</span>
        </div>
        <div className="prose dark:prose-invert max-w-none">
          {post.content.split('\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}
        </div>
      </div>

      {/* 评论区 */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">评论 ({comments.length})</h2>
        
        {/* 评论列表 */}
        <div className="space-y-4 mb-6">
          {comments.map(comment => (
            <div key={comment.id} className="flex items-start space-x-3">
              <img src={comment.authorAvatar} alt={comment.authorName} className="w-10 h-10 rounded-full" />
              <div className="flex-1 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <p className="font-semibold">{comment.authorName}</p>
                <p>{comment.text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* 发表评论表单 */}
        {user && (
          <form onSubmit={handleAddComment}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="发表你的看法..."
              rows="3"
              className="w-full p-2 border rounded-md dark:bg-gray-700"
            />
            <button type="submit" className="mt-2 bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
              发表评论
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default PostDetailPage;

// pages/community/[id].js (已重写，优化视频解析和渲染逻辑)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import { doc, getDoc, collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore'; // 导入 serverTimestamp
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// 动态导入所需组件
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const CommentItem = dynamic(() => import('@/components/CommentItem'), { ssr: false }); // 假设你有一个 CommentItem 组件
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(mod => mod.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false }); // 动态导入 PostContent

/**
 * 【优化】更健壮的视频链接解析函数
 *  - 优先从 post.videoUrl 字段获取。
 *  - 如果 post.videoUrl 为空，则从 post.content 文本内容中查找第一个视频链接。
 */
const parseVideoUrl = (postData) => {
  if (!postData) return null;

  // 1. 优先使用专门的 videoUrl 字段
  if (postData.videoUrl && typeof postData.videoUrl === 'string' && postData.videoUrl.trim() !== '') {
    // 简单验证是否是 URL 格式
    try { new URL(postData.videoUrl); return postData.videoUrl; } catch { /* not a valid URL */ }
  }

  // 2. 如果 videoUrl 字段无效或不存在，回退到从 content 中解析
  const text = postData.content;
  if (!text || typeof text !== 'string') return null;
  
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const allUrls = text.match(urlRegex);

  if (!allUrls) return null;

  // 匹配常见的视频平台模式，react-player 支持这些
  const videoPatterns = [
    /youtube\.com|youtu\.be/,
    /vimeo\.com/,
    /tiktok\.com/,
    /facebook\.com/,
    /twitch\.tv/,
    /dailymotion\.com/,
    /bilibili\.com/, // B站
    /\.(mp4|webm|ogg|mov)$/i // 直链视频文件
  ];

  for (const url of allUrls) {
    if (videoPatterns.some(p => p.test(url))) {
      return url;
    }
  }
  return null;
};

// 【新增】去除文本中特定 URL 的函数
const removeUrlFromText = (text, urlToRemove) => {
    if (!text || !urlToRemove || typeof text !== 'string') return text;
    // 使用全局正则表达式替换所有匹配项
    const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // 转义特殊字符
    const regex = new RegExp(escapedUrl, 'g');
    return text.replace(regex, '').trim();
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
  
  // 用于在回调中获取最新的 post 状态
  const postRef = useRef(post);
  useEffect(() => { postRef.current = post; }, [post]);

  // 【优化】使用 useMemo 来计算 videoUrl 和 清理后的内容，更高效、更清晰
  const videoUrl = useMemo(() => {
    return post ? parseVideoUrl(post) : null;
  }, [post]);

  const cleanedContent = useMemo(() => {
    if (!post || !post.content) return '';
    return videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
  }, [post, videoUrl]);


  // --- 数据获取和操作函数 ---

  const fetchPost = useCallback(async () => {
    if (!id || !db) { // 移除 typeof window === 'undefined'，这会导致 SSR 时的初始化问题
      setLoading(false); 
      return; 
    }
    try { 
      const docRef = doc(db, 'posts', id); 
      const docSnap = await getDoc(docRef); 
      if (docSnap.exists()) { 
        setPost({ id: docSnap.id, ...docSnap.data() }); 
      } else { 
        setError('抱歉，帖子不存在或已被删除。'); 
        setPost(null); 
      } 
    } catch (err) { 
      console.error("加载帖子失败:", err);
      setError('加载帖子失败，请稍后再试。'); 
      setPost(null); 
    } 
  }, [id]);

  const fetchComments = useCallback(() => { 
    if (!id || !db) { 
      setLoading(false); 
      return () => {}; 
    } 
    const q = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc')); 
    const unsubscribe = onSnapshot(q, (snapshot) => { 
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })); 
      setComments(data); 
      // 【优化】只有在 postRef.current 存在且评论数不同时才更新 Firestore
      const currentPost = postRef.current; 
      if (currentPost && currentPost.commentsCount !== data.length) { 
        updateDoc(doc(db, 'posts', id), { commentsCount: data.length }); 
      }
      setLoading(false); // 在评论加载完成后，才设置 loading 为 false
    }, (err) => { 
      console.error("监听评论失败:", err);
      setError('加载评论失败，请稍后再试。'); 
      setComments([]); 
      setLoading(false); 
    }); 
    return unsubscribe; 
  }, [id]);

  useEffect(() => { 
    if (id) { 
      setLoading(true); 
      setError(''); 
      fetchPost(); // 先获取帖子
      const unsub = fetchComments(); // 再监听评论
      return () => unsub(); 
    } 
  }, [id, fetchPost, fetchComments]); // 依赖项包含 fetchPost 和 fetchComments


  const handleCommentSubmit = async (e) => { 
    e.preventDefault(); 
    if (!commentContent.trim()) return;

    if (!user) { 
      setShowLoginModal(true); 
      return; 
    } 
    setIsCommenting(true); 
    try { 
      await addDoc(collection(db, 'comments'), { 
        postId: id, 
        content: commentContent.trim(), 
        authorId: user.uid, 
        authorName: user.displayName || '匿名用户', 
        authorAvatar: user.photoURL, 
        createdAt: serverTimestamp() // 使用 serverTimestamp 确保时间一致性
      }); 
      setCommentContent(''); 
    } catch (error) {
      console.error("发表评论失败:", error);
      alert("发表评论失败，请重试。");
    } finally { 
      setIsCommenting(false); 
    } 
  };
  
  const handleLike = async () => { 
    if (!user || !post) { 
      setShowLoginModal(true); 
      return; 
    } 
    setIsLiking(true); 
    try { 
      // 【优化】增加点赞者列表，防止重复点赞，且更准确
      const postDocRef = doc(db, 'posts', id);
      const hasLiked = post.likers?.includes(user.uid);

      if (hasLiked) {
        // 取消点赞
        await updateDoc(postDocRef, {
          likesCount: increment(-1),
          likers: post.likers.filter(uid => uid !== user.uid)
        });
        setPost(p => ({ ...p, likesCount: (p.likesCount || 0) - 1, likers: p.likers.filter(uid => uid !== user.uid) }));
      } else {
        // 点赞
        await updateDoc(postDocRef, { 
          likesCount: increment(1),
          likers: [...(post.likers || []), user.uid] // 添加当前用户ID到likers数组
        }); 
        setPost(p => ({ ...p, likesCount: (p.likesCount || 0) + 1, likers: [...(p.likers || []), user.uid] }));
      }
    } catch (error) {
      console.error("点赞失败:", error);
      alert("操作失败，请重试。");
    } finally { 
      setIsLiking(false); 
    } 
  };

  const hasLiked = useMemo(() => {
    return user && post?.likers?.includes(user.uid);
  }, [user, post?.likers]);

  // --- 加载和错误状态的 UI ---
  if (authLoading || loading) {
    return (
      <LayoutBaseDynamic>
        <div className="flex justify-center items-center min-h-screen text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-blue-500"></i>
          <p className="ml-4 text-gray-600 dark:text-gray-300">正在加载帖子...</p>
        </div>
      </LayoutBaseDynamic>
    );
  }
  if (error || !post) {
    return (
      <LayoutBaseDynamic>
        <div className="flex justify-center items-center min-h-screen text-red-500 text-center p-4">
          <p className="text-xl font-bold">{error || '帖子不存在或已被删除。'}</p>
        </div>
      </LayoutBaseDynamic>
    );
  }

  return (
    <LayoutBaseDynamic>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-3xl">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-8">
            {/* 标题 */}
            <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100 mb-4 break-words">{post.title}</h1>
            
            {/* 作者信息和时间 */}
            <div className="flex items-center text-gray-500 dark:text-gray-400 text-sm mb-6 space-x-3">
              <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" />
              <span className="font-medium text-gray-700 dark:text-gray-300">{post.authorName || '匿名用户'}</span>
              <span>·</span>
              <span>{post.createdAt?.toDate ? new Date(post.createdAt.toDate()).toLocaleString('zh-CN') : '未知时间'}</span>
            </div>
            
            {/* 视频播放器 */}
            {videoUrl && (
              <div className="mb-8 rounded-lg overflow-hidden shadow-md">
                <VideoEmbed 
                  url={videoUrl} 
                  playing={true} // 详情页可以自动播放
                  controls={true}
                />
              </div>
            )}
            
            {/* 帖子内容 (去除视频链接后的纯文本) */}
            <div className="prose dark:prose-invert max-w-none mb-8 text-gray-800 dark:text-gray-200">
              <PostContent content={cleanedContent} />
            </div>
            
            {/* 底部点赞按钮 */}
            <div className="flex justify-end mt-4">
              <button 
                onClick={handleLike} 
                disabled={isLiking} 
                className={`flex items-center px-4 py-2 rounded-full transition-colors duration-200 
                            ${hasLiked ? 'bg-red-500 text-white' : 'bg-red-100 text-red-600 hover:bg-red-200 dark:bg-red-800 dark:text-red-100 dark:hover:bg-red-700'}`}
              >
                <i className={`${hasLiked ? 'fas' : 'far'} fa-heart mr-2`} /> 
                <span>{post.likesCount || 0}</span>
              </button>
            </div>
          </div>

          {/* 评论区 */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">评论 ({comments.length})</h2>
            <div className="mb-6 space-y-4">
              {comments.length > 0 ? (
                comments.map(c => <CommentItem key={c.id} comment={c} />)
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center">还没有人评论，快来抢沙发吧！</p>
              )}
            </div>
            <form onSubmit={handleCommentSubmit} className="space-y-4">
              <textarea 
                value={commentContent} 
                onChange={e => setCommentContent(e.target.value)} 
                placeholder={user ? "发表你的看法..." : "请登录后发表评论..."} 
                rows="4" 
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y" 
                disabled={!user || isCommenting}
              ></textarea>
              <button 
                type="submit" 
                disabled={!user || isCommenting || !commentContent.trim()} // 【优化】内容为空时禁用
                className="w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 dark:bg-blue-700 dark:hover:bg-blue-600 dark:disabled:bg-blue-500"
              >
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

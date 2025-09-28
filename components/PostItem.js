// themes/heo/components/PostItem.js

import { useMemo, forwardRef, useRef, useEffect } from 'react'; // 导入 forwardRef、useRef 和 useEffect
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext'; // 确保导入了 useAuth

const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

// 【核心修改】使用 forwardRef 包裹 PostItem
const PostItem = forwardRef(({ post }, ref) => { // 将 ref 作为第二个参数接收
  const { user } = useAuth();
  const hasLiked = user && post.likers?.includes(user.uid);

  const videoId = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const id = getYouTubeId(line.trim());
      if (id) {
        return id;
      }
    }
    return null;
  }, [post.content]);

  const handleLike = async () => { /* 您的点赞逻辑 */ };

  return (
    // 【核心修改】将 ref 传递给最外层的 DOM 元素
    <div ref={ref} className="p-4 border-b border-gray-100 dark:border-gray-800"> {/* 添加了一个边框用于视觉分隔，也为了 ref 附着 */}
      <div className="flex items-center mb-3">
        <Link href={`/profile/${post.authorId || ''}`} passHref>
          <a className="flex items-center cursor-pointer group">
            {post.authorAvatar && (
              <img
                src={post.authorAvatar}
                alt={post.authorName}
                className="w-12 h-12 rounded-lg border-2 border-gray-100 dark:border-gray-600"
              />
            )}
            <div className="ml-3 flex-grow">
              <div className="flex items-center">
                <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors">{post.authorName || '匿名用户'}</p>
                {post.authorIsAdmin && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                    管理员
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : '不久前'}
                {post.city && ` · ${post.city}`}
              </p>
            </div>
          </a>
        </Link>

        <div className="ml-auto">
          {/* 假设 StartChatButton 存在并处理其自身逻辑 */}
          {post.authorId && user && user.uid !== post.authorId && <StartChatButton targetUserId={post.authorId} />}
        </div>
      </div>

      <Link href={`/forum/post/${post.id}`}>
        <a className="space-y-2 block my-3">
          <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>

          {!videoId && (
            <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
          )}
        </a>
      </Link>

      {videoId && (
        <Link href={`/forum/post/${post.id}`} passHref>
          <a className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2 block">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={post.title}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <i className="fas fa-play text-white text-4xl bg-black/50 p-4 rounded-full"></i>
            </div>
          </a>
        </Link>
      )}

      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button
          onClick={handleLike}
          className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500 animate-pulse' : 'hover:text-red-500'}`}
        >
          {hasLiked ? <i className="fas fa-heart text-lg"></i> : <i className="far fa-heart text-lg"></i>}
          <span className="text-sm font-semibold">{post.likersCount || 0}</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-gray-500 transition-colors">
          <i className="far fa-thumbs-down text-lg"></i>
        </button>
        <Link href={`/forum/post/${post.id}#comments`}>
          <a className="flex items-center space-x-2 hover:text-green-500 transition-colors">
            <i className="far fa-comment-dots text-lg"></i>
            <span className="text-sm font-semibold">{post.commentCount || 0}</span>
          </a>
        </Link>
      </div>
    </div>
  );
});

export default PostItem;

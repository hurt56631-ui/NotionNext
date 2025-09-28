// themes/heo/components/PostItem.js (已修复点击跳转问题)

import React, { forwardRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router'; // 【新增】导入 useRouter
import { useAuth } from '@/lib/AuthContext';
import PostContent from '@/components/PostContent';

// 【已修改】使用 date-fns 实现相对时间
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch (e) {
    return '日期错误';
  }
};

const StartChatButton = ({ targetUserId }) => {
  if (!targetUserId) return null;
  return (
    <Link href={`/messages/new?to=${encodeURIComponent(targetUserId)}`} passHref>
      {/* 阻止事件冒泡，防止点击私信时触发外层的帖子链接跳转 */}
      <a onClick={(e) => e.stopPropagation()} className="relative z-10 inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="私信">
        <i className="far fa-comment-dots mr-2" /> 私信
      </a>
    </Link>
  );
};

function PostItemInner({ post }, ref) {
  const { user } = useAuth();
  const router = useRouter(); // 【新增】获取 router 实例

  if (!post) return null;

  const hasLiked = !!(user && Array.isArray(post.likers) && post.likers.includes(user.uid));
  
  // 【新增】处理整个卡片点击的函数
  const handleCardClick = () => {
    router.push(`/community/${post.id}`);
  };

  // 【新增】阻止事件冒泡的通用处理函数
  const handleActionClick = (e, callback) => {
    e.stopPropagation(); // 关键：阻止事件传递到外层的 div
    if (callback) callback(e);
  };
  
  const handleLike = async () => { if (!user) return; /* ... 你的点赞逻辑 ... */ };

  return (
    // 【修改】添加 onClick 和 cursor-pointer，使其成为可点击区域
    <div ref={ref} onClick={handleCardClick} className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
      <div className="flex items-start mb-3">
        {/* 头像和用户名的链接 */}
        <Link href={`/profile/${post.authorId || ''}`} passHref>
          <a onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center cursor-pointer group">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-12 h-12 rounded-full object-cover" />
            <div className="ml-3 flex-grow">
              <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        {/* 私信按钮 */}
        <div className="ml-auto">
          {post.authorId && user && user.uid !== post.authorId && <StartChatButton targetUserId={post.authorId} />}
        </div>
      </div>

      {/* 帖子标题和内容 */}
      <div className="space-y-2 block my-3">
        {/* 【修改】移除这里的 Link，因为整个卡片都可点击 */}
        <h2 className="text-lg font-bold dark:text-gray-100 group-hover:text-blue-500">
          {post.title}
        </h2>
        <PostContent post={post} preview={true} />
      </div>

      {/* 底部操作栏 */}
      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button onClick={(e) => handleActionClick(e, handleLike)} className={`relative z-10 flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
            <span>{post.likersCount || 0}</span>
        </button>
        <button onClick={(e) => handleActionClick(e)} className="relative z-10 flex items-center space-x-1 hover:text-gray-500">
            <i className="far fa-thumbs-down text-lg" />
        </button>
        <Link href={`/community/${post.id}#comments`} passHref>
            <a onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center space-x-2 hover:text-green-500">
                <i className="far fa-comment-dots text-lg" />
                <span>{post.commentCount || 0}</span>
            </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

// themes/heo/components/PostItem.js (最终重写版)

import React, { forwardRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import PostContent from '@/components/PostContent'; // 保留强大的内容组件

// 【已修改】使用 date-fns 实现相对时间
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 1. 修改时间格式化函数
const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    // 兼容 Firestore 时间戳和普通 Date 对象
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch (e) {
    console.error('日期格式化失败:', e);
    return '日期错误';
  }
};

// 私信按钮组件 (无修改)
const StartChatButton = ({ targetUserId }) => {
  if (!targetUserId) return null;
  // 阻止事件冒泡，防止点击私信时触发外层的帖子链接跳转
  const handleClick = (e) => e.stopPropagation();
  return (
    <Link href={`/messages/new?to=${encodeURIComponent(targetUserId)}`} passHref>
      <a onClick={handleClick} className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="私信">
        <i className="far fa-comment-dots mr-2" /> 私信
      </a>
    </Link>
  );
};

// PostItem 主组件
function PostItemInner({ post }, ref) {
  const { user } = useAuth();
  if (!post) return null;

  const hasLiked = !!(user && Array.isArray(post.likers) && post.likers.includes(user.uid));
  
  // 阻止事件冒泡的通用处理函数
  const handleActionClick = (e, callback) => {
    e.stopPropagation(); // 关键：阻止事件传递到外层的 Link
    if (callback) callback(e);
  };
  
  const handleLike = async () => { if (!user) return; /* ... 你的点赞逻辑 ... */ };

  return (
    // 2. 将根元素设为相对定位，为“拉伸链接”做准备
    <div ref={ref} className="relative p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      
      {/* 3. 这是核心：一个覆盖整个卡片的隐形链接，作为默认点击行为 */}
      <Link href={`/community/${post.id}`} passHref>
        <a className="absolute inset-0 z-10" aria-hidden="true"></a>
      </Link>

      {/* 4. 将所有可独立交互的元素放在 z-20 层，使其“浮”在隐形链接之上 */}
      <div className="relative z-20">
        <div className="flex items-start mb-3"> {/* 5. 使用 items-start 让用户名位置更高 */}
          <Link href={`/profile/${post.authorId || ''}`} passHref>
            <a onClick={(e) => e.stopPropagation()} className="flex items-center cursor-pointer group">
              {/* 6. 将头像改为圆形 */}
              <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-12 h-12 rounded-full object-cover" />
              <div className="ml-3 flex-grow">
                <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.createdAt)}</p>
              </div>
            </a>
          </Link>
          <div className="ml-auto">
            {post.authorId && user && user.uid !== post.authorId && <StartChatButton targetUserId={post.authorId} />}
          </div>
        </div>

        {/* 帖子标题和内容区域。点击这里会触发底层的隐形链接 */}
        <div className="space-y-2 block my-3">
          {/* 7. 移除标题上的 Link，因为它现在是多余的 */}
          <h2 className="text-lg font-bold dark:text-gray-100 group-hover:text-blue-500">
            {post.title}
          </h2>
          <PostContent post={post} preview={true} />
        </div>

        {/* 底部操作栏 */}
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
          <button onClick={(e) => handleActionClick(e, handleLike)} className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
              <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
              <span>{post.likersCount || 0}</span>
          </button>
          <button onClick={(e) => handleActionClick(e)} className="flex items-center space-x-1 hover:text-gray-500">
              <i className="far fa-thumbs-down text-lg" />
          </button>
          <Link href={`/community/${post.id}#comments`} passHref>
              <a onClick={(e) => e.stopPropagation()} className="flex items-center space-x-2 hover:text-green-500">
                  <i className="far fa-comment-dots text-lg" />
                  <span>{post.commentCount || 0}</span>
              </a>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

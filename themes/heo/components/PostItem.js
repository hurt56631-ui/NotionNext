// themes/heo/components/PostItem.js (最终版)
import React, { forwardRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import PostContent from '@/components/PostContent'; // 导入我们强大的新组件

const formatTimestamp = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString('zh-CN');
  } catch (e) { return '日期格式错误'; }
};

const StartChatButton = ({ targetUserId }) => {
  if (!targetUserId) return null;
  return (
    <Link href={`/messages/new?to=${encodeURIComponent(targetUserId)}`} passHref>
      <a className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="私信">
        <i className="far fa-comment-dots mr-2" /> 私信
      </a>
    </Link>
  );
};

function PostItemInner({ post }, ref) {
  const { user } = useAuth();
  if (!post) return null;

  const hasLiked = !!(user && Array.isArray(post.likers) && post.likers.includes(user.uid));
  const handleLike = async (e) => { e?.preventDefault?.(); if (!user) return; };

  return (
    <div ref={ref} className="p-4 border-b border-gray-100 dark:border-gray-800">
      <div className="flex items-center mb-3">
        <Link href={`/profile/${post.authorId || ''}`} passHref>
          <a className="flex items-center cursor-pointer group">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-12 h-12 rounded-lg object-cover" />
            <div className="ml-3 flex-grow">
              <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimestamp(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        <div className="ml-auto">
          {post.authorId && user && user.uid !== post.authorId && <StartChatButton targetUserId={post.authorId} />}
        </div>
      </div>

      <div className="space-y-2 block my-3">
        <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">
          <Link href={`/community/${post.id}`} passHref><a>{post.title}</a></Link>
        </h2>
        
        {/* 【确认】这里将整个 post 对象传递过去，是正确的 */}
        <PostContent post={post} preview={true} />
      </div>

      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button onClick={handleLike} className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
            <span>{post.likersCount || 0}</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-gray-500">
            <i className="far fa-thumbs-down text-lg" />
        </button>
        <Link href={`/community/${post.id}#comments`} passHref>
            <a className="flex items-center space-x-2 hover:text-green-500">
                <i className="far fa-comment-dots text-lg" />
                <span>{post.commentCount || 0}</span>
            </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

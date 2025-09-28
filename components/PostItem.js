import React, { forwardRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
// 【第一步：新增】导入我们创建的 PostContent 组件
import PostContent from '@/components/PostContent';


/**
 * helper: 提取 YouTube id（支持短链 / watch / embed / shorts）
 * (这个函数现在不再被直接使用，因为 PostContent 会处理所有视频链接，但我们暂时保留它以防万一)
 */
const getYouTubeId = (url) => {
  if (!url) return null;
  const regExp = /^.*(?:youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[1] && match[1].length >= 6) ? match[1] : null;
};

/**
 * helper: 安全地把各种 createdAt 转换成可读字符串
 * 支持 Firestore Timestamp (toDate)、数字时间戳、日期字符串等
 */
const formatTimestamp = (ts) => {
  if (!ts) return '不久前';
  try {
    if (typeof ts.toDate === 'function') {
      return new Date(ts.toDate()).toLocaleString();
    }
    if (typeof ts === 'number') {
      return new Date(ts).toLocaleString();
    }
    // 如果传来已经是 Date 或 ISO 字符串
    return new Date(ts).toLocaleString();
  } catch (e) {
    return '不久前';
  }
};

/**
 * 简单的私信按钮实现（内置在组件中，避免未定义导致的 React 错误）
 */
const StartChatButton = ({ targetUserId }) => {
  if (!targetUserId) return null;
  return (
    <Link href={`/messages/new?to=${encodeURIComponent(targetUserId)}`} passHref>
      <a
        className="inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition"
        aria-label="私信"
      >
        <i className="far fa-comment-dots mr-2" />
        私信
      </a>
    </Link>
  );
};

/**
 * PostItem 主体（支持 ref 转发）
 */
function PostItemInner(props, ref) {
  const { post } = props || {};
  const { user } = useAuth();

  if (!post) return null;

  // 安全判定 likers（可能为 undefined）
  const hasLiked = !!(user && Array.isArray(post.likers) && post.likers.includes(user.uid));

  // 【第二步：移除】下面的 videoId 和 useMemo 不再需要，因为 PostContent 会处理一切。
  // 我们将其注释掉，而不是直接删除，以便你理解变化。
  /*
  const videoId = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const id = getYouTubeId(line.trim());
      if (id) return id;
    }
    return null;
  }, [post.content]);
  */

  const handleLike = async (e) => {
    e?.preventDefault?.();
    if (!user) {
      console.log('请先登录再进行点赞');
      return;
    }
    console.log('点赞（示例）:', post.id);
    // TODO: 补充点赞逻辑
  };

  return (
    <div ref={ref} className="p-4 border-b border-gray-100 dark:border-gray-800">
      {/* 用户信息部分保持不变 */}
      <div className="flex items-center mb-3">
        <Link href={`/profile/${post.authorId || ''}`} passHref>
          <a className="flex items-center cursor-pointer group">
            {post.authorAvatar && (
              <img
                src={post.authorAvatar}
                alt={post.authorName || '作者头像'}
                className="w-12 h-12 rounded-lg border-2 border-gray-100 dark:border-gray-600 object-cover"
              />
            )}
            <div className="ml-3 flex-grow">
              <div className="flex items-center">
                <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors">
                  {post.authorName || '匿名用户'}
                </p>
                {post.authorIsAdmin && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                    管理员
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatTimestamp(post.createdAt)}{post.city ? ` · ${post.city}` : ''}
              </p>
            </div>
          </a>
        </Link>
        <div className="ml-auto">
          {post.authorId && user && user.uid !== post.authorId && (
            <StartChatButton targetUserId={post.authorId} />
          )}
        </div>
      </div>

      {/* 【第三步：修改】用 PostContent 替换掉之前复杂的 Link 和 videoId 判断逻辑 */}
      <div className="space-y-2 block my-3">
        {/* 标题部分，单独作为一个链接 */}
        <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100 transition-colors">
            <Link href={`/community/${post.id}`} passHref>
                <a>{post.title}</a>
            </Link>
        </h2>

        {/* 使用 PostContent 来渲染正文。它会自动处理文本、链接和视频预览 */}
        <PostContent
            content={post.content || ''}
            preview={true} // 告诉组件使用预览模式
            previewLink={`/community/${post.id}`} // 点击预览图时跳转的链接
        />
      </div>

      {/* 底部操作按钮部分保持不变 */}
      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button
          onClick={handleLike}
          className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500 animate-pulse' : 'hover:text-red-500'}`}
          aria-label="点赞"
        >
          {hasLiked ? <i className="fas fa-heart text-lg" /> : <i className="far fa-heart text-lg" />}
          <span className="text-sm font-semibold">{post.likersCount || 0}</span>
        </button>

        <button className="flex items-center space-x-1 hover:text-gray-500 transition-colors" aria-hidden>
          <i className="far fa-thumbs-down text-lg" />
        </button>

        <Link href={`/community/${post.id}#comments`} passHref>
          <a className="flex items-center space-x-2 hover:text-green-500 transition-colors" aria-label="评论">
            <i className="far fa-comment-dots text-lg" />
            <span className="text-sm font-semibold">{post.commentCount || 0}</span>
          </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

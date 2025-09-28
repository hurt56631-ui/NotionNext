import React, { forwardRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

/**
 * helper: 提取 YouTube id（支持短链 / watch / embed / shorts）
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
 * 如果项目中已经有全局 StartChatButton，你可以把这里替换成动态 import 或直接删除此定义并 import 真正组件
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
 * 如果你在外层已经把 ref 绑到容器上（更推荐的做法），PostItem 也能正常工作。
 */
function PostItemInner(props, ref) {
  const { post } = props || {};
  const { user } = useAuth();

  if (!post) return null;

  // 安全判定 likers（可能为 undefined）
  const hasLiked = !!(user && Array.isArray(post.likers) && post.likers.includes(user.uid));

  const videoId = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const id = getYouTubeId(line.trim());
      if (id) return id;
    }
    return null;
  }, [post.content]);

  const handleLike = async (e) => {
    e?.preventDefault?.();
    // 这里只是占位：真实项目可在外层注入 onLike 或直接调用 firebase 更新
    if (!user) {
      console.log('请先登录再进行点赞');
      return;
    }
    console.log('点赞（示例）:', post.id);
    // TODO: 补充点赞逻辑
  };

  return (
    <div ref={ref} className="p-4 border-b border-gray-100 dark:border-gray-800">
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
          {/* 如果作者存在且当前用户不是作者则显示私信按钮 */}
          {post.authorId && user && user.uid !== post.authorId && (
            <StartChatButton targetUserId={post.authorId} />
          )}
        </div>
      </div>

      {/*【已修改】将 href 中的 /forum/post/ 改为 /community/ */}
      <Link href={`/community/${post.id}`} passHref>
        <a className="space-y-2 block my-3">
          <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>

          {!videoId && (
            <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">
              {post.content}
            </p>
          )}
        </a>
      </Link>

      {videoId && (
        /*【已修改】将 href 中的 /forum/post/ 改为 /community/ */
        <Link href={`/community/${post.id}`} passHref>
          <a className="relative w-full aspect-video bg-black rounded-lg overflow-hidden group mt-2 block">
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt={post.title || '视频封面'}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <i className="fas fa-play text-white text-4xl bg-black/50 p-4 rounded-full" />
            </div>
          </a>
        </Link>
      )}

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

        {/*【已修改】将 href 中的 /forum/post/ 改为 /community/ */}
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

// themes/heo/components/PostItem.js
import React, { forwardRef, useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';

// 这是一个更通用的视频链接解析函数
const parseVideoUrl = (url) => {
  if (!url) return null;
  // YouTube
  let match = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (match && match[1]) return { platform: 'youtube', id: match[1] };
  // Bilibili (简单匹配)
  match = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/);
  if (match && match[1]) return { platform: 'bilibili', id: match[1] };
  // 其他视频平台 (返回通用标记)
  const otherVideoPatterns = [ /vimeo\.com/, /tiktok\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/ ];
  if (otherVideoPatterns.some(p => p.test(url))) return { platform: 'other', id: url };

  return null;
};

const formatTimestamp = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleString();
  } catch (e) { return '不久前'; }
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

  // 在这里解析内容，找出第一个视频链接
  const videoInfo = useMemo(() => {
    if (!post.content) return null;
    const lines = post.content.split('\n');
    for (const line of lines) {
      const info = parseVideoUrl(line.trim());
      if (info) return info; // 找到第一个就返回
    }
    return null;
  }, [post.content]);

  const handleLike = async (e) => {
    e?.preventDefault?.();
    if (!user) { console.log('请先登录再进行点赞'); return; }
    console.log('点赞（示例）:', post.id);
  };

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

        {/* 根据解析出的 videoInfo 来决定显示什么 */}
        {videoInfo ? (
          // 如果有视频，显示我们自己构建的预览卡片
          <Link href={`/community/${post.id}`} passHref>
            <a className="block relative w-full aspect-video bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden group mt-2">
              {videoInfo.platform === 'youtube' ? (
                // 如果是 YouTube，显示官方缩略图
                <img src={`https://i.ytimg.com/vi/${videoInfo.id}/hqdefault.jpg`} alt={post.title || '视频预览'} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                // 其他平台，显示一个通用的预览占位符
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-500 dark:text-gray-400">观看视频</span>
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                <i className="fas fa-play text-white text-4xl bg-black/50 p-4 rounded-full" />
              </div>
            </a>
          </Link>
        ) : (
          // 如果没有视频，显示纯文本摘要
          <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">
            {post.content}
          </p>
        )}
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

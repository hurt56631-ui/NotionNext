// themes/heo/components/PostItem.js (已重写，包含视频预览和完整点赞逻辑)

import React, { forwardRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore'; // 【新增】Firestore操作
import { db } from '@/lib/firebase'; // 【新增】导入 db

// 【新增】动态导入 VideoEmbed 和 PostContent
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

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

/**
 * 【从 PostDetail 复制过来，用于帖子预览】视频链接解析函数
 *  - 优先从 post.videoUrl 字段获取。
 *  - 如果 post.videoUrl 为空，则从 post.content 文本内容中查找第一个视频链接。
 */
const parseVideoUrl = (postData) => {
  if (!postData) return null;

  // 1. 优先使用专门的 videoUrl 字段
  if (postData.videoUrl && typeof postData.videoUrl === 'string' && postData.videoUrl.trim() !== '') {
    try { new URL(postData.videoUrl); return postData.videoUrl; } catch { /* not a valid URL */ }
  }

  // 2. 如果 videoUrl 字段无效或不存在，回退到从 content 中解析
  const text = postData.content;
  if (!text || typeof text !== 'string') return null;
  
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const allUrls = text.match(urlRegex);

  if (!allUrls) return null;

  const videoPatterns = [
    /youtube\.com|youtu\.be/, /vimeo\.com/, /tiktok\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/,
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

// 【从 PostDetail 复制过来】去除文本中特定 URL 的函数
const removeUrlFromText = (text, urlToRemove) => {
    if (!text || !urlToRemove || typeof text !== 'string') return text;
    const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const regex = new RegExp(escapedUrl, 'g');
    return text.replace(regex, '').trim();
};


// 【修改】StartChatButton 接收 onOpenChat prop
const StartChatButton = ({ targetUserId, onOpenChat }) => {
  if (!targetUserId) return null;
  // 阻止事件冒泡，防止点击私信时触发外层的帖子链接跳转
  const handleClick = (e) => {
    e.stopPropagation();
    onOpenChat(targetUserId); // 调用传入的 onOpenChat 回调
  };
  return (
    <button onClick={handleClick} className="relative z-10 inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="私信">
      <i className="far fa-comment-dots mr-2" /> 私信
    </button>
  );
};


// 【修改】PostItemInner 接收 onOpenChat prop，并包含完整点赞逻辑
function PostItemInner({ post, onOpenChat }, ref) { // 【修改】接收 onOpenChat
  const { user } = useAuth();
  const router = useRouter(); 

  if (!post) return null;

  // 使用 useMemo 获取视频URL和清理后的内容
  const videoUrl = useMemo(() => {
    return parseVideoUrl(post);
  }, [post]);

  const cleanedContent = useMemo(() => {
    if (!post || !post.content) return '';
    // 预览模式下，只显示部分内容，所以先清理，再截取
    const fullCleanedContent = videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
    // 帖子预览通常只显示一部分内容，这里可以做截断
    const previewLength = 150; // 预览文字长度限制
    if (fullCleanedContent.length > previewLength) {
      return fullCleanedContent.substring(0, previewLength) + '...';
    }
    return fullCleanedContent;
  }, [post, videoUrl]);


  // 【优化】点赞逻辑，直接在 PostItem 中更新 Firestore
  const hasLiked = useMemo(() => {
    return user && post.likers && post.likers.includes(user.uid);
  }, [user, post.likers]);

  const handleLike = useCallback(async (e) => {
    e.stopPropagation(); // 阻止点击事件冒泡到帖子卡片
    if (!user || !post || !db) return; // 如果未登录或帖子数据不存在，或 db 不可用，则返回

    const postDocRef = doc(db, 'posts', post.id);
    try {
      if (hasLiked) {
        // 取消点赞
        await updateDoc(postDocRef, {
          likesCount: increment(-1),
          likers: arrayRemove(user.uid)
        });
        // 【注意】这里不直接更新 `post` 状态，因为 `PostItem` 接收的是 `post` prop，
        // 最好让父组件通过 Firestore 实时监听来更新其 `posts` 列表，从而触发 PostItem 重新渲染。
        // 如果父组件没有实时监听，你可以考虑在这里通过 `setPosts` 回调来更新父组件的 posts 列表，但这会复杂化 PostItem 的设计。
      } else {
        // 点赞
        await updateDoc(postDocRef, {
          likesCount: increment(1),
          likers: arrayUnion(user.uid)
        });
        // 同上，依赖父组件的 Firestore 监听来更新。
      }
    } catch (error) {
      console.error("点赞操作失败:", error);
      alert("点赞/取消点赞失败，请重试。");
    }
  }, [user, post, hasLiked]);


  // 【处理整个卡片点击的函数】
  const handleCardClick = () => {
    router.push(`/community/${post.id}`);
  };

  // 【阻止事件冒泡的通用处理函数】
  const handleActionClick = (e, callback) => {
    e.stopPropagation(); 
    if (callback) callback(e);
  };
  

  return (
    <div ref={ref} onClick={handleCardClick} className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
      <div className="flex items-start mb-3">
        {/* 头像和用户名的链接，点击头像区域可以打开聊天 */}
        <Link href={`/me?profileId=${post.authorId || ''}`} passHref> {/* 【修改】指向个人主页 */}
          <a onClick={(e) => handleActionClick(e)} className="relative z-10 flex items-center cursor-pointer group">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-12 h-12 rounded-full object-cover" />
            <div className="ml-3 flex-grow">
              <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        {/* 私信按钮 */}
        <div className="ml-auto">
          {post.authorId && user && user.uid !== post.authorId && <StartChatButton targetUserId={post.authorId} onOpenChat={onOpenChat} />} {/* 传递 onOpenChat */}
        </div>
      </div>

      <div className="space-y-2 block my-3">
        {/* 帖子标题 */}
        <h2 className="text-lg font-bold dark:text-gray-100 group-hover:text-blue-500">
          {post.title}
        </h2>
        
        {/* 【新增】如果帖子有视频链接，则渲染视频播放器 (预览模式) */}
        {videoUrl && (
          <div className="relative pt-[56.25%] overflow-hidden rounded-lg mb-4 shadow-md"> {/* 16:9 比例容器 */}
            <VideoEmbed 
              url={videoUrl} 
              playing={false} // 预览时不自动播放
              controls={true}
              width='100%'
              height='100%'
              className="absolute top-0 left-0" // 填充容器
            />
          </div>
        )}

        {/* 【修改】渲染清理后的内容 */}
        <div className="text-sm text-gray-700 dark:text-gray-300">
          <PostContent content={cleanedContent} />
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button onClick={handleLike} className={`relative z-10 flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
            <span>{post.likesCount || 0}</span>
        </button>
        <button onClick={(e) => handleActionClick(e)} className="relative z-10 flex items-center space-x-1 hover:text-gray-500">
            <i className="far fa-thumbs-down text-lg" />
        </button>
        <Link href={`/community/${post.id}#comments`} passHref>
            <a onClick={(e) => e.stopPropagation()} className="relative z-10 flex items-center space-x-2 hover:text-green-500">
                <i className="far fa-comment-dots text-lg" />
                <span>{post.commentsCount || 0}</span>
            </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

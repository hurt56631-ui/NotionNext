// themes/heo/components/PostItem.js (最终美化版 - 替换图标、优化排版)

import React, { forwardRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
// ✅ 导入所有需要的 Lucide 图标
import { Volume2, MessageSquare, ThumbsUp, ThumbsDown, Send, Heart } from 'lucide-react';

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// --- TTS 朗读功能模块 (无变化) ---
const playCachedTTS = (text) => {
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    new Audio(url).play();
  } catch (error) { console.error("TTS playback failed:", error); }
};
// --- TTS 模块结束 ---


const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch (e) {
    return '日期错误';
  }
};

const parseVideoUrl = (postData) => {
  if (!postData) return null;
  if (postData.videoUrl && typeof postData.videoUrl === 'string' && postData.videoUrl.trim() !== '') {
    try { new URL(postData.videoUrl); return postData.videoUrl; } catch { /* not a valid URL */ }
  }
  const text = postData.content;
  if (!text || typeof text !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const allUrls = text.match(urlRegex);
  if (!allUrls) return null;
  const videoPatterns = [
    /youtube\.com|youtu\.be/, /vimeo\.com/, /tiktok\.com/, /facebook\.com/, /twitch\.tv/, /dailymotion\.com/,
    /bilibili\.com/, 
    /\.(mp4|webm|ogg|mov)$/i 
  ];
  for (const url of allUrls) {
    if (videoPatterns.some(p => p.test(url))) {
      return url;
    }
  }
  return null;
};

const removeUrlFromText = (text, urlToRemove) => {
    if (!text || !urlToRemove || typeof text !== 'string') return text;
    const escapedUrl = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
    const regex = new RegExp(escapedUrl, 'g');
    return text.replace(regex, '').trim();
};

// --- 私信按钮组件 ---
const StartChatButton = ({ targetUser }) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();

  if (!targetUser || !targetUser.uid || !currentUser || currentUser.uid === targetUser.uid) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
    router.push(`/messages/${chatId}`);
  };

  // ✅ 美化：按钮样式更新，更精致
  return (
    <button onClick={handleClick} className="relative z-10 inline-flex items-center px-3 py-1.5 rounded-full bg-blue-500 text-white text-xs font-semibold hover:bg-blue-600 transition-colors active:scale-95 shadow-sm" aria-label="私信">
      <Send size={14} className="mr-1.5" /> 私信
    </button>
  );
};

// --- 帖子列表项 ---
function PostItemInner({ post }, ref) {
  const { user } = useAuth();
  const router = useRouter(); 

  if (!post) {
      return null; 
  }

  const videoUrl = useMemo(() => parseVideoUrl(post), [post]);

  const cleanedContent = useMemo(() => {
    if (!post || !post.content) return ''; 
    const fullCleanedContent = videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
    const previewLength = 120; // 缩短预览长度，更适合移动端
    if (fullCleanedContent.length > previewLength) {
      return fullCleanedContent.substring(0, previewLength) + '...';
    }
    return fullCleanedContent;
  }, [post, videoUrl]);

  const hasLiked = useMemo(() => user && post.likers?.includes(user.uid), [user, post.likers]);

  const handleLike = useCallback(async (e) => {
    e.stopPropagation(); 
    if (!user || !post || !db) {
        alert("请先登录再点赞");
        return; 
    }

    const postDocRef = doc(db, 'posts', post.id);
    try {
      if (hasLiked) {
        await updateDoc(postDocRef, { likesCount: increment(-1), likers: arrayRemove(user.uid) });
      } else {
        await updateDoc(postDocRef, { likesCount: increment(1), likers: arrayUnion(user.uid) });
      }
    } catch (error) {
      console.error("点赞操作失败:", error);
      alert("点赞/取消点赞失败，请重试。");
    }
  }, [user, post, hasLiked]);

  const handleCardClick = useCallback(() => router.push(`/community/${post.id}`), [router, post.id]);
  const handleActionClick = useCallback((e, callback) => {
    e.stopPropagation(); 
    if (callback) callback(e);
  }, []);
  const handleTtsClick = useCallback((e, text) => {
    e.stopPropagation();
    playCachedTTS(text);
  }, []);

  return (
    <div ref={ref} onClick={handleCardClick} className="bg-white dark:bg-gray-800/50 p-4 sm:p-5 border-b border-gray-100 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
      {/* 头部：头像、昵称、时间和私信按钮 */}
      <div className="flex items-center justify-between mb-4">
        <Link href={`/profile/${post.authorId}`} passHref> 
          <a onClick={handleActionClick} className="relative z-10 flex items-center group">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-11 h-11 rounded-full object-cover shadow-sm" />
            <div className="ml-3">
              <p className="font-bold text-gray-800 dark:text-gray-200 group-hover:text-blue-500 transition-colors">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        <div className="flex-shrink-0">
          <StartChatButton targetUser={{ uid: post.authorId }} />
        </div>
      </div>

      {/* 内容区：标题、视频、正文 */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 break-words">
              {post.title}
            </h2>
            <button onClick={(e) => handleTtsClick(e, post.title)} className="relative z-10 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0 text-gray-500 dark:text-gray-400" aria-label="朗读标题">
                <Volume2 size={18} />
            </button>
        </div>
        
        {videoUrl && (
          <div className="w-full rounded-lg overflow-hidden shadow-lg">
            <VideoEmbed url={videoUrl} />
          </div>
        )}

        <div className="text-gray-700 dark:text-gray-300 text-base leading-relaxed break-words">
          <PostContent content={cleanedContent} />
        </div>
      </div>

      {/* 底部操作栏：点赞、评论 */}
      <div className="flex justify-end items-center space-x-6 mt-5 text-gray-500 dark:text-gray-400">
        <button onClick={handleLike} className={`relative z-10 flex items-center space-x-1.5 transition-all duration-150 active:scale-95 group ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <Heart size={20} fill={hasLiked ? 'currentColor' : 'none'} className={`group-hover:fill-current transition-colors ${hasLiked ? '' : 'stroke-current'}`} />
            <span className="text-sm font-semibold">{post.likesCount || 0}</span>
        </button>
        
        <Link href={`/community/${post.id}#comments`} passHref>
            <a onClick={handleActionClick} className="relative z-10 flex items-center space-x-1.5 hover:text-blue-500 active:scale-95 transition-colors">
                <MessageSquare size={20} />
                <span className="text-sm font-semibold">{post.commentCount || 0}</span>
            </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

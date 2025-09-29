// themes/heo/components/PostItem.js (最终修改版)

import React, { forwardRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Volume2 } from 'lucide-react'; // 引入喇叭图标

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// --- TTS 朗读功能模块 ---
const ttsCache = new Map();
const preloadTTS = async (text) => {
  if (ttsCache.has(text)) return;
  try {
    // 使用了您提供的最新接口参数 r=-20
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) { console.error(`预加载 "${text}" 失败:`, error); }
};
const playCachedTTS = (text) => {
  if (ttsCache.has(text)) { ttsCache.get(text).play(); }
  else { preloadTTS(text).then(() => { if (ttsCache.has(text)) { ttsCache.get(text).play(); } }); }
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

const StartChatButton = ({ targetUser, onOpenChat }) => {
  if (!targetUser || !targetUser.uid) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    onOpenChat(targetUser); 
  };
  return (
    <button onClick={handleClick} className="relative z-10 inline-flex items-center px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition" aria-label="私信">
      <i className="far fa-comment-dots mr-2" /> 私信
    </button>
  );
};

function PostItemInner({ post, onOpenChat }, ref) { 
  const { user } = useAuth();
  const router = useRouter(); 

  if (!post) {
      return null; 
  }

  const videoUrl = useMemo(() => {
    if (!post) return null; 
    return parseVideoUrl(post); 
  }, [post]);

  const cleanedContent = useMemo(() => {
    if (!post || !post.content) return ''; 
    const fullCleanedContent = videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
    const previewLength = 150; 
    if (fullCleanedContent.length > previewLength) {
      return fullCleanedContent.substring(0, previewLength) + '...';
    }
    return fullCleanedContent;
  }, [post, videoUrl]);

  const hasLiked = useMemo(() => {
    return user && post.likers && post.likers.includes(user.uid);
  }, [user, post.likers]);

  const handleLike = useCallback(async (e) => {
    e.stopPropagation(); 
    if (!user || !post || !db) return; 

    const postDocRef = doc(db, 'posts', post.id);
    try {
      if (hasLiked) {
        await updateDoc(postDocRef, {
          likesCount: increment(-1),
          likers: arrayRemove(user.uid)
        });
      } else {
        await updateDoc(postDocRef, {
          likesCount: increment(1),
          likers: arrayUnion(user.uid)
        });
      }
    } catch (error) {
      console.error("点赞操作失败:", error);
      alert("点赞/取消点赞失败，请重试。");
    }
  }, [user, post, hasLiked]);

  const handleCardClick = useCallback(() => {
    router.push(`/community/${post.id}`);
  }, [router, post.id]);

  const handleActionClick = useCallback((e, callback) => {
    e.stopPropagation(); 
    if (callback) callback(e);
  }, []);
  
  const handleTtsClick = useCallback((e, text) => {
    e.stopPropagation();
    playCachedTTS(text);
  }, []);

  return (
    <div ref={ref} onClick={handleCardClick} className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
      <div className="flex items-start mb-3">
        {/* 【已修复】点击头像和名字现在指向用户的个人主页，而不是 /me */}
        <Link href={`/profile/${post.authorId}`} passHref> 
          <a onClick={handleActionClick} className="relative z-10 flex items-center cursor-pointer group">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName || '作者头像'} className="w-12 h-12 rounded-full object-cover" />
            <div className="ml-3 flex-grow">
              <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        <div className="ml-auto">
          {post.authorId && user && user.uid !== post.authorId && 
            <StartChatButton 
              targetUser={{ uid: post.authorId, displayName: post.authorName || '匿名用户' }} 
              onOpenChat={onOpenChat} 
            />
          } 
        </div>
      </div>

      {/* 【已修复】移除了外层 div 的 my-3，减少了垂直间距 */}
      <div className="space-y-3 block">
        <div className="flex items-center justify-between gap-2">
            {/* 【已新增】为标题增加TTS朗读按钮 */}
            <h2 className="text-lg font-bold dark:text-gray-100 group-hover:text-blue-500">
              {post.title}
            </h2>
            <button
                onClick={(e) => handleTtsClick(e, post.title)}
                className="relative z-10 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 flex-shrink-0"
                aria-label="朗读标题"
            >
                <Volume2 size={18} />
            </button>
        </div>
        
        {videoUrl && (
          // 【已修复】移除了 mb-4，让 space-y-3 控制间距
          <div className="relative pt-[56.25%] overflow-hidden rounded-lg shadow-md"> 
            <VideoEmbed 
              url={videoUrl} 
              playing={false} 
              controls={true}
              width='100%'
              height='100%'
              className="absolute top-0 left-0" 
            />
          </div>
        )}

        {/* 【已修复】字体加大加粗 */}
        <div className="text-base font-semibold text-gray-700 dark:text-gray-300">
          <PostContent content={cleanedContent} />
        </div>
      </div>

      <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
        <button onClick={handleLike} className={`relative z-10 flex items-center space-x-2 transition-colors ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}>
            <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
            <span>{post.likesCount || 0}</span>
        </button>
        <button onClick={handleActionClick} className="relative z-10 flex items-center space-x-1 hover:text-gray-500">
            <i className="far fa-thumbs-down text-lg" />
        </button>
        <Link href={`/community/${post.id}#comments`} passHref>
            <a onClick={handleActionClick} className="relative z-10 flex items-center space-x-2 hover:text-green-500">
                <i className="far fa-comment-dots text-lg" />
                <span>{post.commentCount || 0}</span>
            </a>
        </Link>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

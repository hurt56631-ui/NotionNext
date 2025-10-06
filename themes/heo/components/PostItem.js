// themes/heo/components/PostItem.js (V10 - 完整最终版)

import React, { forwardRef, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';
import { doc, updateDoc, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Volume2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

// 使用 dynamic import 动态加载，并禁用 SSR，防止 hydration 错误
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// === 🎧 TTS 模块 (优化版：防止音频重叠播放) ===
let currentAudio = null;
const ttsCache = new Map();

const preloadTTS = async (text) => {
  if (ttsCache.has(text)) return;
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('API Error');
    const blob = await response.blob();
    const audio = new Audio(URL.createObjectURL(blob));
    ttsCache.set(text, audio);
  } catch (error) {
    console.error(`预加载 "${text}" 失败:`, error);
  }
};

const playCachedTTS = (text) => {
  // ✅ 优化：播放前先暂停当前正在播放的音频
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  
  if (ttsCache.has(text)) {
    currentAudio = ttsCache.get(text);
    currentAudio.play();
  } else {
    preloadTTS(text).then(() => {
      if (ttsCache.has(text)) {
        currentAudio = ttsCache.get(text);
        currentAudio.play();
      }
    });
  }
};

// === 🕓 时间格式化 ===
const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch {
    return '日期错误';
  }
};

// === 🎥 视频识别 ===
const parseVideoUrl = (postData) => {
  if (!postData) return null;
  const { videoUrl, content } = postData;
  if (videoUrl && typeof videoUrl === 'string' && videoUrl.trim() !== '') {
    try { new URL(videoUrl); return videoUrl; } catch { /* ignore */ }
  }
  if (!content || typeof content !== 'string') return null;
  const urlRegex = /(https?:\/\/[^\s<>"'()]+)/g;
  const urls = content.match(urlRegex);
  if (!urls) return null;
  const patterns = [ /youtube\.com|youtu\.be/, /tiktok\.com/, /douyin\.com/, /bilibili\.com/, /\.(mp4|webm|mov)$/i ];
  for (const url of urls) {
    if (patterns.some(p => p.test(url))) return url;
  }
  return null;
};

const removeUrlFromText = (text, urlToRemove) => {
  if (!text || !urlToRemove) return text;
  const escaped = urlToRemove.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'g'), '').trim();
};

// === 💬 私信按钮 ===
const StartChatButton = ({ targetUser }) => {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  if (!targetUser?.uid || !currentUser || currentUser.uid === targetUser.uid) return null;

  const handleClick = (e) => {
    e.stopPropagation();
    const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
    router.push(`/messages/${chatId}`);
  };

  return (
    <button onClick={handleClick} className="relative z-10 inline-flex items-center px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition">
      <i className="far fa-comment-dots mr-2" /> 私信
    </button>
  );
};

// === 🧩 主组件 ===
function PostItemInner({ post }, ref) {
  const { user } = useAuth();
  const router = useRouter();

  if (!post) return null;

  // --- 优化后的 useMemo 逻辑 ---
  const videoUrl = useMemo(() => parseVideoUrl(post), [post]);
  
  const cleanedContent = useMemo(() => {
    if (!post?.content) return '';
    const full = videoUrl ? removeUrlFromText(post.content, videoUrl) : post.content;
    return full.trim();
  }, [post, videoUrl]);

  // ✅ 优化：根据你的要求，精准截断标题和正文
  const title = post.title?.length > 20 ? post.title.slice(0, 20) + '…' : post.title;
  const preview = cleanedContent
    ? cleanedContent.length > 60
      ? cleanedContent.slice(0, 60) + '…'
      : cleanedContent
    : '';

  const hasLiked = useMemo(() => user && post.likers?.includes(user.uid), [user, post.likers]);

  // --- 优化后的事件处理函数 ---
  const handleLike = useCallback(async () => {
    if (!user || !db) return;
    const postRef = doc(db, 'posts', post.id);
    try {
      if (hasLiked) {
        await updateDoc(postRef, { likesCount: increment(-1), likers: arrayRemove(user.uid) });
      } else {
        await updateDoc(postRef, { likesCount: increment(1), likers: arrayUnion(user.uid) });
      }
    } catch (err) { console.error('点赞失败:', err); }
  }, [user, post.id, hasLiked]);

  const handleCardClick = useCallback(() => router.push(`/community/${post.id}`), [router, post.id]);
  
  const stopPropagation = useCallback((e) => e.stopPropagation(), []);

  return (
    <div ref={ref} onClick={handleCardClick} className="p-4 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors duration-200 cursor-pointer group">
      {/* 👤 作者区 */}
      <div className="flex items-start mb-3">
        <Link href={`/profile/${post.authorId}`} passHref>
          <a onClick={stopPropagation} className="relative z-10 flex items-center">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt="头像" className="w-12 h-12 rounded-full object-cover" loading="lazy" />
            <div className="ml-3">
              <p className="font-semibold text-gray-800 dark:text-gray-200 group-hover:text-blue-500">{post.authorName || '匿名用户'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatTimeAgo(post.createdAt)}</p>
            </div>
          </a>
        </Link>
        <div className="ml-auto">
          <StartChatButton targetUser={{ uid: post.authorId }} />
        </div>
      </div>

      {/* 📄 内容区 */}
      <div className="space-y-3 ml-15"> {/* 增加左边距，与头像对齐 */}
        {/* 标题 + 朗读 */}
        {title && (
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg font-bold dark:text-gray-100 break-all line-clamp-1">{title}</h2>
            <button onClick={(e) => { stopPropagation(e); playCachedTTS(post.title); }} className="relative z-10 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 flex-shrink-0 transition-colors" aria-label="朗读标题">
              <Volume2 size={18} />
            </button>
          </div>
        )}

        {/* 视频 */}
        {videoUrl && (
          // ✅ 优化：移除了有问题的 relative 容器
          <div className="my-3 -ml-15" onClick={stopPropagation}> {/* 抵消外层边距，让视频撑满 */}
            <VideoEmbed url={videoUrl} />
          </div>
        )}

        {/* 正文 */}
        {preview && (
          <div className="text-base text-gray-700 dark:text-gray-300 font-medium leading-relaxed line-clamp-2">
            <PostContent content={preview} />
          </div>
        )}
      </div>

      {/* ❤️ 底部操作区 */}
      <div className="flex justify-around items-center mt-4 text-gray-600 dark:text-gray-400 -mb-2">
        <button onClick={(e) => { stopPropagation(e); handleLike(); }} className={`flex items-center space-x-2 transition-colors duration-200 py-2 px-4 rounded-full ${hasLiked ? 'text-red-500' : 'hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}`}>
          <i className={`${hasLiked ? 'fas' : 'far'} fa-heart text-lg`} />
          <span>{post.likesCount || 0}</span>
        </button>
        <Link href={`/community/${post.id}#comments`} passHref>
          <a onClick={stopPropagation} className="flex items-center space-x-2 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 py-2 px-4 rounded-full transition-colors duration-200">
            <i className="far fa-comment-dots text-lg" />
            <span>{post.commentCount || 0}</span>
          </a>
        </Link>
        <button onClick={stopPropagation} className="flex items-center space-x-2 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 py-2 px-4 rounded-full transition-colors duration-200">
            <i className="far fa-share-square text-lg" />
            <span>分享</span>
        </button>
      </div>
    </div>
  );
}

export default forwardRef(PostItemInner);

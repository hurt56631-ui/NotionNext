// pages/community/new.js (最终修复版 - 确保 videoUrl 被正确解析和保存)

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import dynamic from 'next/dynamic';

const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

// ✅ 关键工具 1: 将视频解析函数放在这个文件里，确保它在发帖时可用
const parseVideoUrl = (text) => {
  if (!text) return null;
  // 正则表达式匹配文本中任何看起来像 URL 的字符串
  const urls = text.match(/https?:\/\/[^\s<>"']+/g) || [];
  // 包含常见视频平台域名和视频文件扩展名的模式列表
  const patterns = [/youtu/, /vimeo/, /tiktok/, /facebook/, /twitch/, /dailymotion/, /bilibili/, /\.(mp4|webm|ogg|mov)$/i];
  // 返回在文本中找到的第一个匹配视频模式的 URL，如果没有则返回 null
  return urls.find(u => patterns.some(p => p.test(u))) || null;
};

const categories = ['技术分享', '学习笔记', '资源分享', '日常交流'];

const NewPostPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      setShowLoginModal(true);
    }
  }, [user, authLoading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!user) {
      setError('请先登录才能发布帖子！');
      setShowLoginModal(true);
      return;
    }
    if (!title.trim() || !content.trim() || !category) {
        setError('标题、内容和分类都不能为空。');
        return;
    }

    setIsSubmitting(true);

    try {
      // ✅ 关键动作 2: 在提交数据前，调用上面的工具函数
      // 从用户输入的 `content` 文本中自动提取视频 URL
      const videoUrl = parseVideoUrl(content);

      // ✅ 关键结果 3: 构建一个包含了所有必需字段的最终数据对象
      const newPostData = {
        // --- 基础内容 ---
        title: title.trim(),
        content: content.trim(),
        category: category,
        
        // --- 反规范化 (解决高读取量问题) ---
        // 直接将作者信息复制到帖子文档中
        authorId: user.uid,
        authorName: user.displayName || '匿名用户',
        authorAvatar: user.photoURL || '/img/avatar.svg',

        // --- 视频链接 (解决 TikTok 问题) ---
        // 将上面解析出的 videoUrl (可能是 TikTok 链接，也可能是 null) 保存到文档中
        videoUrl: videoUrl,

        // --- 初始化元数据 ---
        createdAt: serverTimestamp(),
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        likers: [],
        dislikers: []
      };

      // 将这个包含了 videoUrl 的完整数据对象添加到 Firestore 的 'posts' 集合
      await addDoc(collection(db, 'posts'), newPostData);

      // 发帖成功，跳转到社区主页
      router.push('/community');

    } catch (err) {
      console.error("发布帖子失败:", err);
      setError(`发布帖子失败：${err.message || '未知错误'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <LayoutBase>
        <div className="flex justify-center items-center min-h-screen text-gray-500">
          正在加载用户信息...
        </div>
      </LayoutBase>
    );
  }

  if (!user && !showLoginModal) {
    return (
      <LayoutBase>
        <div className="flex justify-center items-center min-h-screen text-gray-500">
          <p>您尚未登录，请先登录。</p>
        </div>
      </LayoutBase>
    );
  }

  return (
    <LayoutBase>
      <div className="bg-gray-50 dark:bg-black min-h-screen pt-10 pb-20">
        <div className="container mx-auto px-3 md:px-6 max-w-2xl">
          <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 text-center mb-8">发布新帖子</h1>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 md:p-8 space-y-6">
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                标题
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="请输入帖子标题"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isSubmitting}
                required
              />
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                分类
              </label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                disabled={isSubmitting}
                required
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容
              </label>
              <textarea
                id="content"
                rows="10"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在这里写下你的帖子内容... 如果有视频链接，请直接粘贴在这里。"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y"
                disabled={isSubmitting}
                required
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={`w-full py-2 px-4 rounded-lg shadow-md font-semibold text-white transition-colors duration-200 ${
                isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } flex items-center justify-center`}
            >
              {isSubmitting ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i> 正在发布...
                </>
              ) : (
                '发布帖子'
              )}
            </button>
          </form>
        </div>
      </div>
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </LayoutBase>
  );
};

export default NewPostPage;

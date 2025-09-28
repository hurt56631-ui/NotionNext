// pages/community/new.js

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // 导入 Firestore 实例
import { useAuth } from '@/lib/AuthContext'; // 导入用户认证上下文
import { LayoutBase } from '@/themes/heo'; // 你的基础布局组件
import dynamic from 'next/dynamic';

// 动态导入 AuthModal，确保只在客户端渲染
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });

// 社区帖子分类选项
const categories = ['技术分享', '学习笔记', '资源分享', '日常交流'];

const NewPostPage = () => {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth(); // 获取用户和认证加载状态

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState(categories[0]); // 默认选择第一个分类
  const [isSubmitting, setIsSubmitting] = useState(false); // 控制提交按钮加载状态
  const [error, setError] = useState(''); // 存储表单提交错误信息
  const [showLoginModal, setShowLoginModal] = useState(false); // 控制登录弹窗

  // 确保只有登录用户才能访问此页面
  useEffect(() => {
    // 如果认证状态加载完毕且用户未登录，则显示登录弹窗
    if (!authLoading && !user) {
      setShowLoginModal(true);
      // 或者直接重定向到登录页/主页
      // router.replace('/');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); // 清除之前的错误信息

    // 客户端表单验证
    if (!user) {
      setError('请先登录才能发布帖子！');
      setShowLoginModal(true);
      return;
    }
    if (!title.trim()) {
      setError('帖子标题不能为空。');
      return;
    }
    if (!content.trim()) {
      setError('帖子内容不能为空。');
      return;
    }
    if (!category) {
      setError('请选择一个帖子分类。');
      return;
    }
    
    // 如果 db 实例在某些情况下未初始化（尽管 lib/firebase.js 已经处理了），也应避免操作
    if (!db) {
      setError('Firestore 数据库服务不可用，请稍后再试。');
      return;
    }

    setIsSubmitting(true); // 开始提交，显示加载状态

    try {
      // 准备帖子数据
      const newPostData = {
        title: title.trim(),
        content: content.trim(),
        category: category,
        authorId: user.uid,
        authorName: user.displayName || user.email || '匿名用户', // 提供一个默认作者名
        authorAvatar: user.photoURL || '/images/avatar-placeholder.png', // 提供一个默认头像
        createdAt: serverTimestamp(), // 使用 Firebase 服务器时间戳
        likesCount: 0,
        commentsCount: 0,
      };

      // 将帖子数据添加到 Firestore 的 'posts' 集合中
      await addDoc(collection(db, 'posts'), newPostData);

      // 发帖成功，跳转到社区主页
      router.push('/community');

    } catch (err) {
      console.error("发布帖子失败:", err);
      setError(`发布帖子失败：${err.message || '未知错误'}`);
    } finally {
      setIsSubmitting(false); // 结束提交，隐藏加载状态
    }
  };

  // 如果正在加载认证信息或用户未登录，且未显示登录弹窗，显示加载状态或不渲染表单
  if (authLoading) {
    return (
      <LayoutBase>
        <div className="flex justify-center items-center min-h-screen text-gray-500">
          <i className="fas fa-spinner fa-spin mr-2 text-2xl"></i> 正在加载用户信息...
        </div>
      </LayoutBase>
    );
  }

  // 如果用户未登录，AuthModal 会自动显示
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
            {/* 错误信息显示 */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            {/* 标题 */}
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

            {/* 分类选择 */}
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

            {/* 内容 */}
            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                内容
              </label>
              <textarea
                id="content"
                rows="10"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="在这里写下你的帖子内容..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100 resize-y"
                disabled={isSubmitting}
                required
              ></textarea>
            </div>

            {/* 提交按钮 */}
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

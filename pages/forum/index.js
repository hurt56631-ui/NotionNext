// pages/forum/index.js (最终功能版)

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import Link from 'next/link';
import ForumCategoryTabs from '../../themes/heo/components/ForumCategoryTabs';
import PostItem from '../../themes/heo/components/PostItem';
import LoginModal from '@/components/LoginModal'; // 1. 导入登录弹窗

const ForumHomePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false); // 2. 控制登录弹窗的状态

  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  useEffect(() => {
    // ... (获取帖子的 useEffect 逻辑保持不变)
  }, [currentCategory, currentSort]);

  const handleCategoryChange = (category) => setCurrentCategory(category);
  const handleSortChange = (sort) => setCurrentSort(sort);
  
  // 3. 点击发帖按钮的统一处理函数
  const handlePostButtonClick = (e) => {
    if (!user) {
      e.preventDefault(); // 阻止 Link 的默认跳转行为
      setIsLoginModalOpen(true); // 打开登录弹窗
    }
    // 如果用户已登录，则不执行任何操作，Link 会正常跳转
  };

  return (
    <>
      <div className="bg-stone-50 dark:bg-black min-h-screen">
        <div 
          className="relative h-48 bg-cover bg-center" 
          style={{ backgroundImage: "url('/images/forum-header-bg.jpg')" }}
        >
          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
            <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
          </div>
        </div>

        <div className="container mx-auto px-2 md:px-4 -mt-20 relative">
          <ForumCategoryTabs onCategoryChange={handleCategoryChange} onSortChange={handleSortChange} />
          
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow">
            {loading && <p className="p-4 text-center text-gray-500">加载中...</p>}
            {!loading && posts.length === 0 && <p className="p-4 text-center text-gray-500">该分类下还没有帖子哦，快来发布第一篇吧！</p>}
            {!loading && posts.map(post => <PostItem key={post.id} post={post} />)}
          </div>
        </div>

        {/* 4. 发帖按钮始终显示 */}
        <Link href="/forum/new-post">
          <a 
            onClick={handlePostButtonClick}
            className="fixed bottom-20 right-5 z-40 h-12 w-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110"
          >
            <i className="fas fa-pen text-lg"></i>
          </a>
        </Link>
      </div>
      
      {/* 5. 渲染登录弹窗 */}
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </>
  );
};

export default ForumHomePage;

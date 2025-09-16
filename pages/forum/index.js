// pages/forum/index.js (已修复“一直加载中”问题)

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import Link from 'next/link';
import ForumCategoryTabs from '../../themes/heo/components/ForumCategoryTabs';
import PostItem from '../../themes/heo/components/PostItem';
import LoginModal from '@/components/LoginModal';

const ForumHomePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  useEffect(() => {
    setLoading(true); // 开始获取数据前，设置加载状态

    let q; // 声明一个查询变量
    const postsRef = collection(db, 'posts');

    // --- 构建动态查询 ---
    // 1. 分类筛选 (我们先假设'推荐'是获取所有帖子)
    if (currentCategory === '推荐') {
      // 2. 排序逻辑
      if (currentSort === '最热') {
        q = query(postsRef, orderBy('likesCount', 'desc')); // 假设有点赞数字段 likesCount
      } else { // 默认和最新都按创建时间
        q = query(postsRef, orderBy('createdAt', 'desc'));
      }
    } else {
      // 3. 其他分类的筛选
      if (currentSort === '最热') {
        q = query(postsRef, where('category', '==', currentCategory), orderBy('likesCount', 'desc'));
      } else {
        q = query(postsRef, where('category', '==', currentCategory), orderBy('createdAt', 'desc'));
      }
    }

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(postsData);
      setLoading(false); // 成功获取数据后，关闭加载状态
    }, (error) => {
      console.error("获取帖子失败:", error);
      setLoading(false); // 获取数据失败后，也要关闭加载状态
    });

    // 组件卸载时，取消对数据库的监听
    return () => unsubscribe();
  }, [currentCategory, currentSort]); // 当分类或排序改变时，重新执行这个 effect

  const handleCategoryChange = (category) => setCurrentCategory(category);
  const handleSortChange = (sort) => setCurrentSort(sort);
  
  const handlePostButtonClick = (e) => {
    if (!user) {
      e.preventDefault();
      setIsLoginModalOpen(true);
    }
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
            {loading ? (
              <p className="p-8 text-center text-gray-500">正在加载帖子...</p>
            ) : posts.length > 0 ? (
              posts.map(post => <PostItem key={post.id} post={post} />)
            ) : (
              <p className="p-8 text-center text-gray-500">该分类下还没有帖子哦，快来发布第一篇吧！</p>
            )}
          </div>
        </div>

        <Link href="/forum/new-post">
          <a 
            onClick={handlePostButtonClick}
            className="fixed bottom-20 right-5 z-40 h-12 w-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110"
          >
            <i className="fas fa-pen text-lg"></i>
          </a>
        </Link>
      </div>
      
      <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} />
    </>
  );
};

export default ForumHomePage;

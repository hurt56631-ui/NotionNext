// pages/forum/index.js (重构版 - 使用内置 Font Awesome)

import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import Link from 'next/link';
import ForumCategoryTabs from '../../themes/heo/components/ForumCategoryTabs';
import PostItem from '../../themes/heo/components/PostItem';

const ForumHomePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  // 后面我们会在这里添加分类和排序的 state
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  useEffect(() => {
    setLoading(true);
    // 后面我们会根据分类和排序来修改这个查询
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(postsData);
      setLoading(false);
    }, (error) => {
      console.error("获取帖子失败:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentCategory, currentSort]); // 依赖项，当分类或排序改变时，会重新查询

  const handleCategoryChange = (category) => {
    console.log('切换到分类:', category);
    setCurrentCategory(category);
  };

  const handleSortChange = (sort) => {
    console.log('切换排序:', sort);
    setCurrentSort(sort);
  };

  return (
    <div className="bg-gray-100 dark:bg-black min-h-screen">
      
      {/* 顶栏背景图 */}
      <div 
        className="relative h-48 bg-cover bg-center" 
        style={{ backgroundImage: "url('/images/forum-header-bg.jpg')" }} // 确保图片存在于 public/images/ 目录下
      >
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <h1 className="text-4xl font-bold text-white shadow-text">社区论坛</h1>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="container mx-auto p-4 max-w-4xl -mt-20 relative">
        
        {/* 分类和排序导航 */}
        <ForumCategoryTabs onCategoryChange={handleCategoryChange} onSortChange={handleSortChange} />
        
        {/* 帖子列表 */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow">
          {loading && <p className="p-4 text-center text-gray-500">加载中...</p>}
          {!loading && posts.length === 0 && <p className="p-4 text-center text-gray-500">该分类下还没有帖子哦，快来发布第一篇吧！</p>}
          {!loading && posts.map(post => (
            <PostItem key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* 悬浮发帖按钮 */}
      {user && (
        <Link href="/forum/new-post">
          <a className="fixed bottom-20 right-5 z-40 h-14 w-14 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110">
            <i className="fas fa-pen text-xl"></i>
          </a>
        </Link>
      )}
    </div>
  );
};

export default ForumHomePage;

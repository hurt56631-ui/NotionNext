// pages/forum/index.js (CSS 升级版)

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
  const [currentCategory, setCurrentCategory] = useState('推荐');
  const [currentSort, setCurrentSort] = useState('最新');

  useEffect(() => {
    setLoading(true);
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
  }, [currentCategory, currentSort]);

  const handleCategoryChange = (category) => {
    setCurrentCategory(category);
  };

  const handleSortChange = (sort) => {
    setCurrentSort(sort);
  };

  return (
    // 【关键改动】使用更柔和的背景色
    <div className="bg-stone-50 dark:bg-black min-h-screen">
      
      {/* 顶栏背景图 */}
      <div 
        className="relative h-48 bg-cover bg-center" 
        style={{ backgroundImage: "url('/images/forum-header-bg.jpg')" }}
      >
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          {/* 【关键改动】标题修改并添加浮动效果 */}
          <h1 className="text-4xl font-bold text-white text-shadow-lg">中文社区</h1>
        </div>
      </div>

      {/* 主内容区 */}
      {/* 【关键改动】调整了边距和宽度，让卡片更大 */}
      <div className="container mx-auto px-2 md:px-4 -mt-20 relative">
        
        {/* 分类和排序导航 */}
        <ForumCategoryTabs onCategoryChange={handleCategoryChange} onSortChange={handleSortChange} />
        
        {/* 帖子列表 */}
        {/* 【关键改动】为卡片列表增加柔和阴影 */}
        <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
          {loading && <p className="p-10 text-center text-gray-500">正在加载社区内容...</p>}
          {!loading && posts.length === 0 && <p className="p-10 text-center text-gray-500">这里空空如也，快来发布第一篇帖子吧！</p>}
          {!loading && posts.map(post => (
            <PostItem key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* 悬浮发帖按钮 */}
      {/* 【关键改动】图标缩小 */}
      {user && (
        <Link href="/forum/new-post">
          <a className="fixed bottom-20 right-5 z-40 h-12 w-12 bg-blue-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 transition-all transform hover:scale-110 active:scale-95">
            <i className="fas fa-pen"></i>
          </a>
        </Link>
      )}
    </div>
  );
};

export default ForumHomePage;

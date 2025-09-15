// pages/forum/index.js
import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import Link from 'next/link';
import { useAuth } from '../../lib/AuthContext';

const ForumHomePage = () => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const postsRef = collection(db, 'posts');
    const q = query(postsRef, orderBy('createdAt', 'desc')); // 按创建时间降序排列

    // onSnapshot 会实时监听数据库变化
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const postsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPosts(postsData);
    });

    return () => unsubscribe(); // 组件卸载时取消监听
  }, []);

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">社区论坛</h1>
        {user && (
          <Link href="/forum/new-post">
            <a className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600">
              发布新帖
            </a>
          </Link>
        )}
      </div>

      <div className="space-y-4">
        {posts.map(post => (
          <Link key={post.id} href={`/forum/post/${post.id}`}>
            <a className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow">
              <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
              <p className="text-gray-600 dark:text-gray-400">
                由 {post.authorName} 发布于 {new Date(post.createdAt?.toDate()).toLocaleString()}
              </p>
            </a>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default ForumHomePage;

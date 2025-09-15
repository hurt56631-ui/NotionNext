// pages/forum/new-post.js
import { useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/AuthContext';
import { useRouter } from 'next/router';

const NewPostPage = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim() || !user) {
      alert('标题和内容不能为空！');
      return;
    }

    try {
      await addDoc(collection(db, 'posts'), {
        title: title,
        content: content,
        authorId: user.uid,
        authorName: user.displayName,
        authorAvatar: user.photoURL,
        createdAt: serverTimestamp(),
      });
      router.push('/forum'); // 发布成功后跳回论坛首页
    } catch (error) {
      console.error("创建帖子失败: ", error);
      alert('发布失败，请稍后再试。');
    }
  };

  if (!user) {
    return <p>请先登录才能发布新帖。</p>;
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">创建新帖子</h1>
      <form onSubmit={handleCreatePost} className="space-y-4">
        <div>
          <label htmlFor="title" className="block text-lg font-medium">标题</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700"
          />
        </div>
        <div>
          <label htmlFor="content" className="block text-lg font-medium">内容</label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows="10"
            className="w-full mt-1 p-2 border rounded-md dark:bg-gray-700"
          />
        </div>
        <button type="submit" className="bg-blue-500 text-white px-6 py-2 rounded-md hover:bg-blue-600">
          发布
        </button>
      </form>
    </div>
  );
};

export default NewPostPage;

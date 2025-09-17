// themes/heo/components/PostItem.js (已添加私信按钮)

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import { doc, updateDoc, arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import StartChatButton from './StartChatButton'; // 1. 引入发起聊天按钮组件

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const [showShareModal, setShowShareModal] = useState(false);
  const postUrl = `${siteConfig('LINK')}/forum/post/${post.id}`;

  const hasLiked = user && post.likers?.includes(user.uid);

  const handleLike = async () => {
    if (!user) {
      alert('请先登录才能点赞哦！');
      return;
    }

    const postRef = doc(db, 'posts', post.id);

    try {
      if (hasLiked) {
        await updateDoc(postRef, {
          likers: arrayRemove(user.uid),
          likersCount: increment(-1)
        });
      } else {
        await updateDoc(postRef, {
          likers: arrayUnion(user.uid),
          likersCount: increment(1)
        });
      }
    } catch (error) {
      console.error("点赞操作失败:", error);
    }
  };

  const handleBookmark = () => {
    if (!user) alert('请先登录才能收藏！');
    console.log("收藏功能待实现");
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        <div className="flex items-center mb-3">
          {post.authorAvatar && (
            <img 
              src={post.authorAvatar} 
              alt={post.authorName} 
              className="w-12 h-12 rounded-lg border-2 border-gray-100 dark:border-gray-600"
            />
          )}
          <div className="ml-3 flex-grow">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName || '匿名用户'}</p>
                {post.authorIsAdmin && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                    管理员
                  </span>
                )}
              </div>
              {/* 2. 在这里添加私信按钮，并传入作者ID */}
              {/* 假设 post 对象中有 authorId 字段 */}
              {post.authorId && <StartChatButton targetUserId={post.authorId} />}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : '不久前'}
              {post.city && ` · ${post.city}`}
            </p>
          </div>
        </div>

        <Link href={`/forum/post/${post.id}`}>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
            <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
          </a>
        </Link>
        
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
          <button 
            onClick={handleLike} 
            className={`flex items-center space-x-2 transition-colors ${hasLiked ? 'text-blue-500 animate-pulse' : 'hover:text-blue-500'}`}
          >
            <span className="text-xl">👍</span>
            <span className="text-sm font-semibold">{post.likersCount || 0}</span> {/* 3. 使用 likersCount 提高性能 */}
          </button>
          <button className="flex items-center space-x-1 hover:text-gray-400 transition-colors">
            <span className="text-xl">👎</span>
          </button>
          <Link href={`/forum/post/${post.id}#comments`}>
            <a className="flex items-center space-x-2 hover:text-green-500 transition-colors">
                <i className="far fa-comment-dots text-lg"></i>
                <span className="text-sm font-semibold">{post.commentCount || 0}</span>
            </a>
          </Link>
          <button onClick={() => setShowShareModal(true)} className="hover:text-yellow-500 transition-colors">
            <i className="fas fa-share-alt text-lg"></i>
          </button>
          <button onClick={handleBookmark} className="hover:text-purple-500 transition-colors">
            <i className="far fa-bookmark text-lg"></i>
          </button>
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowShareModal(false)}>
          <div className="bg-white p-6 rounded-lg flex space-x-6" onClick={(e) => e.stopPropagation()}>
            <FacebookShareButton url={postUrl} quote={post.title}>
              <i className="fab fa-facebook text-4xl text-blue-600 hover:opacity-80"></i>
            </FacebookShareButton>
            <TelegramShareButton url={postUrl} title={post.title}>
              <i className="fab fa-telegram text-4xl text-blue-400 hover:opacity-80"></i>
            </TelegramShareButton>
          </div>
        </div>
      )}
    </>
  );
};

export default PostItem;

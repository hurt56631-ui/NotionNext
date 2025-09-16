// themes/heo/components/PostItem.js (最终样式版)

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { siteConfig } from '@/lib/config';
import { FacebookShareButton, TelegramShareButton } from 'react-share';
import SocialLogins from '@/components/SocialLogins';

const PostItem = ({ post }) => {
  const { user } = useAuth();
  const [showShareModal, setShowShareModal] = useState(false);
  const postUrl = `${siteConfig('LINK')}/forum/post/${post.id}`;

  const handleLike = () => {
    // TODO: 实现点赞逻辑
    console.log("点赞");
  };

  const handleBookmark = () => {
    // TODO: 实现收藏逻辑
    console.log("收藏");
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl transition-shadow duration-300">
        {/* 顶部：头像、用户名、时间、地点 */}
        <div className="flex items-center mb-3">
          {post.authorAvatar && (
            <img 
              src={post.authorAvatar} 
              alt={post.authorName} 
              className="w-12 h-12 rounded-lg border-2 border-gray-100 dark:border-gray-600" // 微信式头像
            />
          )}
          <div className="ml-3">
            <div className="flex items-center">
              <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName || '匿名用户'}</p>
              {/* TODO: 管理员标志 */}
              {/* {post.isAdmin && <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">管理员</span>} */}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : '不久前'}
              {post.city && ` · ${post.city}`}
            </p>
          </div>
        </div>

        {/* 内容：标题和正文 */}
        <Link href={`/forum/post/${post.id}`}>
          <a className="space-y-2 block my-3">
            <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
            <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2">{post.content}</p>
          </a>
        </Link>
        
        {/* 底部交互按钮 (居中) */}
        <div className="flex justify-center items-center space-x-8 mt-4 text-gray-600 dark:text-gray-400">
          <button onClick={handleLike} className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
            <span className="text-xl">👍</span>
            <span className="text-sm font-semibold">{post.likes || 0}</span>
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

      {/* 分享弹窗 */}
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

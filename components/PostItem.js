// components/PostItem.js
import Link from 'next/link';
import { ThumbsUp, ThumbsDown, MessageSquare, Share2, Bookmark } from 'lucide-react';

const PostItem = ({ post }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border-b border-gray-200 dark:border-gray-700">
      {/* 顶部：头像、用户名、时间、地点 */}
      <div className="flex items-center mb-3">
        <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full" />
        <div className="ml-3">
          <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {new Date(post.createdAt?.toDate()).toLocaleString()}
            {post.city && ` · ${post.city}`}
          </p>
        </div>
      </div>

      {/* 内容：标题和正文 */}
      <Link href={`/forum/post/${post.id}`}>
        <a className="space-y-2">
          <h2 className="text-lg font-bold hover:text-blue-500">{post.title}</h2>
          <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-2">{post.content}</p>
        </a>
      </Link>
      
      {/* 底部交互按钮 */}
      <div className="flex justify-between items-center mt-4 text-gray-500 dark:text-gray-400">
        <div className="flex space-x-5">
          <button className="flex items-center space-x-1 hover:text-blue-500">
            <ThumbsUp size={16} />
            <span className="text-xs">{post.likes || 0}</span>
          </button>
          <button className="flex items-center space-x-1 hover:text-red-500">
            <ThumbsDown size={16} />
          </button>
          <button className="flex items-center space-x-1 hover:text-green-500">
            <MessageSquare size={16} />
            <span className="text-xs">{post.commentCount || 0}</span>
          </button>
        </div>
        <div className="flex space-x-5">
          <button className="hover:text-yellow-500"><Share2 size={16} /></button>
          <button className="hover:text-purple-500"><Bookmark size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default PostItem;

// components/PostItem.js

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export default function PostItem({ post }) {
  // 安全地处理时间戳
  const formattedDate = post?.createdAt?.toDate
    ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true, locale: zhCN })
    : '未知时间';

  return (
    <Link href={`/community/${post.id}`} passHref>
      <a className="block p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
        <div className="flex items-start space-x-4">
          {/* 用户头像 */}
          <img src={post.authorAvatar || '/images/avatar-placeholder.png'} alt={post.authorName} className="w-10 h-10 rounded-full" />
          
          <div className="flex-1">
            {/* 帖子标题 */}
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">{post.title}</h3>
            
            {/* 作者信息和时间 */}
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-3">
              <span className="font-medium text-gray-700 dark:text-gray-300">{post.authorName}</span>
              <span>·</span>
              <span>{formattedDate}</span>
              {post.category && (
                <>
                  <span>·</span>
                  <span className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 px-2 py-0.5 rounded-full text-xs font-medium">
                    {post.category}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 互动数据 */}
          <div className="flex items-center space-x-4 text-gray-500 dark:text-gray-400 text-sm">
            <div className="flex items-center">
              <i className="fas fa-comment-alt mr-1.5"></i>
              <span>{post.commentsCount || 0}</span>
            </div>
            <div className="flex items-center">
              <i className="fas fa-heart mr-1.5"></i>
              <span>{post.likesCount || 0}</span>
            </div>
          </div>
        </div>
      </a>
    </Link>
  );
}

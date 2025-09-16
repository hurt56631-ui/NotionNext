// themes/heo/components/PostItem.js (方案一：增加行高)

import Link from 'next/link';

const PostItem = ({ post }) => {
  // 模拟管理员标识，后面需要从 user 对象获取
  const isAdmin = post.authorRole === 'admin';

  return (
    <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
      {/* 顶部：头像、用户名、时间、地点 */}
      <div className="flex items-center mb-3">
        {post.authorAvatar && <img src={post.authorAvatar} alt={post.authorName} className="w-10 h-10 rounded-full border-2 border-gray-200 dark:border-gray-600" />}
        <div className="ml-3 flex-grow">
          <div className="flex items-center">
            <p className="font-semibold text-gray-800 dark:text-gray-200">{post.authorName || '匿名用户'}</p>
            {isAdmin && (
              <span className="ml-2 text-xs text-blue-500 bg-blue-100 dark:bg-blue-900/50 dark:text-blue-400 px-2 py-0.5 rounded-full flex items-center">
                <i className="fas fa-check-circle mr-1"></i>
                管理员
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {post.createdAt ? new Date(post.createdAt.toDate()).toLocaleString() : '不久前'}
            {post.city && ` · ${post.city}`}
          </p>
        </div>
      </div>

      {/* 内容：标题和正文 */}
      <Link href={`/forum/post/${post.id}`}>
        <a className="space-y-2 block my-2">
          <h2 className="text-lg font-bold hover:text-blue-500 dark:text-gray-100">{post.title}</h2>
          {/* 【关键改动】增加了 leading-relaxed 来增大行高 */}
          <p className="text-gray-800 dark:text-gray-200 text-base line-clamp-2 leading-relaxed">{post.content}</p>
        </a>
      </Link>
      
      {/* 底部交互按钮 */}
      <div className="flex justify-center items-center space-x-6 mt-4 text-gray-600 dark:text-gray-400">
        <button className="flex items-center space-x-2 hover:text-blue-500 transition-colors">
          <i className="far fa-thumbs-up text-lg"></i>
          <span className="text-sm font-semibold">{post.likes || 0}</span>
        </button>
        <button className="flex items-center space-x-1 hover:text-red-500 transition-colors">
          <i className="far fa-thumbs-down text-lg"></i>
        </button>
        <button className="flex items-center space-x-2 hover:text-green-500 transition-colors">
          <i className="far fa-comment-dots text-lg"></i>
          <span className="text-sm font-semibold">{post.commentCount || 0}</span>
        </button>
        <button className="hover:text-yellow-500 transition-colors"><i className="fas fa-share-alt text-lg"></i></button>
        <button className="hover:text-purple-500 transition-colors"><i className="far fa-bookmark text-lg"></i></button>
      </div>
    </div>
  );
};

export default PostItem;

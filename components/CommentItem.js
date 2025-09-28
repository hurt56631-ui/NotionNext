// components/CommentItem.js (修正后，确保有完整的 JSX 闭合标签)

import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

/**
 * 评论项组件
 * 负责渲染单个评论的 UI
 * @param {object} props
 * @param {object} props.comment - 包含评论数据的对象
 * @returns {JSX.Element}
 */
export default function CommentItem({ comment }) {
  // 安全地处理时间戳，并格式化为 "X 时间前" 的形式
  const formattedDate = comment?.createdAt?.toDate
    ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: zhCN })
    : '未知时间';

  return (
    <div className="flex items-start space-x-3 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* 评论者头像 */}
      <img
        src={comment.authorAvatar || '/images/avatar-placeholder.png'}
        alt={comment.authorName || '匿名用户'}
        className="w-8 h-8 rounded-full flex-shrink-0 object-cover"
      />
      <div className="flex-1">
        {/* 评论者名称和评论时间 */}
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{comment.authorName || '匿名用户'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</span>
        </div>
        {/* 评论内容 */}
        <p className="text-gray-700 dark:text-gray-300 mt-1 leading-relaxed break-words">
            {comment.content}
        </p>
      </div>
    </div> // <--- 这个就是编译器抱怨缺失的结束标签，请确保它在你的文件中！
  );
}

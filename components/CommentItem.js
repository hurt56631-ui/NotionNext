// components/CommentItem.js (用于展示单个评论的完整代码)

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
  // 如果 comment.createdAt.toDate() 不存在或无效，则显示 "未知时间"
  const formattedDate = comment?.createdAt?.toDate
    ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true, locale: zhCN })
    : '未知时间';

  return (
    <div className="flex items-start space-x-3 py-4 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      {/* 评论者头像 */}
      {/* 使用 comment.authorAvatar 作为图片源，如果不存在则使用默认占位符 */}
      <img
        src={comment.authorAvatar || '/images/avatar-placeholder.png'}
        alt={comment.authorName || '匿名用户'} // alt 属性用于辅助功能，如果作者名不存在则显示 "匿名用户"
        className="w-8 h-8 rounded-full flex-shrink-0 object-cover" // flex-shrink-0 确保头像不会被挤压
      />
      <div className="flex-1"> {/* flex-1 让这部分内容填充剩余空间 */}
        {/* 评论者名称和评论时间 */}
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-gray-800 dark:text-gray-100">{comment.authorName || '匿名用户'}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</span>
        </div>
        {/* 评论内容 */}
        <p className="text-gray-700 dark:text-g

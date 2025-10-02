import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// ✅ 导入所有需要的 Lucide 图标
import { Heart, MessageSquare, Send, ChevronDown, Volume2 } from 'lucide-react';

import { AdSlot } from '@/components/GoogleAdsense';
import NotionPage from '@/components/NotionPage';
import WWAds from '@/components/WWAds';
import { useGlobal } from '@/lib/global';
import { isBrowser } from '@/lib/utils';
import FloatTocButton from '@/themes/heo/components/FloatTocButton'; 
import { PostLock } from '@/themes/heo/components/PostLock';       
import AISummary from '@/components/AISummary';
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice';

// --- 辅助函数：时间格式化 (保持不变) ---
const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch (e) { return '日期错误'; }
};

// ===================================================================
// =============  ✅ 新增：楼中楼评论区相关组件  =============
// ===================================================================

// --- 回复输入框组件 ---
const CommentInput = ({ postId, parentComment, onCommentAdded, placeholder }) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
        }
    }, []);

    const handleSubmit = async () => {
        if (!content.trim() || !user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await addDoc(collection(db, 'posts', postId, 'comments'), {
                content: content.trim(),
                authorId: user.uid,
                authorName: user.displayName,
                authorAvatar: user.photoURL,
                parentCommentId: parentComment.id, // 标记父评论ID
                replyToUser: parentComment.authorName, // 标记回复给谁
                createdAt: serverTimestamp(),
            });
            setContent('');
            if (onCommentAdded) onCommentAdded();
        } catch (error) {
            console.error("发表评论失败:", error);
            alert("发表评论失败，请重试。");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!user) return null;

    return (
        <div className="flex items-start space-x-3 mt-4">
            <img src={user.photoURL || '/img/avatar.svg'} alt="你的头像" className="w-9 h-9 rounded-full" />
            <div className="flex-1">
                <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-gray-100 dark:bg-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows="2"
                />
                <div className="flex justify-end mt-2">
                    <button onClick={handleSubmit} disabled={isSubmitting || !content.trim()} className="px-4 py-1.5 rounded-full text-white bg-blue-500 text-sm font-semibold disabled:bg-gray-400 transition-colors active:scale-95">
                        发布
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- 单个评论/回复渲染组件 (楼中楼) ---
const ReplyItem = ({ reply, onReply }) => {
    return (
        <div className="flex space-x-3">
            <Link href={`/profile/${reply.authorId}`}>
                <a className="flex-shrink-0"><img src={reply.authorAvatar || '/img/avatar.svg'} alt={reply.authorName} className="w-8 h-8 rounded-full" /></a>
            </Link>
            <div className="flex-1 text-sm">
                <div>
                    <Link href={`/profile/${reply.authorId}`}><a className="font-semibold text-gray-800 dark:text-gray-200 hover:underline">{reply.authorName}</a></Link>
                    {reply.replyToUser && <span className="text-gray-500 mx-1">回复</span>}
                    {reply.replyToUser && <span className="font-semibold text-blue-500">{reply.replyToUser}</span>}
                    <span className="text-gray-700 dark:text-gray-300 ml-1.5">{reply.content}</span>
                </div>
                <div className="mt-1 flex items-center space-x-4 text-xs text-gray-400">
                    <span>{formatTimeAgo(reply.createdAt)}</span>
                    <button onClick={onReply} className="font-semibold hover:text-blue-500">回复</button>
                </div>
            </div>
        </div>
    );
};

// --- 评论楼层组件 (包含折叠和楼中楼) ---
const CommentFloor = ({ comment, postId }) => {
  const [replies, setReplies] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false); // 控制折叠状态
  const [showReplyInput, setShowReplyInput] = useState(false);

  useEffect(() => {
      if (!comment.id) return;
      const q = query(
          collection(db, 'posts', postId, 'comments'),
          where('parentCommentId', '==', comment.id),
          orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
          const fetchedReplies = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setReplies(fetchedReplies);
      });
      return () => unsubscribe();
  }, [postId, comment.id]);

  const displayedReplies = isExpanded ? replies : replies.slice(0, 3);

  return (
    <div className="py-5 border-t border-gray-100 dark:border-gray-700">
        <div className="flex space-x-4">
            <Link href={`/profile/${comment.authorId}`}>
                <a className="flex-shrink-0"><img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full" /></a>
            </Link>
            <div className="flex-1">
                <p className="font-semibold text-gray-800 dark:text-gray-200">{comment.authorName}</p>
                <p className="text-gray-700 dark:text-gray-300 mt-2">{comment.content}</p>
                <div className="mt-2 flex items-center space-x-4 text-xs text-gray-400">
                    <span>{formatTimeAgo(comment.createdAt)}</span>
                    <button onClick={() => setShowReplyInput(!showReplyInput)} className="font-semibold hover:text-blue-500">回复</button>
                </div>

                {/* 楼中楼回复 */}
                {replies.length > 0 && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-4">
                        {displayedReplies.map(reply => (
                            <ReplyItem key={reply.id} reply={reply} onReply={() => setShowReplyInput(true)} />
                        ))}
                        {replies.length > 3 && !isExpanded && (
                            <button onClick={() => setIsExpanded(true)} className="text-sm font-semibold text-blue-500 hover:underline flex items-center">
                                展开其余 {replies.length - 3} 条回复 <ChevronDown size={16} className="ml-1" />
                            </button>
                        )}
                        {showReplyInput && <CommentInput postId={postId} parentComment={comment} placeholder={`回复 @${comment.authorName}`} onCommentAdded={() => setShowReplyInput(false)} />}
                    </div>
                )}

                {replies.length === 0 && showReplyInput && (
                    <div className="mt-4">
                        <CommentInput postId={postId} parentComment={comment} placeholder={`回复 @${comment.authorName}`} onCommentAdded={() => setShowReplyInput(false)} />
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};

// --- 新的评论区主组件 ---
const NewCommentSection = ({ post }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const postId = post?.id;

    useEffect(() => {
        if (!postId) return;
        const q = query(
            collection(db, 'posts', postId, 'comments'),
            where('parentCommentId', '==', null),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setComments(fetchedComments);
        }, (error) => console.error("加载评论失败:", error));
        return () => unsubscribe();
    }, [postId]);

    const handlePostComment = async (content) => {
        if (!user || !content) return false;
        try {
            await addDoc(collection(db, 'posts', postId, 'comments'), {
                content,
                authorId: user.uid,
                authorName: user.displayName,
                authorAvatar: user.photoURL,
                parentCommentId: null,
                createdAt: serverTimestamp(),
            });
            await updateDoc(doc(db, 'posts', postId), { commentCount: increment(1) });
            return true;
        } catch (error) {
            console.error("评论失败:", error);
            alert("评论失败，请重试。");
            return false;
        }
    };

    return (
        <div id="comments" className='duration-200 px-5'>
            <div className='text-2xl font-bold dark:text-white mb-6 flex items-center gap-2'>
                <MessageSquare/>
                <span>评论 ({post?.commentCount || 0})</span>
            </div>
            {user ? (
                <div className="mb-8">
                    <CommentInput postId={postId} onCommentAdded={() => {}} placeholder="留下你的精彩评论吧..." />
                </div>
            ) : (
                <div className="text-center p-4 border dark:border-gray-700 rounded-lg mb-8">
                    <p className='dark:text-gray-300'>请<button onClick={() => alert('请实现登录弹窗')} className="text-blue-500 font-bold mx-1 hover:underline">登录</button>后发表评论</p>
                </div>
            )}

            <div>
                {comments.map(comment => (
                    <CommentFloor key={comment.id} comment={comment} postId={postId} />
                ))}
                {comments.length === 0 && <p className="text-center text-gray-500 py-10">还没有评论，快来抢沙发吧！</p>}
            </div>
        </div>
    );
};


/**
 * 文章详情页布局
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props;
  const { fullWidth } = useGlobal();
  const router = useRouter();

  // 404 跳转逻辑
  useEffect(() => {
    if (!post) {
      setTimeout(() => {
          if (isBrowser) {
            const article = document.querySelector('#article-wrapper');
            if (!article) {
              router.push('/404').then(() => console.warn('找不到页面', router.asPath));
            }
          }
        }, 5000
      );
    }
  }, [post, router]);

  return (
    <>
      <div className={`article w-full ${fullWidth ? '' : 'xl:max-w-5xl mx-auto'} bg-white dark:bg-[#18171d] dark:border-gray-600 lg:shadow-md lg:border rounded-2xl lg:p-4`}>
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <div id='article-wrapper'>
            <article itemScope itemType='https://schema.org/Article'>
              <section className='px-5 justify-center mx-auto'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
            </article>

            <div className="mt-8">
                <hr className='my-4 border-dashed' />
                <div className='py-2'>
                  <AdSlot />
                </div>
                <NewCommentSection post={post} />
            </div>
          </div>
        )}
      </div>

      <FloatTocButton {...props} />
    </>
  );
};

export default LayoutSlug;

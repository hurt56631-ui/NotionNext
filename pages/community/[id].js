// themes/heo/Layout/LayoutSlug.js (最终修复版 - 修复所有路径引用错误)

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// ✅ 导入 Lucide 图标
import { Heart, MessageSquare, Send } from 'lucide-react';

// ✅ ---【核心修复：使用别名路径 @/ 替代相对路径 ../】--- ✅
import Comment from '@/components/Comment'; // 旧的 Comment 组件，我们将用新的逻辑替代
import { AdSlot } from '@/components/GoogleAdsense';
import NotionPage from '@/components/NotionPage';
import WWAds from '@/components/WWAds';
import { useGlobal } from '@/lib/global';
import { isBrowser } from '@/lib/utils';
import FloatTocButton from '@/themes/heo/components/FloatTocButton'; // 修复路径
import { PostLock } from '@/themes/heo/components/PostLock';       // 修复路径
import AISummary from '@/components/AISummary';
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice';

// 动态导入 PostContent
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// --- 辅助函数：时间格式化 ---
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

// --- 回复输入框组件 (用于主评论和楼中楼回复) ---
const CommentInput = ({ postId, parentCommentId = null, onCommentAdded, placeholder = "发表你的看法..." }) => {
    const { user } = useAuth();
    const [content, setContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!content.trim() || !user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            await addDoc(commentsRef, {
                content: content.trim(),
                authorId: user.uid,
                authorName: user.displayName,
                authorAvatar: user.photoURL,
                parentCommentId, // 标记父评论ID
                createdAt: serverTimestamp(),
            });
            setContent('');
            if (onCommentAdded) onCommentAdded();

            // 如果是主评论，更新帖子总评论数
            if (!parentCommentId) {
                const postRef = doc(db, 'posts', postId);
                await updateDoc(postRef, { commentCount: increment(1) });
            }
        } catch (error) {
            console.error("发表评论失败:", error);
            alert("发表评论失败，请重试。");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!user) return null;

    return (
        <div className="flex items-center space-x-3">
            <img src={user.photoURL || '/img/avatar.svg'} alt="你的头像" className="w-9 h-9 rounded-full" />
            <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-700 rounded-full">
                <input 
                    type="text" 
                    value={content} 
                    onChange={(e) => setContent(e.target.value)} 
                    placeholder={placeholder}
                    className="w-full bg-transparent px-4 py-2 focus:outline-none text-gray-800 dark:text-gray-200"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                />
                <button onClick={handleSubmit} disabled={isSubmitting || !content.trim()} className="p-2 mr-1 rounded-full text-white bg-blue-500 disabled:bg-gray-400 transition-colors active:scale-95">
                    <Send size={18} />
                </button>
            </div>
        </div>
    );
};

// --- 单个评论/回复渲染组件 ---
const CommentItem = ({ comment, postId, isReply = false }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    return (
        <div className="flex space-x-3">
            <Link href={`/profile/${comment.authorId}`}>
                <a className="flex-shrink-0"><img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-9 h-9 rounded-full" /></a>
            </Link>
            <div className="flex-1">
                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                        <Link href={`/profile/${comment.authorId}`}><a className="font-semibold text-sm text-gray-800 dark:text-gray-200 hover:underline">{comment.authorName}</a></Link>
                        <p className="text-xs text-gray-400">{formatTimeAgo(comment.createdAt)}</p>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
                </div>
                <div className="pl-3 mt-1">
                    <button onClick={() => setShowReplyInput(!showReplyInput)} className="text-xs font-semibold text-gray-500 hover:text-blue-500">
                        回复
                    </button>
                </div>
                {showReplyInput && (
                    <div className="mt-2">
                        <CommentInput 
                            postId={postId} 
                            parentCommentId={comment.id} 
                            placeholder={`回复 @${comment.authorName}`}
                            onCommentAdded={() => setShowReplyInput(false)} 
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

// --- 评论楼层组件 (包含楼中楼逻辑) ---
const CommentFloor = ({ comment, postId }) => {
  const [replies, setReplies] = useState([]);

  // 加载对这条评论的回复 (楼中楼)
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

  return (
    <div className="py-4 border-t border-gray-100 dark:border-gray-700">
        {/* 一级评论 */}
        <CommentItem comment={comment} postId={postId} />
        
        {/* 二级及以上评论 (楼中楼)，固定一级缩进 */}
        {replies.length > 0 && (
            <div className="mt-4 pl-8 md:pl-12 space-y-4">
                {replies.map(reply => (
                    <CommentItem key={reply.id} comment={reply} postId={postId} isReply={true} />
                ))}
            </div>
        )}
    </div>
  );
};

// --- 新的评论区主组件 ---
const NewCommentSection = ({ post }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const postId = post?.id;

    // 实时获取主评论
    useEffect(() => {
        if (!postId) return;
        const q = query(
            collection(db, 'posts', postId, 'comments'),
            where('parentCommentId', '==', null),
            orderBy('createdAt', 'desc') // 最新评论在最上面
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setComments(fetchedComments);
        }, (error) => console.error("加载评论失败:", error));
        return () => unsubscribe();
    }, [postId]);

    return (
        <div id="comments" className='duration-200 overflow-x-auto px-5'>
            <div className='text-2xl font-bold dark:text-white mb-6'>
                <div className="flex items-center gap-2">
                    <MessageSquare/>
                    <span>评论 ({post?.commentCount || 0})</span>
                </div>
            </div>
            {/* 评论输入框 */}
            {user ? (
                <div className="mb-6">
                    <CommentInput postId={postId} />
                </div>
            ) : (
                <div className="text-center p-4 border dark:border-gray-700 rounded-lg mb-6">
                    <p className='dark:text-gray-300'>请<button onClick={() => alert('请实现登录弹窗')} className="text-blue-500 font-bold mx-1 hover:underline">登录</button>后发表评论</p>
                </div>
            )}

            {/* 评论列表 */}
            <div>
                {comments.map(comment => (
                    <CommentFloor key={comment.id} comment={comment} postId={postId} />
                ))}
                {comments.length === 0 && <p className="text-center text-gray-500 py-8">还没有评论，快来抢沙发吧！</p>}
            </div>
        </div>
    );
};


/**
 * 文章详情页布局
 * @param {*} props
 * @returns
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props;
  const { locale, fullWidth } = useGlobal();
  const router = useRouter();

  const [hasCode, setHasCode] = useState(false);

  useEffect(() => {
    // 延迟执行以确保 DOM 完全加载
    setTimeout(() => {
        const codeBlocks = document.querySelectorAll('[class^="language-"]');
        setHasCode(codeBlocks.length > 0);
    }, 500);
  }, [post]);

  // 404 跳转逻辑
  useEffect(() => {
    if (!post) {
      setTimeout(
        () => {
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
      <div className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl mx-auto'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:shadow-md lg:border rounded-2xl lg:p-4`}>
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <div id='article-wrapper'>
            {/* Notion文章主体 */}
            <article itemScope itemType='https://schema.org/Article'>
              <section className='px-5 justify-center mx-auto'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
            </article>

            {/* ✅ ---【核心修改：替换为新的楼中楼评论区】--- ✅ */}
            <div className="mt-8">
                <hr className='my-4 border-dashed' />
                <div className='py-2'>
                  <AdSlot />
                </div>
                {/* 使用新的评论区组件 */}
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

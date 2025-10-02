

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, addDoc, serverTimestamp, updateDoc, increment } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import dynamic from 'next/dynamic';
import { Volume2, Send } from 'lucide-react';
import Link from 'next/link';

import Comment from '@/components/Comment' // 旧的 Comment 组件，我们将用新的逻辑替代
import { AdSlot } from '@/components/GoogleAdsense'
import LazyImage from '@/components/LazyImage'
import NotionPage from '@/components/NotionPage'
import WWAds from '@/components/WWAds'
import { useGlobal } from '@/lib/global'
import { isBrowser } from '@/lib/utils'
import FloatTocButton from '../components/FloatTocButton'
import { PostLock } from '../components/PostLock'
import AISummary from '@/components/AISummary'
import ArticleExpirationNotice from '@/components/ArticleExpirationNotice'

const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// --- 辅助函数：时间格式化 ---
const formatTimeAgo = (ts) => {
  if (!ts) return '不久前';
  try {
    const date = ts?.toDate ? ts.toDate() : new Date(ts);
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN });
  } catch (e) { return '日期错误'; }
};

// --- 辅助函数：TTS 朗读 ---
const playTTS = (text) => {
  try {
    const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
    new Audio(url).play();
  } catch (error) { console.error("TTS playback failed:", error); }
};

// ===================================================================
// =============  ✅ 新增：楼中楼评论区相关组件  =============
// ===================================================================

// --- 楼中楼回复框组件 ---
const ReplyInput = ({ postId, parentCommentId, onCommentAdded }) => {
    const { user } = useAuth();
    const [reply, setReply] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!reply.trim() || !user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            await addDoc(commentsRef, {
                content: reply,
                authorId: user.uid,
                authorName: user.displayName,
                authorAvatar: user.photoURL,
                parentCommentId: parentCommentId, // 标记这是对哪条评论的回复
                createdAt: serverTimestamp(),
            });
            setReply('');
            if (onCommentAdded) onCommentAdded(); // 通知父组件有新评论
        } catch (error) {
            console.error("回复失败:", error);
            alert("回复失败，请重试。");
        } finally {
            setIsSubmitting(false);
        }
    };
    
    if (!user) return null;

    return (
        <div className="flex items-center space-x-2 mt-2 p-2 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <input 
                type="text" 
                value={reply} 
                onChange={(e) => setReply(e.target.value)} 
                placeholder="添加回复..." 
                className="flex-1 bg-transparent focus:outline-none text-sm px-2 text-gray-800 dark:text-gray-200"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
            <button onClick={handleSubmit} disabled={isSubmitting || !reply.trim()} className="p-2 rounded-full bg-blue-500 text-white disabled:bg-gray-400">
                <Send size={16} />
            </button>
        </div>
    );
};

// --- 单个评论楼层组件 (包含楼中楼) ---
const CommentFloor = ({ comment, postId }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
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
    <div className="flex space-x-3 py-4 border-b border-gray-100 dark:border-gray-700">
      <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className="w-10 h-10 rounded-full mt-1" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-gray-800 dark:text-gray-200">{comment.authorName}</p>
          <p className="text-xs text-gray-400">{formatTimeAgo(comment.createdAt)}</p>
        </div>
        <p className="text-gray-700 dark:text-gray-300 mt-1">{comment.content}</p>
        <button onClick={() => setShowReplyInput(!showReplyInput)} className="text-xs text-gray-500 hover:text-blue-500 mt-2">
            回复
        </button>

        {replies.length > 0 && (
            <div className="mt-3 space-y-3 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                {replies.map(reply => (
                    <div key={reply.id} className="text-sm">
                        <p>
                            <Link href={`/profile/${reply.authorId}`}><a className="font-semibold text-blue-500 hover:underline">{reply.authorName}</a></Link>
                            : <span className="text-gray-600 dark:text-gray-400">{reply.content}</span>
                        </p>
                    </div>
                ))}
            </div>
        )}
        
        {showReplyInput && <ReplyInput postId={postId} parentCommentId={comment.id} onCommentAdded={() => setShowReplyInput(false)} />}
      </div>
    </div>
  );
};

// --- 新的评论区主组件 ---
const NewCommentSection = ({ post }) => {
    const { user } = useAuth();
    const [comments, setComments] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const postId = post?.id;

    // 实时获取主评论
    useEffect(() => {
        if (!postId) return;
        const q = query(
            collection(db, 'posts', postId, 'comments'),
            where('parentCommentId', '==', null),
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setComments(fetchedComments);
        }, (error) => console.error("加载评论失败:", error));
        return () => unsubscribe();
    }, [postId]);

    const handlePostComment = async () => {
        if (!newComment.trim() || !user || isSubmitting) return;
        setIsSubmitting(true);
        try {
            const commentsRef = collection(db, 'posts', postId, 'comments');
            await addDoc(commentsRef, {
                content: newComment,
                authorId: user.uid,
                authorName: user.displayName,
                authorAvatar: user.photoURL,
                parentCommentId: null,
                createdAt: serverTimestamp(),
            });
            setNewComment("");
            const postRef = doc(db, 'posts', postId);
            await updateDoc(postRef, { commentCount: increment(1) });
        } catch (error) {
            console.error("评论失败:", error);
            alert("评论失败，请重试。");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className='duration-200 overflow-x-auto px-5'>
            <div className='text-2xl dark:text-white'>
                <i className='fas fa-comment mr-1' />
                评论 ({post?.commentCount || 0})
            </div>
            {/* 评论输入框 */}
            {user ? (
                <div className="flex items-center space-x-3 my-6">
                    <img src={user.photoURL || '/img/avatar.svg'} alt="你的头像" className="w-10 h-10 rounded-full" />
                    <div className="flex-1 flex items-center bg-gray-100 dark:bg-gray-700 rounded-full">
                        <input 
                            type="text" 
                            value={newComment} 
                            onChange={(e) => setNewComment(e.target.value)} 
                            placeholder="发表你的看法..." 
                            className="w-full bg-transparent px-4 py-2 focus:outline-none text-gray-800 dark:text-gray-200"
                            onKeyDown={(e) => { if (e.key === 'Enter') handlePostComment(); }}
                        />
                        <button onClick={handlePostComment} disabled={isSubmitting || !newComment.trim()} className="p-2 mr-1 rounded-full text-white bg-blue-500 disabled:bg-gray-400">
                            <Send size={18} />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="text-center p-4 border rounded-lg my-6">
                    <p>请<button onClick={() => alert('请实现登录弹窗')} className="text-blue-500 font-bold mx-1">登录</button>后发表评论</p>
                </div>
            )}

            {/* 评论列表 */}
            <div className="space-y-4">
                {comments.map(comment => (
                    <CommentFloor key={comment.id} comment={comment} postId={postId} />
                ))}
                {comments.length === 0 && <p className="text-center text-gray-500 pt-4">还没有评论，快来抢沙发吧！</p>}
            </div>
        </div>
    );
};


/**
 * 文章详情
 * @param {*} props
 * @returns
 */
const LayoutSlug = props => {
  const { post, lock, validPassword } = props
  const { locale, fullWidth } = useGlobal()

  const [hasCode, setHasCode] = useState(false)

  useEffect(() => {
    // 延迟执行以确保 DOM 完全加载
    setTimeout(() => {
        const codeBlocks = document.querySelectorAll('[class^="language-"]');
        setHasCode(codeBlocks.length > 0);
    }, 500);
  }, [post]);

  const router = useRouter()
  useEffect(() => {
    // 404
    if (!post) {
      setTimeout(
        () => {
          if (isBrowser) {
            const article = document.querySelector('#article-wrapper #notion-article')
            if (!article) {
              router.push('/404').then(() => {
                console.warn('找不到页面', router.asPath)
              })
            }
          }
        },
        siteConfig('POST_WAITING_TIME_FOR_404', 5000)
      )
    }
  }, [post])
  return (
    <>
      <div
        className={`article h-full w-full ${fullWidth ? '' : 'xl:max-w-5xl'} ${hasCode ? 'xl:w-[73.15vw]' : ''}  bg-white dark:bg-[#18171d] dark:border-gray-600 lg:hover:shadow lg:border rounded-2xl lg:px-2 lg:py-4 `}>
        {/* 文章锁 */}
        {lock && <PostLock validPassword={validPassword} />}

        {!lock && post && (
          <div className='mx-auto md:w-full md:px-5'>
            {/* 文章主体 */}
            <article
              id='article-wrapper'
              itemScope
              itemType='https://schema.org/Movie'>
              {/* Notion文章主体 */}
              <section
                className='wow fadeInUp p-5 justify-center mx-auto'
                data-wow-delay='.2s'>
                <ArticleExpirationNotice post={post} />
                <AISummary aiSummary={post.aiSummary} />
                <WWAds orientation='horizontal' className='w-full' />
                {post && <NotionPage post={post} />}
                <WWAds orientation='horizontal' className='w-full' />
              </section>
            </article>

            {/* ✅ ---【核心修改：替换为新的楼中楼评论区】--- ✅ */}
            <div className={`${post ? '' : 'hidden'}`}>
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
  )
}

export default LayoutSlug

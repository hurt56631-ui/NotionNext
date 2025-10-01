// pages/community/[id].js (新拟物化 + 抖音评论区风格 - 最终版)

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// --- Dynamic Imports for Client-Side Components ---
const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const LayoutBaseDynamic = dynamic(() => import('@/themes/heo').then(m => m.LayoutBase), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// --- TTS (Text-to-Speech) Functions ---
const playTTS = (text) => {
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
};


// --- Custom Hook for Long Press ---
const useLongPress = (callback = () => {}, ms = 300) => {
  const [startLongPress, setStartLongPress] = useState(false);
  const timerRef = useRef();
  const isLongPress = useRef(false);

  useEffect(() => {
    if (startLongPress) {
      isLongPress.current = false;
      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        callback();
      }, ms);
    } else {
      clearTimeout(timerRef.current);
    }

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [startLongPress, ms, callback]);
  
  const start = useCallback((e) => {
    // prevent context menu on desktop
    e.preventDefault(); 
    setStartLongPress(true);
  }, []);
  const stop = useCallback((e, wasClicked = false) => {
    setStartLongPress(false);
    if (wasClicked && !isLongPress.current) {
        // This can be used to handle normal clicks if needed
    }
  }, []);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
  };
};


// --- Main Page Component ---
const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();

  // State Management
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [commentSort, setCommentSort] = useState('默认');
  const [showLongPressMenu, setShowLongPressMenu] = useState(false);
  const [longPressedComment, setLongPressedComment] = useState(null);

  // --- Data Fetching ---
  useEffect(() => {
    if (!id) return;

    setLoading(true);

    // Fetch Post
    const postRef = doc(db, 'posts', id);
    const unsubPost = onSnapshot(postRef, (snap) => {
      if (snap.exists()) {
        setPost({ id: snap.id, ...snap.data() });
      } else {
        setError('帖子不存在或已被删除');
      }
    }, (e) => {
      console.error(e);
      setError('加载帖子失败');
    });

    // Fetch Comments
    const commentsQuery = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'desc'));
    const unsubComments = onSnapshot(commentsQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setComments(data);
      setLoading(false);
    }, (e) => {
      console.error(e);
      setLoading(false);
    });
    
    // Increment view count
    getDoc(postRef).then(snap => {
        if(snap.exists()) updateDoc(postRef, { viewsCount: increment(1) });
    });


    return () => {
      unsubPost();
      unsubComments();
    };
  }, [id]);

  // --- Interaction Handlers ---
  const handleInteraction = async (action, targetId, type) => {
    if (!user) return setShowLoginModal(true);

    const ref = doc(db, type === 'post' ? 'posts' : 'comments', targetId);
    const target = type === 'post' ? post : comments.find(c => c.id === targetId);
    if (!target) return;

    const field = action === 'like' ? 'likers' : 'dislikers';
    const countField = action === 'like' ? 'likesCount' : 'dislikesCount';
    
    const hasInteracted = target[field]?.includes(user.uid);
    const currentArray = target[field] || [];
    
    try {
      if (hasInteracted) {
        await updateDoc(ref, {
          [countField]: increment(-1),
          [field]: currentArray.filter(uid => uid !== user.uid)
        });
      } else {
        await updateDoc(ref, {
          [countField]: increment(1),
          [field]: [...currentArray, user.uid]
        });
      }
    } catch (e) { console.error(`${action} failed:`, e); }
  };

  const toggleFavorite = async () => {
    if (!user || !post) return setShowLoginModal(true);
    // This logic assumes user data is available via `useAuth` context, 
    // including a `favorites` array.
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const favorites = userDoc.exists() ? userDoc.data().favorites || [] : [];
    const hasFavorited = favorites.includes(post.id);

    try {
      if (hasFavorited) {
        await updateDoc(userRef, { favorites: favorites.filter(pid => pid !== post.id) });
      } else {
        await updateDoc(userRef, { favorites: [...favorites, post.id] });
      }
    } catch (e) { console.error(e); }
  };
  
  const handleCommentSubmit = async (content, parentId = null) => {
      if (!content.trim()) return;
      if (!user) return setShowLoginModal(true);
      try {
        await addDoc(collection(db, 'comments'), {
          postId: id,
          parentId,
          content: content.trim(),
          authorId: user.uid,
          authorName: user.displayName || '匿名用户',
          authorAvatar: user.photoURL || '/img/avatar.svg',
          createdAt: serverTimestamp(),
          likesCount: 0,
          dislikesCount: 0,
          likers: [],
          dislikers: []
        });
        return true; // Indicate success
      } catch (err) {
        console.error(err);
        alert('评论失败');
        return false; // Indicate failure
      }
  };
  
  const handleCommentDelete = async (commentId) => {
    if (!commentId) return;
    const commentToDelete = comments.find(c => c.id === commentId);
    if (!user || (user.uid !== commentToDelete?.authorId && !user.isAdmin)) {
      alert("无权删除");
      return;
    }
    if (confirm("确定要删除这条评论吗？")) {
        await deleteDoc(doc(db, 'comments', commentId));
        setShowLongPressMenu(false);
        setLongPressedComment(null);
    }
  }

  // --- Long Press Logic ---
  const openLongPressMenu = (comment) => {
    setLongPressedComment(comment);
    setShowLongPressMenu(true);
  };
  
  // --- Memoized Sorting and Filtering ---
  const sortedComments = (useCallback(() => {
    let sorted = [...comments];
    switch (commentSort) {
      case '最新':
        sorted.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        break;
      case '热门':
        sorted.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0));
        break;
      case '默认':
      default:
        // Default is descending by time, which is the initial query
        break;
    }
    return sorted;
  }, [comments, commentSort]));

  const mainComments = sortedComments().filter(c => !c.parentId);
  const replies = sortedComments().filter(c => c.parentId);

  // --- Render Logic ---
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p>加载中...</p>
      </div>
    );
  }
  
  if (error) {
     return (
      <div className="flex justify-center items-center h-screen bg-gray-50">
        <p>{error}</p>
      </div>
    );
  }


  return (
    <LayoutBaseDynamic>
      <div className="relative w-full min-h-screen bg-gray-50 text-gray-800">
        {/* Optional decorative background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-50/50 via-gray-100/40 to-gray-200/30"></div>

        <TopNavBar />

        <main className="max-w-4xl mx-auto px-4 pt-20 pb-28 relative z-10">
            {post && (
                <PostContentCard
                    post={post}
                    user={user}
                    onLike={() => handleInteraction('like', post.id, 'post')}
                    onDislike={() => handleInteraction('dislike', post.id, 'post')}
                    onFavorite={toggleFavorite}
                />
            )}
            
            {comments && (
                <CommentArea
                    comments={mainComments}
                    replies={replies}
                    sortOrder={commentSort}
                    setSortOrder={setCommentSort}
                    onInteraction={handleInteraction}
                    onReplySubmit={handleCommentSubmit}
                    onLongPress={openLongPressMenu}
                    user={user}
                />
            )}
        </main>
        
        <CommentInputFooter user={user} onSubmit={handleCommentSubmit} />
        
        {showLongPressMenu && longPressedComment && (
            <LongPressMenu
                comment={longPressedComment}
                user={user}
                onClose={() => setShowLongPressMenu(false)}
                onDelete={() => handleCommentDelete(longPressedComment.id)}
                onLike={() => handleInteraction('like', longPressedComment.id, 'comment')}
                onDislike={() => handleInteraction('dislike', longPressedComment.id, 'comment')}
            />
        )}
        
        <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      </div>
    </LayoutBaseDynamic>
  );
};

export default PostDetailPage;


// --- UI Sub-components ---

const TopNavBar = () => {
    const router = useRouter();
    return (
        <header className="fixed top-0 left-0 right-0 z-50 bg-white/60 backdrop-blur-lg shadow-sm border-b border-gray-200/50">
            <div className="max-w-4xl mx-auto py-3 px-4 flex items-center justify-between">
                <button className="p-2 rounded-full text-gray-600 hover:bg-gray-200/60 transition-colors" onClick={() => router.back()}>
                    <i className="fas fa-arrow-left text-lg"></i>
                </button>
                <h1 className="text-xl font-bold text-gray-800 truncate flex-grow text-center ml-4 mr-4">帖子详情</h1>
                <button className="p-2 rounded-full text-gray-600 hover:bg-gray-200/60 transition-colors">
                    <i className="fas fa-ellipsis-h text-lg"></i>
                </button>
            </div>
        </header>
    );
};

const PostContentCard = ({ post, user, onLike, onDislike, onFavorite }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const contentRef = useRef(null);
    const [needsExpansion, setNeedsExpansion] = useState(false);
    
    useEffect(() => {
        if (contentRef.current && contentRef.current.scrollHeight > contentRef.current.clientHeight) {
            setNeedsExpansion(true);
        }
    }, [post.content]);
    
    const hasLiked = user && post.likers?.includes(user.uid);
    const hasDisliked = user && post.dislikers?.includes(user.uid);
    // Note: Favorite status would ideally come from a user context or prop
    
    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 mb-6 border border-gray-200/50">
            {/* User Info */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                    <img src={post.authorAvatar || '/img/avatar.svg'} alt="用户头像" className="w-12 h-12 rounded-full mr-3 shadow-sm border-2 border-white" />
                    <div>
                        <h3 className="font-bold text-lg text-gray-800 flex items-center">{post.authorName} <span className="ml-2 text-blue-500 text-xs px-2 py-0.5 bg-blue-100 rounded-full font-semibold">楼主</span></h3>
                        <p className="text-xs text-gray-500">{new Date(post.createdAt?.toDate()).toLocaleString()} (城市)</p>
                    </div>
                </div>
                <button className="px-4 py-1.5 bg-blue-500 text-white rounded-full text-sm shadow-sm hover:bg-blue-600 transition-colors active:scale-95 font-semibold">
                    <i className="fas fa-plus mr-1"></i>关注
                </button>
            </div>

            {/* Title */}
            <div className="flex items-center mb-3">
                <h2 className="text-2xl font-bold text-gray-800 flex-grow">{post.title}</h2>
                <button onClick={() => playTTS(post.title)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200/60 transition-colors"><i className="fas fa-volume-up text-lg"></i></button>
            </div>
            
            {/* Video if exists */}
            {post.videoUrl && <div className="my-4"><VideoEmbed url={post.videoUrl} controls /></div>}

            {/* Content */}
            <div className="relative">
                <p ref={contentRef} className={`text-gray-700 leading-relaxed mb-4 ${!isExpanded && 'line-clamp-5'}`}>
                    {post.content}
                </p>
                {needsExpansion && !isExpanded && (
                     <button onClick={() => setIsExpanded(true)} className="text-blue-500 text-sm hover:underline font-semibold ml-1">展开全文</button>
                )}
            </div>
             <button onClick={() => playTTS(post.content)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200/60 transition-colors"><i className="fas fa-volume-up text-lg"></i></button>

            {/* Actions */}
            <div className="flex items-center justify-around mt-6 text-gray-500 border-t border-gray-100 pt-4">
                <button onClick={onLike} className={`flex flex-col items-center gap-1 hover:text-red-500 transition-colors active:scale-95 ${hasLiked && 'text-red-500'}`}>
                    <i className="fas fa-thumbs-up text-lg"></i> <span className="text-xs font-semibold">{post.likesCount || 0}</span>
                </button>
                <button onClick={onDislike} className={`flex flex-col items-center gap-1 hover:text-blue-500 transition-colors active:scale-95 ${hasDisliked && 'text-blue-500'}`}>
                    <i className="fas fa-thumbs-down text-lg"></i> <span className="text-xs font-semibold">{post.dislikesCount || 0}</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-green-500 transition-colors active:scale-95">
                    <i className="fas fa-comment text-lg"></i> <span className="text-xs font-semibold">{post.commentsCount || 0}</span>
                </button>
                <button className="flex flex-col items-center gap-1 hover:text-indigo-500 transition-colors active:scale-95">
                    <i className="fas fa-share-alt text-lg"></i> <span className="text-xs font-semibold">分享</span>
                </button>
                <button onClick={onFavorite} className="flex flex-col items-center gap-1 hover:text-yellow-500 transition-colors active:scale-95">
                    <i className="fas fa-star text-lg"></i> <span className="text-xs font-semibold">收藏</span>
                </button>
            </div>
        </div>
    );
};

const CommentArea = ({ comments, replies, sortOrder, setSortOrder, onInteraction, onReplySubmit, onLongPress, user }) => {
    return (
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-md p-6 mt-6 border border-gray-200/50">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800">评论 ({comments.length})</h3>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    {['默认', '最新', '热门'].map(order => (
                        <button key={order} onClick={() => setSortOrder(order)} className={`px-3 py-1 rounded-full transition-colors ${sortOrder === order ? 'bg-blue-500 text-white font-semibold' : 'hover:bg-gray-100'}`}>
                            {order}
                        </button>
                    ))}
                </div>
            </div>
            
            {/* Comments List */}
            <div className="space-y-4">
                {comments.map(comment => (
                    <CommentItem
                        key={comment.id}
                        comment={comment}
                        replies={replies.filter(r => r.parentId === comment.id)}
                        onInteraction={onInteraction}
                        onReplySubmit={onReplySubmit}
                        onLongPress={onLongPress}
                        user={user}
                    />
                ))}
            </div>
        </div>
    );
};

const CommentItem = ({ comment, replies, onInteraction, onReplySubmit, onLongPress, user }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);

    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);
    
    const longPressEvents = useLongPress(() => onLongPress(comment));

    return (
        <div className="pb-4 border-b border-gray-100 last:border-b-0" {...longPressEvents}>
            <div className="flex items-start gap-3">
                <img src={comment.authorAvatar} alt="用户头像" className="w-10 h-10 rounded-full shrink-0 shadow-sm" />
                <div className="flex-grow">
                    <h4 className="font-semibold text-gray-800">{comment.authorName} <span className="text-xs text-gray-500 ml-2 font-normal">{new Date(comment.createdAt?.toDate()).toLocaleString()}</span></h4>
                    <p className="text-gray-700 my-1">{comment.content}</p>
                    <div className="flex items-center gap-4 text-gray-500 text-sm">
                        <button onClick={() => onInteraction('like', comment.id, 'comment')} className={`flex items-center gap-1 hover:text-red-500 ${hasLiked && 'text-red-500'}`}><i className="fas fa-thumbs-up"></i> <span>{comment.likesCount || 0}</span></button>
                        <button onClick={() => onInteraction('dislike', comment.id, 'comment')} className={`flex items-center gap-1 hover:text-blue-500 ${hasDisliked && 'text-blue-500'}`}><i className="fas fa-thumbs-down"></i></button>
                        <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:text-blue-500 font-semibold">回复</button>
                    </div>

                    {showReplyInput && <ReplyInput onSubmit={(content) => { onReplySubmit(content, comment.id); setShowReplyInput(false); }} />}

                    {replies.length > 0 && <ReplyList replies={replies} onInteraction={onInteraction} onLongPress={onLongPress} user={user} onReplySubmit={onReplySubmit} mainCommentAuthor={comment.authorName} />}
                </div>
            </div>
        </div>
    );
};

const ReplyList = ({ replies, onInteraction, onLongPress, user, onReplySubmit, mainCommentAuthor }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const displayedReplies = isExpanded ? replies : replies.slice(0, 2);

    return (
        <div className="mt-4 bg-gray-50/70 rounded-lg p-3 space-y-3">
            {displayedReplies.map(reply => (
                <ReplyItem 
                    key={reply.id} 
                    reply={reply} 
                    onInteraction={onInteraction} 
                    onLongPress={onLongPress} 
                    user={user}
                    onReplySubmit={(content) => onReplySubmit(content, reply.parentId)} // All replies go to main comment
                    mainCommentAuthor={mainCommentAuthor}
                 />
            ))}
            {replies.length > 2 && !isExpanded && (
                <button onClick={() => setIsExpanded(true)} className="text-blue-500 text-sm font-semibold hover:underline">
                    展开 {replies.length - 2} 条回复 <i className="fas fa-chevron-down text-xs"></i>
                </button>
            )}
        </div>
    );
};

const ReplyItem = ({ reply, onInteraction, onLongPress, user, onReplySubmit, mainCommentAuthor }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);

    const hasLiked = user && reply.likers?.includes(user.uid);
    const hasDisliked = user && reply.dislikers?.includes(user.uid);

    const longPressEvents = useLongPress(() => onLongPress(reply));
    
    // Simple logic to find @mention
    const replyTo = reply.content.startsWith('@') ? reply.content.split(' ')[0] : `@${mainCommentAuthor}`;


    return (
        <div className="flex items-start gap-2" {...longPressEvents}>
            <img src={reply.authorAvatar} alt="回复用户头像" className="w-6 h-6 rounded-full shrink-0 shadow-sm" />
            <div className="flex-grow">
                <p className="text-gray-700 text-sm">
                    <span className="font-semibold text-gray-800">{reply.authorName}</span>
                    {/* <span className="text-blue-500 mx-1">{replyTo}</span> */}
                    : {reply.content}
                </p>
                <div className="flex items-center gap-3 text-gray-500 text-xs mt-1">
                    <span>{new Date(reply.createdAt?.toDate()).toLocaleTimeString()}</span>
                    <button onClick={() => onInteraction('like', reply.id, 'comment')} className={`flex items-center gap-1 hover:text-red-500 ${hasLiked && 'text-red-500'}`}><i className="fas fa-thumbs-up"></i> <span>{reply.likesCount || 0}</span></button>
                    <button onClick={() => onInteraction('dislike', reply.id, 'comment')} className={`flex items-center gap-1 hover:text-blue-500 ${hasDisliked && 'text-blue-500'}`}><i className="fas fa-thumbs-down"></i></button>
                    <button onClick={() => setShowReplyInput(!showReplyInput)} className="hover:text-blue-500 font-semibold">回复</button>
                </div>
                {showReplyInput && <ReplyInput placeholder={`@${reply.authorName} `} onSubmit={(content) => { onReplySubmit(content, reply.parentId); setShowReplyInput(false); }} />}
            </div>
        </div>
    );
};

const CommentInputFooter = ({ user, onSubmit }) => {
    const [content, setContent] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        const success = await onSubmit(content, null);
        if (success) {
            setContent('');
        }
    }
    
    return (
        <form onSubmit={handleSubmit} className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg shadow-[0_-2px_10px_rgba(0,0,0,0.05)] p-3 flex items-start gap-3 z-40">
            <div className="max-w-4xl mx-auto flex items-start gap-3 w-full">
                <img src={user?.photoURL || '/img/avatar.svg'} alt="用户头像" className="w-10 h-10 rounded-full shrink-0 shadow-sm" />
                <div className="flex-grow relative">
                    <textarea 
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={user ? "发表你的看法..." : "请先登录..."}
                        className="w-full pl-12 pr-24 py-2 bg-gray-100 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-24 h-10 transition-all duration-200 ease-in-out focus:h-20"
                        disabled={!user}
                    ></textarea>
                    <div className="absolute top-1/2 -translate-y-1/2 left-3 flex gap-3 text-gray-500 text-lg">
                        <button type="button" className="hover:text-blue-500"><i className="fas fa-smile"></i></button>
                        <button type="button" className="hover:text-blue-500"><i className="fas fa-at"></i></button>
                        {/* <button type="button" className="hover:text-blue-500"><i className="fas fa-image"></i></button> */}
                    </div>
                    <button type="submit" disabled={!content.trim() || !user} className="absolute top-1/2 -translate-y-1/2 right-2 px-5 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold">发表</button>
                </div>
            </div>
        </form>
    );
};

const ReplyInput = ({ onSubmit, placeholder = '' }) => {
    const [content, setContent] = useState(placeholder);
    
    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(content);
        setContent(placeholder);
    };

    return (
        <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
            <input 
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="添加回复..."
                className="flex-grow bg-gray-200/50 rounded-full px-3 py-1 text-sm border-transparent focus:border-blue-500 focus:bg-white focus:ring-0"
            />
            <button type="submit" className="text-sm text-blue-500 font-semibold disabled:text-gray-400" disabled={!content.replace(placeholder, '').trim()}>发送</button>
        </form>
    );
};

const LongPressMenu = ({ comment, user, onClose, onDelete, onLike, onDislike }) => {
    const canDelete = user && (user.uid === comment.authorId || user.isAdmin);

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white/80 backdrop-blur-lg rounded-xl shadow-xl p-2 w-64 text-gray-800" onClick={e => e.stopPropagation()}>
                <div className="p-2 border-b border-gray-200/80">
                    <p className="text-sm truncate">“{comment.content}”</p>
                </div>
                <div className="py-1">
                    <button onClick={() => { playTTS(comment.content); onClose(); }} className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-gray-500/10 rounded-md"><i className="fas fa-volume-up w-4 text-center"></i>朗读</button>
                    <button className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-gray-500/10 rounded-md"><i className="fas fa-language w-4 text-center"></i>翻译</button>
                </div>
                <hr className="my-1 border-gray-200/80" />
                <div className="py-1">
                    <button onClick={() => { onLike(); onClose(); }} className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-gray-500/10 rounded-md"><i className="fas fa-thumbs-up w-4 text-center"></i>点赞</button>
                    <button onClick={() => { onDislike(); onClose(); }} className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-gray-500/10 rounded-md"><i className="fas fa-thumbs-down w-4 text-center"></i>点踩</button>
                </div>
                <hr className="my-1 border-gray-200/80" />
                <div className="py-1">
                     <button className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-gray-500/10 rounded-md"><i className="fas fa-share-alt w-4 text-center"></i>分享</button>
                    {canDelete && (
                        <button onClick={onDelete} className="w-full flex items-center gap-3 py-2 px-3 text-left hover:bg-red-500/10 text-red-500 rounded-md"><i className="fas fa-trash w-4 text-center"></i>删除</button>
                    )}
                </div>
            </div>
        </div>
    );
};

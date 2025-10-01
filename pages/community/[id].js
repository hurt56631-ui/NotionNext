// pages/community/[id].js (UI/UX 最終优化版)

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
  doc, getDoc, collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// --- NEW Icon Components (Heroicons Style) ---
const ReadAloudIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.879 15.121A5.002 5.002 0 014 12a5 5 0 011.879-3.879m12.242 0A9 9 0 0021 12a9 9 0 00-2.879 6.121" /></svg>;
const LikeIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333V17a1 1 0 001 1h6.758a1 1 0 00.97-1.226l-1.25-4.375a1 1 0 01.97-1.226H17a1 1 0 001-1v-2a1 1 0 00-1-1h-2.25a1 1 0 00-1-1h-1.25a1 1 0 00-1 1H6z" /></svg>;
const DislikeIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667V3a1 1 0 00-1-1H6.242a1 1 0 00-.97 1.226l1.25 4.375a1 1 0 01-.97 1.226H3a1 1 0 00-1 1v2a1 1 0 001 1h2.25a1 1 0 001 1h1.25a1 1 0 001-1H14z" /></svg>;
const FavoriteIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
const ShareIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.186 2.25 2.25 0 00-3.933 2.186z" /></svg>;
const TranslateIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.625M21 21l-5.25-11.625M3.75 5.25h16.5M4.5 12h15M5.25 18h13.5" /></svg>;
const MoreOptionsIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
const EmojiIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const AtIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" /></svg>;

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

const ttsCache = new Map();
const playCachedTTS = async (text) => {
    if (ttsCache.has(text)) {
        return ttsCache.get(text).play();
    }
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=zh-CN-XiaoxiaoMultilingualNeural&r=-20`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(text, audio);
        audio.play();
    } catch (error) {
        console.error(`TTS failed for "${text}":`, error);
    }
};

const parseVideoUrl = (post) => {
  if (!post) return null;
  if (post.videoUrl) { try { new URL(post.videoUrl); return post.videoUrl; } catch {} }
  const urls = post.content?.match(/https?:\/\/[^\s<>"']+/g) || [];
  const patterns = [/youtu/, /vimeo/, /tiktok/, /facebook/, /twitch/, /dailymotion/, /bilibili/, /\.(mp4|webm|ogg|mov)$/i];
  return urls.find(u => patterns.some(p => p.test(u))) || null;
};
const removeUrlFromText = (text, url) => text?.replace(url, '').trim() || '';

const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user, loading: authLoading } = useAuth();
  
  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentContent, setCommentContent] = useState('');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAllMainComments, setShowAllMainComments] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showTranslateSettings, setShowTranslateSettings] = useState(false);
  const [translatedContent, setTranslatedContent] = useState({ post: null, comments: {} });
  const [hasFavorited, setHasFavorited] = useState(false);

  const videoUrl = useMemo(() => post && parseVideoUrl(post), [post]);
  const cleanedContent = useMemo(() => post ? removeUrlFromText(post.content, videoUrl) : '', [post, videoUrl]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const postRef = doc(db, 'posts', id);
    const unsubPost = onSnapshot(postRef, (snap) => {
        if (snap.exists()) setPost({ id: snap.id, ...snap.data() });
        else setError('帖子不存在或已被删除');
    }, (err) => { setError('加载帖子失败'); });

    const viewCountKey = `viewed_post_${id}`;
    if (typeof window !== 'undefined' && !sessionStorage.getItem(viewCountKey)) {
        updateDoc(postRef, { viewsCount: increment(1) })
            .then(() => sessionStorage.setItem(viewCountKey, 'true'))
            .catch(e => console.error("View count update failed:", e));
    }

    const commentsQuery = query(collection(db, 'comments'), where('postId', '==', id), orderBy('createdAt', 'asc'));
    const unsubComments = onSnapshot(commentsQuery, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setComments(data);
        setLoading(false);
    }, (err) => { setLoading(false); });

    return () => { unsubPost(); unsubComments(); };
  }, [id]);

  useEffect(() => {
    if (user && post) {
        const userDocRef = doc(db, 'users', user.uid);
        getDoc(userDocRef).then(userDoc => {
            if (userDoc.exists()) {
                const favorites = userDoc.data().favorites || [];
                setHasFavorited(favorites.includes(post.id));
            }
        });
    }
  }, [user, post]);

  const commentTree = useMemo(() => {
      const commentMap = {};
      comments.forEach(comment => {
          commentMap[comment.id] = { ...comment, children: [] };
      });
      const tree = [];
      comments.forEach(comment => {
          if (comment.parentId && commentMap[comment.parentId]) {
              commentMap[comment.parentId].children.push(commentMap[comment.id]);
          } else {
              tree.push(commentMap[comment.id]);
          }
      });
      return tree;
  }, [comments]);

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    if (!user) return setShowLoginModal(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id, parentId: null, content: commentContent.trim(),
        authorId: user.uid, authorName: user.displayName || '匿名',
        authorAvatar: user.photoURL || '/img/avatar.svg', createdAt: serverTimestamp()
      });
      setCommentContent('');
    } catch (err) { console.error(err); alert('评论失败'); }
  };
  
  const handleReplySubmit = async (content, parentId) => {
    if (!content.trim()) return;
    if (!user) return setShowLoginModal(true);
    try {
      await addDoc(collection(db, 'comments'), {
        postId: id, parentId, content: content.trim(),
        authorId: user.uid, authorName: user.displayName || '匿名',
        authorAvatar: user.photoURL || '/img/avatar.svg', createdAt: serverTimestamp()
      });
    } catch (err) { console.error(err); alert('回复失败'); }
  };

  const handleInteraction = async (action, targetId, type) => {
    if (!user) return setShowLoginModal(true);
    const ref = doc(db, type === 'post' ? 'posts' : 'comments', targetId);
    const target = type === 'post' ? post : comments.find(c => c.id === targetId);
    if (!target) return;
    const field = action === 'like' ? 'likers' : 'dislikers';
    const countField = action === 'like' ? 'likesCount' : 'dislikesCount';
    const hasInteracted = target[field]?.includes(user.uid);
    const newArray = hasInteracted ? target[field].filter(uid => uid !== user.uid) : [...(target[field] || []), user.uid];
    try {
      await updateDoc(ref, {
        [countField]: increment(hasInteracted ? -1 : 1),
        [field]: newArray
      });
    } catch (e) { console.error(`${action} failed:`, e); }
  };

  const toggleFavorite = async () => {
    if (!user || !post) return setShowLoginModal(true);
    const userRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userRef);
    const favorites = userDoc.exists() ? userDoc.data().favorites || [] : [];
    const newFavorites = hasFavorited ? favorites.filter(pid => pid !== post.id) : [...favorites, post.id];
    try {
        await updateDoc(userRef, { favorites: newFavorites });
        setHasFavorited(!hasFavorited);
    } catch (e) { console.error(e); }
  };

  const deletePost = async () => {
    if (!(user?.isAdmin || user?.uid === post?.authorId)) return;
    if (confirm('确认删除此帖子吗？')) {
      await deleteDoc(doc(db, 'posts', id));
      router.push('/community');
    }
  };
  
  const callTranslateAPI = async (text, settings) => { /* ... implementation from before ... */ };
  const handleTranslate = async () => { /* ... implementation from before ... */ };

  const hasLiked = user && post?.likers?.includes(user.uid);
  const hasDisliked = user && post?.dislikers?.includes(user.uid);

  if (authLoading || loading) return <div className="flex justify-center items-center h-screen"><p>加载中...</p></div>;
  if (error || !post) return <div className="flex justify-center items-center h-screen"><p>{error}</p></div>;

  return (
    <>
      <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0 pb-28">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8 relative">
          <div className="flex justify-between items-start">
            <h1 className="text-2xl md:text-3xl font-bold mb-2 pr-10">{post.title}</h1>
            <div className="relative">
              <button onClick={() => setShowOptionsMenu(p => !p)} className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-full">
                <MoreOptionsIcon />
              </button>
              {showOptionsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20 border dark:border-gray-700">
                  <ul className="py-1 text-sm text-gray-700 dark:text-gray-200">
                     <li><button onClick={() => { setShowShareMenu(true); setShowOptionsMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"><ShareIcon /> 分享</button></li>
                     <li><button onClick={() => { toggleFavorite(); setShowOptionsMenu(false); }} className={`w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 ${hasFavorited && 'text-yellow-500'}`}><FavoriteIcon filled={hasFavorited}/> {hasFavorited ? '已收藏' : '收藏'}</button></li>
                     {(user?.isAdmin || user?.uid === post?.authorId) && <>
                       <div className="my-1 h-px bg-gray-200 dark:bg-gray-600"></div>
                       <li><button onClick={() => { deletePost(); setShowOptionsMenu(false); }} className="w-full flex items-center gap-3 px-4 py-2 text-left text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">删除帖子</button></li>
                     </>}
                  </ul>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 space-x-2 mb-4">
            <img src={post.authorAvatar || '/img/avatar.svg'} alt={post.authorName} className="w-8 h-8 rounded-full" />
            <span>{post.authorName}</span>
            <span>· {new Date(post.createdAt?.toDate()).toLocaleString()}</span>
            <span>· 浏览 {post.viewsCount || 0}</span>
          </div>
          {videoUrl && <div className="my-4"><VideoEmbed url={videoUrl} controls /></div>}
          <div className="prose dark:prose-invert max-w-none my-4">
            <PostContent content={translatedContent.post || cleanedContent} />
          </div>
          <div className="flex items-center justify-end text-gray-500 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-4 space-x-5">
              <button onClick={() => playCachedTTS(cleanedContent)} className="flex items-center space-x-1.5 hover:text-blue-500"><ReadAloudIcon /></button>
              <button onClick={handleTranslate} className="flex items-center space-x-1.5 hover:text-green-500"><TranslateIcon /></button>
              <button onClick={() => handleInteraction('like', post.id, 'post')} className={`flex items-center space-x-1.5 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} /><span>{post.likesCount || 0}</span></button>
              <button onClick={() => handleInteraction('dislike', post.id, 'post')} className={`flex items-center space-x-1.5 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} /><span>{post.dislikesCount || 0}</span></button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
          <div className="space-y-4">
            {(showAllMainComments ? commentTree : commentTree.slice(0, 3)).map(comment => (
                <CommentThread key={comment.id} comment={comment} allComments={comments} onReply={handleReplySubmit} user={user} 
                onLike={(id) => handleInteraction('like', id, 'comment')} onDislike={(id) => handleInteraction('dislike', id, 'comment')} 
                translatedContent={translatedContent.comments[comment.id]} />
            ))}
          </div>
          {commentTree.length > 3 && (
            <button onClick={() => setShowAllMainComments(p => !p)} className="text-blue-500 text-sm mt-4 w-full text-center">
              {showAllMainComments ? '收起部分评论' : '查看全部评论'}
            </button>
          )}
        </div>
      </div>
      
      <div className="fixed bottom-0 left-0 right-0 bg-gray-100 dark:bg-gray-900 border-t dark:border-gray-200 dark:border-gray-700 z-10">
        <div className="container mx-auto max-w-3xl p-3">
            <form onSubmit={handleCommentSubmit} className="flex items-center space-x-3">
                <div className="flex-grow bg-white dark:bg-gray-800 rounded-2xl flex items-center px-3 shadow-sm">
                   <input type="text" value={commentContent} onChange={e => setCommentContent(e.target.value)}
                     placeholder={user ? "善语结善缘..." : "请登录后评论"}
                     className="w-full h-12 bg-transparent focus:outline-none text-gray-900 dark:text-white"
                     disabled={!user} />
                   <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><EmojiIcon className="w-6 h-6"/></button>
                   <button type="button" className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><AtIcon className="w-6 h-6"/></button>
                </div>
                <button type="submit" disabled={!user || !commentContent.trim()} className="px-5 h-12 bg-blue-500 text-white rounded-2xl font-semibold disabled:bg-gray-400 disabled:cursor-not-allowed shadow-sm">发送</button>
            </form>
        </div>
      </div>

      {showShareMenu && <SharePanel url={window.location.href} title={post.title} onClose={() => setShowShareMenu(false)} />}
      <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
      {showTranslateSettings && <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />}
    </>
  );
};
export default PostDetailPage;

const CommentThread = ({ comment, allComments, level = 0, ...props }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [visibleReplies, setVisibleReplies] = useState(3);
    const { user, onLike, onDislike, onReply, translatedContent } = props;
    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);
    const parentComment = comment.parentId ? allComments.find(c => c.id === comment.parentId) : null;
    const handleReplyFormSubmit = (e) => { e.preventDefault(); onReply(replyContent, comment.id); setReplyContent(''); setShowReplyInput(false); }
    const showMoreReplies = () => setVisibleReplies(prev => prev + 6);

    return (
        <div className={`flex space-x-3 ${level > 0 ? 'pl-4' : ''}`}>
            <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className={`${level > 0 ? 'w-8 h-8' : 'w-10 h-10'} rounded-full shrink-0 mt-1`} />
            <div className="flex-1">
                <div className={level > 0 ? 'bg-gray-100 dark:bg-gray-700 rounded-lg p-3' : ''}>
                    <div className="text-sm">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{comment.authorName}</span>
                        {parentComment && (
                           <span className="text-gray-500 dark:text-gray-400 mx-1.5">
                               ▷ <span className="font-semibold text-gray-700 dark:text-gray-300">{parentComment.authorName}</span>
                           </span>
                        )}
                    </div>
                    <p className="text-gray-800 dark:text-gray-200 my-1">{translatedContent || comment.content}</p>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1.5 pl-2">
                    <span>{new Date(comment.createdAt?.toDate()).toLocaleTimeString()}</span>
                    <button onClick={() => onLike(comment.id)} className={`flex items-center gap-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4"/><span>{comment.likesCount || 0}</span></button>
                    <button onClick={() => onDislike(comment.id)} className={`flex items-center gap-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4"/><span>{comment.dislikesCount || 0}</span></button>
                    <button onClick={() => setShowReplyInput(p => !p)} className="hover:underline font-semibold">回复</button>
                </div>
                {showReplyInput && (
                    <form onSubmit={handleReplyFormSubmit} className="mt-2 flex space-x-2">
                        <input type="text" value={replyContent} onChange={(e) => setReplyContent(e.target.value)} placeholder={`回复 @${comment.authorName}`} className="flex-grow border rounded-md p-2 text-sm bg-gray-50 dark:bg-gray-600 dark:border-gray-500" />
                        <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start">发送</button>
                    </form>
                )}
                <div className="mt-3 space-y-3">
                    {comment.children?.slice(0, visibleReplies).map(child => (
                        <CommentThread key={child.id} comment={child} allComments={allComments} level={level + 1} {...props} />
                    ))}
                    {comment.children?.length > visibleReplies && (
                        <button onClick={showMoreReplies} className="text-xs text-blue-500 hover:underline font-semibold">
                            继续展开 {comment.children.length - visibleReplies} 条回复
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

const SharePanel = ({ url, title, onClose }) => {
    const sharePlatforms = [ /* ... content from before ... */ ];
    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
            <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-4 w-72">
                 <p className="text-sm font-semibold text-center mb-4">分享到</p>
                 <div className="grid grid-cols-4 gap-4">
                    {sharePlatforms.map(p => (
                        <a key={p.name} href={p.link} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded-md">
                            <img src={p.icon} alt={p.name} className="w-10 h-10 mb-1"/>
                            <span>{p.name}</span>
                        </a>
                    ))}
                 </div>
            </div>
        </div>
    );
};
const TranslateSettingsModal = ({ onClose }) => {
    const [settings, setSettings] = useState({ apiUrl: '', model: '', apiKey: '', sourceLang: 'auto', targetLang: 'Chinese' });
    useEffect(() => { const saved = localStorage.getItem('translateSettings'); if (saved) setSettings(JSON.parse(saved)); }, []);
    const handleSave = () => { localStorage.setItem('translateSettings', JSON.stringify(settings)); onClose(); };
    const handleChange = (e) => { const { name, value } = e.target; setSettings(prev => ({...prev, [name]: value})); };
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold mb-4">翻译设置 (OpenAI 兼容接口)</h3>
                <div className="space-y-4">
                    {/* ... form fields from before ... */}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">取消</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-500 text-white rounded-md">保存</button>
                </div>
            </div>
        </div>
    );
};

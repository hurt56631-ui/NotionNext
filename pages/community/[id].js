// pages/community/[id].js (UI/UX 最终优化版)

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
    doc, getDoc, collection, query, where, orderBy, onSnapshot,
    addDoc, updateDoc, deleteDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// --- Icon Components (Heroicons Style) ---
const ReadAloudIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.879 15.121A5.002 5.002 0 014 12a5 5 0 011.879-3.879m12.242 0A9 9 0 0021 12a9 9 0 00-2.879 6.121" /></svg>;
const LikeIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333V17a1 1 0 001 1h6.758a1 1 0 00.97-1.226l-1.25-4.375a1 1 0 01.97-1.226H17a1 1 0 001-1v-2a1 1 0 00-1-1h-2.25a1 1 0 00-1-1h-1.25a1 1 0 00-1 1H6z" /></svg>;
const DislikeIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={filled ? 0 : 1.5}><path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667V3a1 1 0 00-1-1H6.242a1 1 0 00-.97 1.226l1.25 4.375a1 1 0 01-.97 1.226H3a1 1 0 00-1 1v2a1 1 0 001 1h2.25a1 1 0 001 1h1.25a1 1 0 001-1H14z" /></svg>;
const FavoriteIcon = ({ filled, className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill={filled ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518 4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>;
const ShareIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.186 2.25 2.25 0 00-3.933 2.186z" /></svg>;
const TranslateIcon = ({ className = "w-5 h-5" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.625M21 21l-5.25-11.625M3.75 5.25h16.5M4.5 12h15M5.25 18h13.5" /></svg>;
const MoreOptionsIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>;
const EmojiIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
const AtIcon = ({ className = "w-6 h-6" }) => <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" /></svg>;

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

// ... (ttsCache, playCachedTTS, parseVideoUrl, removeUrlFromText functions remain the same) ...

const PostDetailPage = () => {
    const router = useRouter();
    const { id } = router.query;
    const { user, loading: authLoading } = useAuth();

    const [post, setPost] = useState(null);
    const [comments, setComments] = useState([]);
    // ... (other states remain the same)
    const [showTranslateSettings, setShowTranslateSettings] = useState(false); // State for translation settings modal

    // ... (useMemo and useEffect hooks for fetching data remain the same) ...
    // ... (handleCommentSubmit, handleReplySubmit, etc. functions remain the same) ...

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
    
    // ... (handleCommentSubmit, handleReplySubmit, handleInteraction, toggleFavorite, deletePost functions remain the same) ...

    if (authLoading || loading) return <div className="flex justify-center items-center h-screen"><p>加载中...</p></div>;
    if (error || !post) return <div className="flex justify-center items-center h-screen"><p>{error}</p></div>;
    
    const hasLiked = user && post?.likers?.includes(user.uid);
    const hasDisliked = user && post?.dislikers?.includes(user.uid);

    return (
        <>
            <div className="container mx-auto max-w-3xl py-6 px-4 sm:px-0 pb-28">
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8 relative">
                    {/* ... (Post header and content JSX remains the same) ... */}
                    <div className="flex items-center justify-end text-gray-500 dark:text-gray-400 mt-6 border-t dark:border-gray-700 pt-4 space-x-5">
                        <button onClick={() => playCachedTTS(cleanedContent)} className="flex items-center space-x-1.5 hover:text-blue-500"><ReadAloudIcon /></button>
                        {/* MODIFIED: Clicking translate icon now opens settings */}
                        <button onClick={() => setShowTranslateSettings(true)} className="flex items-center space-x-1.5 hover:text-green-500"><TranslateIcon /></button>
                        <button onClick={() => handleInteraction('like', post.id, 'post')} className={`flex items-center space-x-1.5 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} /><span>{post.likesCount || 0}</span></button>
                        <button onClick={() => handleInteraction('dislike', post.id, 'post')} className={`flex items-center space-x-1.5 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} /><span>{post.dislikesCount || 0}</span></button>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
                    <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
                    <div className="space-y-6"> {/* Increased vertical space between comments */}
                        {(showAllMainComments ? commentTree : commentTree.slice(0, 3)).map(comment => (
                            <CommentThread
                                key={comment.id}
                                comment={comment}
                                allComments={comments}
                                onReply={handleReplySubmit}
                                user={user}
                                onLike={(id) => handleInteraction('like', id, 'comment')}
                                onDislike={(id) => handleInteraction('dislike', id, 'comment')}
                                translatedContent={translatedContent.comments[comment.id]}
                            />
                        ))}
                    </div>
                    {/* ... (Show all comments button remains the same) ... */}
                </div>
            </div>

            {/* ... (Bottom Comment Input Bar and other Modals remain the same) ... */}
             <AuthModal show={showLoginModal} onClose={() => setShowLoginModal(false)} />
             {showTranslateSettings && <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />}
        </>
    );
};
export default PostDetailPage;

// =========================================================================================
// =============================  MODIFIED COMMENT COMPONENT  ==============================
// =========================================================================================
const CommentThread = ({ comment, allComments, onReply, user, onLike, onDislike, translatedContent, isSubComment = false }) => {
    const [showReplyInput, setShowReplyInput] = useState(false);
    const [replyContent, setReplyContent] = useState('');
    const [visibleReplies, setVisibleReplies] = useState(3);
    
    const hasLiked = user && comment.likers?.includes(user.uid);
    const hasDisliked = user && comment.dislikers?.includes(user.uid);
    // Find parent comment only if it's a sub-comment to show who is being replied to
    const parentComment = isSubComment && comment.parentId ? allComments.find(c => c.id === comment.parentId) : null;
    
    const handleReplyFormSubmit = (e) => {
        e.preventDefault();
        onReply(replyContent, comment.id);
        setReplyContent('');
        setShowReplyInput(false);
    };
    
    const showMoreReplies = () => setVisibleReplies(prev => prev + 6);

    return (
        // If it's a sub-comment, add a slight left padding. This is the only "indentation".
        <div className={isSubComment ? 'pl-4' : ''}>
            <div className="flex space-x-3">
                {/* Avatar: Sub-comment avatar is slightly smaller */}
                <img src={comment.authorAvatar || '/img/avatar.svg'} alt={comment.authorName} className={`${isSubComment ? 'w-8 h-8' : 'w-10 h-10'} rounded-full shrink-0 mt-1`} />
                
                <div className="flex-1">
                    {/* Removed background color div. Content is on transparent background now. */}
                    <div> 
                        {/* Username and reply target info */}
                        <div className="flex items-center text-sm flex-wrap">
                            <span className="font-semibold text-gray-800 dark:text-gray-200 mr-1.5">{comment.authorName}</span>
                            {/* If replying to another comment, show the target user with a small arrow */}
                            {parentComment && (
                               <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                   <span className="text-xs scale-75 mr-1">▷</span> 
                                   <span className="font-semibold text-gray-700 dark:text-gray-300">{parentComment.authorName}</span>
                               </span>
                            )}
                        </div>
                        {/* Comment content with larger, unified font size */}
                        <p className="text-base text-gray-800 dark:text-gray-200 my-1.5">{translatedContent || comment.content}</p>
                    </div>

                    {/* Action buttons (Like, Dislike, Reply) */}
                    <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                        <span>{new Date(comment.createdAt?.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <button onClick={() => onLike(comment.id)} className={`flex items-center gap-1 ${hasLiked ? 'text-red-500' : 'hover:text-red-500'}`}><LikeIcon filled={hasLiked} className="w-4 h-4" /><span>{comment.likesCount || 0}</span></button>
                        <button onClick={() => onDislike(comment.id)} className={`flex items-center gap-1 ${hasDisliked ? 'text-blue-500' : 'hover:text-blue-500'}`}><DislikeIcon filled={hasDisliked} className="w-4 h-4" /><span>{comment.dislikesCount || 0}</span></button>
                        <button onClick={() => setShowReplyInput(p => !p)} className="hover:underline font-semibold">回复</button>
                    </div>

                    {/* Reply input form */}
                    {showReplyInput && (
                        <form onSubmit={handleReplyFormSubmit} className="mt-2 flex space-x-2">
                            <input
                                type="text"
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                placeholder={`回复 @${comment.authorName}`}
                                className="flex-grow border rounded-md p-2 text-sm bg-gray-50 dark:bg-gray-700 dark:border-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                autoFocus
                            />
                            <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded-md self-start">发送</button>
                        </form>
                    )}
                    
                    {/* Child comments (Replies) are recursively rendered */}
                    <div className="mt-4 space-y-4">
                        {comment.children?.slice(0, visibleReplies).map(child => (
                            <CommentThread
                                key={child.id}
                                comment={child}
                                allComments={allComments}
                                onReply={onReply}
                                user={user}
                                onLike={onLike}
                                onDislike={onDislike}
                                translatedContent={translatedContent}
                                isSubComment={true} // Pass prop to indicate it's a reply
                            />
                        ))}
                        {comment.children?.length > visibleReplies && (
                            <button onClick={showMoreReplies} className="text-xs text-blue-500 hover:underline font-semibold">
                                继续展开 {comment.children.length - visibleReplies} 条回复
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (SharePanel and TranslateSettingsModal components remain the same) ...

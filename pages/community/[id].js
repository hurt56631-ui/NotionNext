// pages/community/[id].js (UI/UX 最终优化版)

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import {
    doc, getDoc, collection, query, orderBy, onSnapshot,
    updateDoc, increment, serverTimestamp, setDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic';

// ----------------- 图标 -----------------
const LikeIcon = ({ filled, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className}
    viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M14 9V5a3 3 0 00-6 0v4H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-9a2 2 0 00-2-2h-5z" />
  </svg>
);
const DislikeIcon = ({ filled, className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className}
    viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}
    stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M10 15v4a3 3 0 006 0v-4h3a2 2 0 002-2V4a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h5z" />
  </svg>
);
const TranslateIcon = ({ className = "w-5 h-5" }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className}
    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M4 5h16M9 3v2m6-2v2M4 12h16M4 19h16M9 17v2m6-2v2" />
  </svg>
);

const VideoEmbed = dynamic(() => import('@/components/VideoEmbed'), { ssr: false });
const AuthModal = dynamic(() => import('@/components/AuthModal'), { ssr: false });
const PostContent = dynamic(() => import('@/components/PostContent'), { ssr: false });

const PostDetailPage = () => {
  const router = useRouter();
  const { id } = router.query;
  const { user } = useAuth();

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [showTranslateSettings, setShowTranslateSettings] = useState(false);

  // ----------------- 获取帖子 -----------------
  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, "posts", id), (docSnap) => {
      if (docSnap.exists()) setPost({ id: docSnap.id, ...docSnap.data() });
    });
    return () => unsub();
  }, [id]);

  // ----------------- 获取评论 -----------------
  useEffect(() => {
    if (!id) return;
    const q = query(
      collection(db, "posts", id, "comments"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setComments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [id]);

  // ----------------- 浏览量（IP 只算一次） -----------------
  useEffect(() => {
    if (!id) return;
    const ip = localStorage.getItem("user_ip");
    if (!ip) {
      fetch("https://api.ipify.org?format=json")
        .then(res => res.json())
        .then(async data => {
          localStorage.setItem("user_ip", data.ip);
          await updateDoc(doc(db, "posts", id), { views: increment(1) });
        });
    }
  }, [id]);

  // ----------------- 构建评论树 -----------------
  const commentTree = useMemo(() => {
    const map = {};
    comments.forEach(c => { map[c.id] = { ...c, children: [] }; });
    const roots = [];
    comments.forEach(c => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });
    return roots;
  }, [comments]);

  if (!post) return <div className="p-6">加载中...</div>;

  return (
    <>
      <div className="container mx-auto max-w-3xl py-6 px-4">
        {/* 帖子内容 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 mb-8">
          <h1 className="text-2xl font-bold mb-4">{post.title}</h1>
          <PostContent content={post.content} />
          <div className="flex items-center justify-between mt-6 text-sm text-gray-500">
            <span>浏览量：{post.views || 0}</span>
            <button
              onClick={() => setShowTranslateSettings(true)}
              className="flex items-center gap-1 hover:text-green-500"
            >
              <TranslateIcon /> 翻译设置
            </button>
          </div>
        </div>

        {/* 评论区 */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6">
          <h2 className="text-xl font-bold mb-4">评论 ({comments.length})</h2>
          <div className="space-y-6">
            {commentTree.map(c => (
              <CommentThread key={c.id} comment={c} allComments={comments} user={user} />
            ))}
          </div>
        </div>
      </div>

      {/* 翻译设置 */}
      {showTranslateSettings && (
        <TranslateSettingsModal onClose={() => setShowTranslateSettings(false)} />
      )}
    </>
  );
};
export default PostDetailPage;

// ----------------- 评论组件 -----------------
const CommentThread = ({ comment, allComments, user, isSubComment = false }) => {
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const parentComment = isSubComment ? allComments.find(c => c.id === comment.parentId) : null;

  return (
    <div className={isSubComment ? "pl-4" : ""}>
      <div className="flex space-x-3">
        <img src={comment.authorAvatar || "/img/avatar.svg"}
          alt={comment.authorName}
          className={`${isSubComment ? "w-8 h-8" : "w-10 h-10"} rounded-full`} />

        <div className="flex-1">
          <div>
            <div className="flex items-center text-sm flex-wrap">
              <span className="font-semibold mr-1">{comment.authorName}</span>
              {parentComment && (
                <span className="text-gray-500 flex items-center">
                  <span className="text-xs mr-1">▷</span>
                  <span className="font-semibold">{parentComment.authorName}</span>
                </span>
              )}
            </div>
            <p className="text-base mt-1">{comment.content}</p>
          </div>
        </div>
      </div>

      {/* 子评论 */}
      {comment.children?.length > 0 && (
        <div className="mt-4 space-y-4">
          {comment.children.map(c => (
            <CommentThread key={c.id} comment={c} allComments={allComments} user={user} isSubComment />
          ))}
        </div>
      )}
    </div>
  );
};

// ----------------- 翻译设置模态框 -----------------
const TranslateSettingsModal = ({ onClose }) => {
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [language, setLanguage] = useState("zh");

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-96">
        <h3 className="text-lg font-bold mb-4">翻译设置</h3>
        <label className="block mb-2">
          接口地址：
          <input value={apiUrl} onChange={e => setApiUrl(e.target.value)}
            className="w-full p-2 border rounded mt-1" />
        </label>
        <label className="block mb-2">
          API Key：
          <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
            className="w-full p-2 border rounded mt-1" />
        </label>
        <label className="block mb-2">
          模型：
          <input value={model} onChange={e => setModel(e.target.value)}
            className="w-full p-2 border rounded mt-1" />
        </label>
        <label className="block mb-4">
          翻译语言：
          <select value={language} onChange={e => setLanguage(e.target.value)}
            className="w-full p-2 border rounded mt-1">
            <option value="zh">中文</option>
            <option value="en">英文</option>
            <option value="my">缅甸语</option>
          </select>
        </label>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1 bg-gray-300 rounded">取消</button>
          <button className="px-3 py-1 bg-blue-500 text-white rounded">保存</button>
        </div>
      </div>
    </div>
  );
};

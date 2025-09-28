// pages/me.js (带有完整调试日志的最终版本)

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, getPostsByUser, getFavoritesByUser, getViewHistoryByUser, getPostsByIds } from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- PostList 和 timeAgo 函数保持不变 ---
const timeAgo = (maybeDate) => {
  if (!maybeDate) return '';
  let date;
  if (maybeDate.toDate && typeof maybeDate.toDate === 'function') { date = maybeDate.toDate(); }
  else if (typeof maybeDate === 'string') { date = new Date(maybeDate); }
  else if (maybeDate instanceof Date) { date = maybeDate; }
  else { try { date = new Date(maybeDate); } catch { return ''; } }
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const intervals = [{ label: '年', seconds: 31536000 }, { label: '月', seconds: 2592000 }, { label: '天', seconds: 86400 }, { label: '小时', seconds: 3600 }, { label: '分钟', seconds: 60 }];
  for (const it of intervals) { const val = Math.floor(seconds / it.seconds); if (val > 0) return `${val}${it.label}前`; }
  return '刚刚';
};
const PostList = ({ posts, type, author }) => {
  const router = useRouter();
  const emptyMessages = { posts: '你还没有发布任何帖子...', favorites: '你还没有收藏任何帖子。', footprints: '你还没有留下任何足迹。' };
  if (!posts || posts.length === 0) { return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{emptyMessages[type]}</p>; }
  return ( <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">{posts.map(post => ( <article key={post.id} role="button" tabIndex={0} onClick={() => router.push(`/forum/post/${post.id}`)} onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/forum/post/${post.id}`); }} className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-3 flex flex-col h-full cursor-pointer"><div className="flex items-center gap-3 mb-2"><img src={author?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={author?.displayName} className="w-10 h-10 rounded-full object-cover" /><div className="flex-1 min-w-0"><div className="flex items-center justify-between"><h3 className="font-semibold text-sm truncate">{author?.displayName}</h3><time className="text-xs text-gray-400">{timeAgo(post.createdAt)}</time></div><p className="text-xs text-gray-500 truncate">{post.category || ''}</p></div></div><h4 className="font-bold text-md text-gray-900 dark:text-white mb-2 line-clamp-2">{post.title}</h4>{post.imageUrl && ( <div className="mb-2"><img src={post.imageUrl} alt={post.title} className="w-full h-40 object-cover rounded" /></div> )}<div className="mt-auto pt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400"><div className="flex gap-3 items-center"><span className="flex items-center"><i className="far fa-thumbs-up mr-1" />{post.likesCount || 0}</span><span className="flex items-center"><i className="far fa-comment mr-1" />{post.commentsCount || 0}</span></div></div></article> ))}</div> );
};
// --- 以上部分无需关注 ---


// --- 主页面组件 ---
const MyProfilePage = () => {
  const router = useRouter();
  const { user: currentUser, logout, loading: authLoading } = useAuth();
  
  const [profileUser, setProfileUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  
  // ============================================================================
  // == 调试步骤 1: 验证 useAuth 的状态
  // ============================================================================
  console.log('【调试日志 1】组件渲染。Auth状态:', { authLoading, currentUser });


  // 核心逻辑1: 认证保护
  useEffect(() => {
    console.log('【调试日志 2】认证检查 useEffect 触发。Auth状态:', { authLoading, currentUser });
    if (!authLoading && !currentUser) {
      console.log('【调试日志 2.1】检测到用户未登录，正在跳转到首页...');
      router.push('/');
    }
  }, [currentUser, authLoading, router]);

  // 获取并设置当前用户的个人资料
  const fetchUserProfile = async () => {
    console.log(`【调试日志 4】fetchUserProfile 函数开始执行，用户UID: ${currentUser?.uid}`);
    if (!currentUser?.uid) {
        console.error("【调试日志 4.1】严重错误：currentUser 存在但 UID 为空，无法获取资料！");
        setPageLoading(false); // 必须设置，否则会永远加载
        return;
    }

    setPageLoading(true); // 每次获取前都确保是加载状态
    try {
      console.log("【调试日志 4.2】即将调用 getUserProfile API...");
      const profileData = await getUserProfile(currentUser.uid);
      console.log("【调试日志 4.3】getUserProfile API 返回数据:", profileData);

      if (profileData) {
        setProfileUser(profileData);
        console.log("【调试日志 4.4】成功设置 profileUser state。");
      } else {
        console.warn("【调试日志 4.4】警告: getUserProfile 返回了 null 或 undefined，可能 Firestore 中没有此用户的文档。");
      }
    } catch (error) {
      console.error("【调试日志 4.5】在 fetchUserProfile 中捕获到严重错误:", error);
    } finally {
      console.log("【调试日志 4.6】fetchUserProfile 的 finally 块执行，即将设置 pageLoading 为 false。");
      setPageLoading(false);
    }
  };
  
  // 核心逻辑2: 获取用户资料
  useEffect(() => {
    console.log('【调试日志 3】获取用户资料的 useEffect 触发。currentUser:', currentUser);
    if (currentUser) {
      fetchUserProfile();
    } else {
      console.log('【调试日志 3.1】currentUser 为空，本次不调用 fetchUserProfile。');
    }
  }, [currentUser]);


  // 加载状态处理
  if (authLoading || pageLoading) {
    // 我们故意分开日志，看是哪个 loading 导致的
    if(authLoading) console.log("【渲染判断】卡在加载中，原因是: authLoading 为 true");
    if(pageLoading) console.log("【渲染判断】卡在加载中，原因是: pageLoading 为 true");
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }
  
  // 用户不存在或资料获取失败
  if (!currentUser || !profileUser) {
    console.error("【渲染判断】渲染失败！currentUser 或 profileUser 为空。", { currentUser, profileUser });
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载您的信息，请尝试重新登录。</div></LayoutBase>;
  }

  // ============================================================================
  // == 如果能看到这里，说明基础数据加载成功，可以渲染页面了
  // ============================================================================
  console.log("【渲染判断】成功通过所有加载检查，即将渲染页面！");

  // --- 以下是页面渲染逻辑，保持不变 ---
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');
  const [sortBy, setSortBy] = useState('latest');
  
  useEffect(() => {
    // ... 此处的 useEffect 用于加载帖子等内容，暂时不重要
  }, [activeTab, currentUser, profileUser]);

  const handleOpenFollowModal = (type) => { setModalType(type); setShowFollowModal(true); };
  const handleProfileUpdate = () => fetchUserProfile();
  const handleLogout = async () => { if (confirm('确定退出登录吗？')) { try { await logout(); router.push('/'); } catch (err) { console.error('退出登录失败', err); alert('退出失败'); } } };
  const sortedContent = useMemo(() => { if (sortBy === 'hot' && tabContent) { return [...tabContent].sort((a, b) => ((b.likesCount || 0) * 2 + (b.commentsCount || 0)) - ((a.likesCount || 0) * 2 + (a.commentsCount || 0))); } return tabContent; }, [sortBy, tabContent]);

  return (
    <LayoutBase>
      {/* 您的完整 JSX 页面结构... */}
      <div className="flex flex-col min-h-screen">
        <header className="relative w-full bg-cover bg-center text-white p-4 flex flex-col justify-end" style={{ backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent), url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})`, minHeight: '30vh' }}>
          <div className="relative z-10 container mx-auto">
            <div className="flex items-start gap-4">
              <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-20 h-20 rounded-full border-2 border-white/80 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">{profileUser.displayName || '未命名用户'}</h1>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setIsEditing(true)} className="px-3 py-1 rounded-full bg-white/20 text-white text-sm hover:bg-white/30 transition-colors">编辑资料</button>
                    <button onClick={handleLogout} className="px-3 py-1 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 transition-colors">退出登录</button>
                  </div>
                </div>
                <p className="text-sm mt-1 text-white/90 truncate">{profileUser.bio || '编辑资料，分享你的故事...'}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-white/90 flex-wrap">
                  {profileUser.nationality && <div className="px-2 py-1 bg-white/10 rounded">{profileUser.nationality}</div>}
                  {profileUser.city && <div className="px-2 py-1 bg-white/10 rounded">{profileUser.city}</div>}
                  {profileUser.tags && profileUser.tags.slice(0, 5).map((t, i) => <div key={i} className="px-2 py-1 bg-white/10 rounded">{t}</div>)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-6">
                <button onClick={() => handleOpenFollowModal('following')} className="text-center"><div className="font-bold text-lg text-white">{profileUser.followingCount || 0}</div><div className="text-xs text-white/80">关注</div></button>
                <button onClick={() => handleOpenFollowModal('followers')} className="text-center"><div className="font-bold text-lg text-white">{profileUser.followersCount || 0}</div><div className="text-xs text-white/80">粉丝</div></button>
              </div>
            </div>
          </div>
        </header>
        <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
          <div className="container mx-auto flex">
            <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>帖子 ({profileUser.postsCount || 0})</button>
            <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>收藏</button>
            <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>足迹</button>
          </div>
        </nav>
        <main className="container mx-auto p-4 flex-grow bg-gray-50 dark:bg-gray-900">
          {activeTab === 'posts' && ( <div className="flex items-center gap-2 mb-4"><button onClick={() => setSortBy('latest')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'latest' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>最新</button><button onClick={() => setSortBy('hot')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'hot' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>热门</button></div> )}
          <PostList posts={sortedContent} type={activeTab} author={profileUser} />
        </main>
      </div>
      {isEditing && ( <EditProfileModal onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} /> )}
      {showFollowModal && ( <FollowListModal userId={currentUser.uid} type={modalType} onClose={() => setShowFollowModal(false)} /> )}
    </LayoutBase>
  );
};

export default MyProfilePage;

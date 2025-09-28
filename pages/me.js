// pages/me.js (已修复编译错误和优化)

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, getPostsByUser, getFavoritesByUser, getViewHistoryByUser, getPostsByIds } from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- 时间格式化工具函数 ---
const timeAgo = (maybeDate) => {
  if (!maybeDate) return '';
  let date;
  if (maybeDate && typeof maybeDate.toDate === 'function') {
    // Firestore Timestamp
    try { date = maybeDate.toDate(); } catch { return ''; }
  } else if (typeof maybeDate === 'string') {
    date = new Date(maybeDate);
  } else if (maybeDate instanceof Date) {
    date = maybeDate;
  } else {
    try {
      date = new Date(maybeDate);
    } catch {
      return '';
    }
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);
  const intervals = [
    { label: '年', seconds: 31536000 },
    { label: '月', seconds: 2592000 },
    { label: '天', seconds: 86400 },
    { label: '小时', seconds: 3600 },
    { label: '分钟', seconds: 60 }
  ];
  for (const it of intervals) {
    const val = Math.floor(seconds / it.seconds);
    if (val > 0) return `${val}${it.label}前`;
  }
  return '刚刚';
};

// --- PostList 组件 ---
const PostList = ({ posts, type, author }) => {
  const router = useRouter();
  const emptyMessages = {
    posts: '你还没有发布任何帖子，快去社区分享吧！',
    favorites: '你还没有收藏任何帖子。',
    footprints: '你还没有留下任何足迹。'
  };

  if (!posts || posts.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 mt-8">{emptyMessages[type]}</p>;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {posts.map(post => (
        <article
          key={post.id}
          role="button"
          tabIndex={0}
          // 【修复】JSX 中的注释问题
          onClick={() => router.push(`/community/${post.id}`)} 
          onKeyDown={(e) => { 
            if (e.key === 'Enter') router.push(`/community/${post.id}`); 
          }} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-3 flex flex-col h-full cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-2">
            {/* 【注意】这里的 author 头像和名字，通常应该用 post.authorAvatar 和 post.authorName
                       但因为你传入的是外部的 `author` 对象，我暂时保留 `author?.photoURL`
                       如果你希望显示帖子本身的作者信息，需要 PostList 接收的 post 对象包含这些字段
            */}
            <img src={author?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={author?.displayName} className="w-10 h-10 rounded-full object-cover" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm truncate">{author?.displayName}</h3>
                <time className="text-xs text-gray-400">{timeAgo(post.createdAt)}</time>
              </div>
              <p className="text-xs text-gray-500 truncate">{post.category || ''}</p>
            </div>
          </div>
          <h4 className="font-bold text-md text-gray-900 dark:text-white mb-2 line-clamp-2">{post.title}</h4>
          {post.imageUrl && (
            <div className="mb-2">
              <img src={post.imageUrl} alt={post.title} className="w-full h-40 object-cover rounded" />
            </div>
          )}
          <div className="mt-auto pt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <div className="flex gap-3 items-center">
              <span className="flex items-center"><i className="far fa-thumbs-up mr-1" />{post.likesCount || 0}</span>
              <span className="flex items-center"><i className="far fa-comment mr-1" />{post.commentsCount || 0}</span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
};

// --- 主页面组件 ---
const MyProfilePage = () => {
  const router = useRouter();
  const { user: currentUser, logout, loading: authLoading } = useAuth();
  
  const [profileUser, setProfileUser] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');
  const [sortBy, setSortBy] = useState('latest');

  // 【新增】用于存储随机背景图片URL的状态
  const [randomBgImage, setRandomBgImage] = useState('');

  // 【新增】获取随机背景图片的 useEffect
  useEffect(() => {
    const fetchRandomImage = async () => {
      const cachedImage = localStorage.getItem('profileBgImage');
      const cacheTimestamp = localStorage.getItem('profileBgImageTimestamp');
      const now = new Date().getTime();
      const ONE_DAY = 24 * 60 * 60 * 1000; // 一天

      if (cachedImage && cacheTimestamp && (now - parseInt(cacheTimestamp, 10) < ONE_DAY)) {
        setRandomBgImage(cachedImage);
      } else {
        const imageUrl = `https://source.unsplash.com/random/1600x900/?nature,abstract`; 
        setRandomBgImage(imageUrl);
        localStorage.setItem('profileBgImage', imageUrl);
        localStorage.setItem('profileBgImageTimestamp', now.toString());
      }
    };

    fetchRandomImage();
  }, []); 

  useEffect(() => {
    if (!authLoading && !currentUser) {
      router.push('/');
    }
  }, [currentUser, authLoading, router]);

  const fetchUserProfile = async () => {
    if (!currentUser?.uid) {
      setProfileUser(null);
      setPageLoading(false);
      return;
    }
    setPageLoading(true);
    try {
      const profileData = await getUserProfile(currentUser.uid);
      setProfileUser(profileData || null);
    } catch (error) {
      console.error("在 fetchUserProfile 中捕获到错误:", error);
      setProfileUser(null);
    } finally {
      setPageLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchUserProfile();
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.uid || !profileUser) {
      setTabContent([]);
      return;
    }

    let unsubscribe;
    let mounted = true;

    const fetchAndSetPosts = async (fetcher) => {
      try {
        const ids = await fetcher(currentUser.uid);
        if (!mounted) return;
        if (ids && ids.length > 0) {
          const postsData = await getPostsByIds(ids);
          if (!mounted) return;
          setTabContent(postsData || []);
        } else {
          setTabContent([]);
        }
      } catch (err) {
        console.error('获取 tab 内容失败', err);
        if (mounted) setTabContent([]);
      }
    };

    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(currentUser.uid, setTabContent);
    } else if (activeTab === 'favorites') {
      fetchAndSetPosts(getFavoritesByUser);
    } else if (activeTab === 'footprints') {
      fetchAndSetPosts(getViewHistoryByUser);
    } else {
      setTabContent([]);
    }

    return () => {
      mounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeTab, currentUser, profileUser]);

  const handleOpenFollowModal = (type) => { setModalType(type); setShowFollowModal(true); };
  const handleProfileUpdate = () => fetchUserProfile();
  const handleLogout = async () => {
    if (!confirm('确定退出登录吗？')) return;
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error('退出登录失败', err);
      alert('退出失败，请重试');
    }
  };

  const sortedContent = useMemo(() => {
    if (sortBy === 'hot' && Array.isArray(tabContent)) {
      return [...tabContent].sort((a, b) => ((b.likesCount || 0) * 2 + (b.commentsCount || 0)) - ((a.likesCount || 0) * 2 + (a.commentsCount || 0)));
    }
    return tabContent;
  }, [sortBy, tabContent]);

  if (authLoading || pageLoading) {
    return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  }
  if (!currentUser || !profileUser) {
    return <LayoutBase><div className="p-10 text-center text-red-500">无法加载您的信息，请尝试重新登录。</div></LayoutBase>;
  }

  const backgroundImageUrl = profileUser?.backgroundImageUrl || randomBgImage || '/images/zhuyetu.jpg';

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen">
        <header 
          className="relative w-full bg-cover bg-center text-white p-4 flex flex-col justify-end" 
          style={{ 
            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent), url(${backgroundImageUrl})`, 
            minHeight: '30vh' 
          }}
        >
          <div className="relative z-10 container mx-auto">
            <div className="flex items-start gap-4">
              <img src={profileUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser?.displayName} className="w-20 h-20 rounded-full border-2 border-white/80 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">{String(profileUser?.displayName || '未命名用户')}</h1>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setIsEditing(true)} className="px-3 py-1 rounded-full bg-white/20 text-white text-sm hover:bg-white/30 transition-colors">编辑资料</button>
                    <button onClick={handleLogout} className="px-3 py-1 rounded-full bg-red-500 text-white text-sm hover:bg-red-600 transition-colors">退出登录</button>
                  </div>
                </div>
                <p className="text-sm mt-1 text-white/90 truncate">{String(profileUser?.bio || '编辑资料，分享你的故事...')}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-white/90 flex-wrap">
                  {typeof profileUser?.nationality === 'string' && profileUser.nationality && (
                    <div className="px-2 py-1 bg-white/10 rounded">{profileUser.nationality}</div>
                  )}
                  {typeof profileUser?.city === 'string' && profileUser.city && (
                    <div className="px-2 py-1 bg-white/10 rounded">{profileUser.city}</div>
                  )}
                  {Array.isArray(profileUser?.tags) && profileUser.tags.slice(0, 5).map((tag, i) => (
                    typeof tag === 'string' && <div key={i} className="px-2 py-1 bg-white/10 rounded">{tag}</div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-6">
                <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                  <div className="font-bold text-lg text-white">{Number(profileUser.followingCount) || 0}</div>
                  <div className="text-xs text-white/80">关注</div>
                </button>
                <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                  <div className="font-bold text-lg text-white">{Number(profileUser.followersCount) || 0}</div>
                  <div className="text-xs text-white/80">粉丝</div>
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
          <div className="container mx-auto flex">
            <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>帖子 ({Number(profileUser.postsCount) || 0})</button>
            <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>收藏</button>
            <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>足迹</button>
          </div>
        </nav>

        <main className="container mx-auto p-4 flex-grow bg-gray-50 dark:bg-gray-900">
          {activeTab === 'posts' && (
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setSortBy('latest')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'latest' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>最新</button>
              <button onClick={() => setSortBy('hot')} className={`px-3 py-1 text-sm rounded-full ${sortBy === 'hot' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>热门</button>
            </div>
          )}
          <PostList posts={sortedContent} type={activeTab} author={profileUser} />
        </main>
      </div>

      {isEditing && ( <EditProfileModal onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} /> )}
      {showFollowModal && ( <FollowListModal userId={currentUser.uid} type={modalType} onClose={() => setShowFollowModal(false)} /> )}
    </LayoutBase>
  );
};

export default MyProfilePage;

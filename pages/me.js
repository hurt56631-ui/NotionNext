// pages/me.js (全面升级版：随机背景图、头像上移、设置菜单、动态Tab、年龄性别国籍)

import React, { useState, useEffect, useMemo, useRef } from 'react'; // 【修改】新增 useRef
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
    try { date = maybeDate.toDate(); } catch { return ''; }
  } else if (typeof maybeDate === 'string') {
    date = new Date(maybeDate);
  } else if (maybeDate instanceof Date) {
    date = maybeDate;
  } else {
    try { date = new Date(maybeDate); } catch { return ''; }
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

// --- PostList 组件 (新增了用于动态的类型) ---
const PostList = ({ posts, type, author }) => {
  const router = useRouter();
  const emptyMessages = {
    posts: '你还没有发布任何帖子，快去社区分享吧！',
    dynamics: '你还没有发布任何动态，快去分享你的生活瞬间吧！', // 【新增】动态空状态
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
          onClick={() => router.push(`/community/${post.id}`)} 
          onKeyDown={(e) => { 
            if (e.key === 'Enter') router.push(`/community/${post.id}`); 
          }} 
          className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-3 flex flex-col h-full cursor-pointer"
        >
          <div className="flex items-center gap-3 mb-2">
            {/* 【注意】这里的 author 头像和名字，通常应该用 post.authorAvatar 和 post.authorName
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
  // 【修改】新增 'dynamics' tab
  const [activeTab, setActiveTab] = useState('posts'); 
  const [isEditing, setIsEditing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');
  const [sortBy, setSortBy] = useState('latest');

  const [randomBgImage, setRandomBgImage] = useState('');
  // 【新增】设置菜单的可见性状态
  const [showSettingsMenu, setShowSettingsMenu] = useState(false); 
  const settingsMenuRef = useRef(null); // 用于点击外部关闭菜单

  // 【修复背景图显示问题 & 随机图片获取】
  useEffect(() => {
    const fetchRandomImage = () => {
      const cachedImage = localStorage.getItem('profileBgImage');
      const cacheTimestamp = localStorage.getItem('profileBgImageTimestamp');
      const now = new Date().getTime();
      const ONE_DAY = 24 * 60 * 60 * 1000; 

      if (cachedImage && cacheTimestamp && (now - parseInt(cacheTimestamp, 10) < ONE_DAY)) {
        setRandomBgImage(cachedImage);
      } else {
        // 使用更具描述性的关键词组合，提高“好看”的几率
        const keywords = ['landscape', 'abstract', 'nature', 'sky', 'minimalist', 'vibrant'];
        const randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
        const imageUrl = `https://source.unsplash.com/random/1600x900/?${randomKeyword}`; 
        
        // 由于 source.unsplash.com 是重定向，无法直接检测图片是否加载成功，
        // 这里只是存储URL。如果需要更严格的错误处理，建议使用 Unsplash API Key。
        setRandomBgImage(imageUrl);
        localStorage.setItem('profileBgImage', imageUrl);
        localStorage.setItem('profileBgImageTimestamp', now.toString());
      }
    };

    fetchRandomImage();
  }, []); 

  // 【新增】点击外部关闭设置菜单
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [settingsMenuRef]);


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

    const fetchAndSetPosts = async (fetcher, collectionType) => { // 【修改】新增 collectionType 参数
      try {
        // 【注意】这里假设 getPostsByUser, getFavoritesByUser, getViewHistoryByUser
        // 都返回一个 Post ID 数组，然后我们用 getPostsByIds 获取详细数据。
        // 如果你的后端函数直接返回完整的帖子数据，则不需要 getPostsByIds。
        let postsData = [];
        if (collectionType === 'dynamics') {
          // 【待实现】这里需要一个新的函数来获取用户的动态作品
          // 例如：postsData = await getDynamicsByUser(currentUser.uid);
          // 为了演示，暂时使用获取普通帖子的逻辑，并过滤类别
          const allPosts = await getPostsByUser(currentUser.uid); // 假设这个会返回一个直接可用的 posts 数组
          postsData = allPosts.filter(p => p.type === 'dynamic'); // 假设动态有 type 字段
          // 如果 getPostsByUser 返回 ID 数组，你需要再用 getPostsByIds
        } else if (collectionType === 'favorites') {
          const ids = await fetcher(currentUser.uid);
          if (ids && ids.length > 0) { postsData = await getPostsByIds(ids); }
        } else if (collectionType === 'footprints') {
          const ids = await fetcher(currentUser.uid);
          if (ids && ids.length > 0) { postsData = await getPostsByIds(ids); }
        } else { // activeTab === 'posts'
          // 对于普通帖子，假设 getPostsByUser 已经返回了完整帖子数据
          postsData = await fetcher(currentUser.uid); 
        }

        if (!mounted) return;
        setTabContent(postsData || []);
        
      } catch (err) {
        console.error('获取 tab 内容失败', err);
        if (mounted) setTabContent([]);
      }
    };

    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(currentUser.uid, setTabContent); // 假设 getPostsByUser 可以实时更新
    } else if (activeTab === 'dynamics') { // 【新增】处理动态Tab
      // 需要一个新的 getDynamicsByUser 函数
      fetchAndSetPosts(getPostsByUser, 'dynamics'); // 暂时用 getPostsByUser，并在内部过滤
    } else if (activeTab === 'favorites') {
      fetchAndSetPosts(getFavoritesByUser, 'favorites');
    } else if (activeTab === 'footprints') {
      fetchAndSetPosts(getViewHistoryByUser, 'footprints');
    } else {
      setTabContent([]);
    }

    return () => {
      mounted = false;
      if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
    };
  }, [activeTab, currentUser, profileUser]);

  const handleOpenFollowModal = (type) => { setModalType(type); setShowFollowModal(true); };
  const handleProfileUpdate = () => {
    fetchUserProfile();
    setIsEditing(false); // 关闭编辑框
    setShowSettingsMenu(false); // 关闭设置菜单
  };
  const handleLogout = async () => {
    if (!confirm('确定退出登录吗？')) return;
    try {
      await logout();
      router.push('/');
    } catch (err) {
      console.error('退出登录失败', err);
      alert('退出失败，请重试');
    } finally {
        setShowSettingsMenu(false); // 关闭设置菜单
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

  // 构建背景图片URL，优先使用用户自定义的，其次是随机获取的
  const backgroundImageUrl = profileUser?.backgroundImageUrl || randomBgImage || '/images/zhuyetu.jpg';

  // 【新增】计算年龄和获取性别图标
  const getAge = (birthday) => {
    if (!birthday) return null;
    try {
        const birthDate = birthday?.toDate ? birthday.toDate() : new Date(birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    } catch (e) {
        return null;
    }
  };
  const age = getAge(profileUser?.birthday);
  const genderIcon = profileUser?.gender === 'male' ? 'fas fa-mars' : 
                     profileUser?.gender === 'female' ? 'fas fa-venus' : '';

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen">
        <header 
          className="relative w-full text-white p-4 flex flex-col justify-end" 
          // 【修复背景图】确保 linear-gradient 不会覆盖图片，且图片始终显示
          style={{ 
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '35vh', // 稍微增加高度
          }}
        >
          {/* 添加一个半透明的蒙层，确保文字可读性，并使渐变效果更佳 */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent"></div>
          
          <div className="relative z-10 container mx-auto">
            {/* 【新增】右上角设置按钮 */}
            <div className="absolute top-4 right-4 z-30" ref={settingsMenuRef}>
              <button 
                onClick={(e) => { e.stopPropagation(); setShowSettingsMenu(!showSettingsMenu); }} 
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white text-lg focus:outline-none"
                aria-label="设置"
              >
                <i className="fas fa-cog"></i>
              </button>
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-md shadow-lg py-1 z-40">
                  <button onClick={() => { setIsEditing(true); setShowSettingsMenu(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700">编辑资料</button>
                  <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700">退出登录</button>
                </div>
              )}
            </div>

            {/* 【布局调整】头像和个人信息区域 */}
            <div className="flex items-start gap-4 mb-4"> {/* 调整 mb-4 增加下方空间 */}
              {/* 头像 */}
              <img src={profileUser?.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser?.displayName} className="w-24 h-24 rounded-full border-3 border-white/80 object-cover" /> {/* 增大头像尺寸 */}
              
              <div className="flex-1 min-w-0 flex flex-col justify-center mt-2"> {/* 【修改】mt-2 稍微下移，与头像顶部对齐 */}
                {/* 昵称 */}
                <h1 className="text-2xl md:text-3xl font-bold truncate">{String(profileUser?.displayName || '未命名用户')}</h1>
                
                {/* 年龄、性别、国籍 */}
                <div className="flex items-center gap-2 mt-1 text-sm text-white/90">
                    {age && <span className="px-2 py-0.5 bg-white/10 rounded-full">{age}岁</span>}
                    {genderIcon && <i className={`${genderIcon} px-2 py-0.5 bg-white/10 rounded-full`} />}
                    {profileUser?.nationality && <span className="px-2 py-0.5 bg-white/10 rounded-full">{profileUser.nationality}</span>}
                </div>
              </div>
            </div>
            
            {/* 个人简介 */}
            <p className="text-sm mt-2 text-white/90 truncate">{String(profileUser?.bio || '编辑资料，分享你的故事...')}</p>
            
            {/* 兴趣爱好标签 (现在有更多空间) */}
            <div className="flex items-center gap-2 mt-3 text-xs text-white/90 flex-wrap">
              {Array.isArray(profileUser?.tags) && profileUser.tags.slice(0, 5).map((tag, i) => (
                typeof tag === 'string' && <div key={i} className="px-2 py-1 bg-white/10 rounded-full">{tag}</div>
              ))}
            </div>

            {/* 关注/粉丝数 */}
            <div className="flex items-center gap-6 mt-4">
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
        </header>

        {/* 导航栏 (新增 '动态' Tab) */}
        <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
          <div className="container mx-auto flex">
            <button onClick={() => setActiveTab('dynamics')} className={`py-3 px-6 font-semibold ${activeTab === 'dynamics' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>动态</button> {/* 【新增】动态Tab */}
            <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>帖子 ({Number(profileUser.postsCount) || 0})</button>
            <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>收藏</button>
            <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>足迹</button>
          </div>
        </nav>

        <main className="container mx-auto p-4 flex-grow bg-gray-50 dark:bg-gray-900">
          {/* 只有在 'posts' 或 'dynamics' tab 时才显示排序按钮 */}
          {(activeTab === 'posts' || activeTab === 'dynamics') && ( 
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

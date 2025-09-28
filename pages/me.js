import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { LayoutBase } from '@/themes/heo';
import { getUserProfile, getPostsByUser, getFavoritesByUser, getViewHistoryByUser, followUser, unfollowUser, checkFollowing, startChat, getPostsByIds, blockUser, unblockUser, reportUser } from '@/lib/user';
import EditProfileModal from '@/components/EditProfileModal';
import FollowListModal from '@/components/FollowListModal';

// --- 时间格式化工具函数（接受 Date | Firestore Timestamp | ISO 字符串） ---
const timeAgo = (maybeDate) => {
  if (!maybeDate) return '';
  let date;
  if (maybeDate.toDate && typeof maybeDate.toDate === 'function') {
    date = maybeDate.toDate();
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

// PostList: 更清爽的卡片样式 & 支持作者覆盖
const PostList = ({ posts, type, author }) => {
  const router = useRouter();
  const emptyMessages = {
    posts: '还没有发布任何帖子。',
    favorites: '还没有收藏任何帖子。',
    footprints: '还没有留下任何足迹。'
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
          onClick={() => router.push(`/forum/post/${post.id}`)} // FIX: Changed /.../ to `...`
          onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/forum/post/${post.id}`); }} // FIX: Changed /.../ to `...`
          className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition p-3 flex flex-col h-full"
        >
          <div className="flex items-center gap-3 mb-2">
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
            <div className="text-xs text-gray-400">#{post.id?.slice?.(0, 6)}</div>
          </div>
        </article>
      ))}
    </div>
  );
};

const ProfilePage = () => {
  const router = useRouter();
  const { userId } = router.query;
  const { user: currentUser, logout } = useAuth();
  const [profileUser, setProfileUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [tabContent, setTabContent] = useState([]);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [showFollowModal, setShowFollowModal] = useState(false);
  const [modalType, setModalType] = useState('following');
  const [sortBy, setSortBy] = useState('latest');
  const [isBlocked, setIsBlocked] = useState(false);
  const [processing, setProcessing] = useState(false);

  const isMyProfile = currentUser && currentUser.uid === userId;

  const fetchUserProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const profileData = await getUserProfile(userId);
      setProfileUser(profileData);

      if (currentUser && currentUser.uid !== userId) {
        const followingStatus = await checkFollowing(currentUser.uid, userId);
        setIsFollowing(followingStatus);
      }

      // 简单检查是否在黑名单（后端返 boolean）
      if (currentUser && currentUser.uid) {
        setIsBlocked(profileData?.blockedBy?.includes?.(currentUser.uid) || false);
      }
    } catch (err) {
      console.error('加载用户资料失败', err);
      setProfileUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) fetchUserProfile();
  }, [userId, currentUser]);

  // 通过不同 tab 加载内容
  useEffect(() => {
    if (!userId || !profileUser) return;

    let unsubscribe;
    const fetchAndSetPosts = async (fetcher) => {
      try {
        const postIds = await fetcher(userId);
        if (postIds && postIds.length > 0) {
          const postsData = await getPostsByIds(postIds);
          setTabContent(postsData || []);
        } else setTabContent([]);
      } catch (err) {
        console.error('获取 tab 内容失败', err);
        setTabContent([]);
      }
    };

    if (activeTab === 'posts') {
      unsubscribe = getPostsByUser(userId, setTabContent);
    } else if (activeTab === 'favorites' && isMyProfile) {
      fetchAndSetPosts(getFavoritesByUser);
    } else if (activeTab === 'footprints' && isMyProfile) {
      fetchAndSetPosts(getViewHistoryByUser);
    } else {
      setTabContent([]);
    }

    return () => unsubscribe && unsubscribe();
  }, [activeTab, userId, isMyProfile, profileUser]);

  const handleFollow = async (e) => {
    e?.stopPropagation?.();
    if (!currentUser || isFollowLoading) return;
    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(currentUser.uid, userId);
        setProfileUser(prev => ({ ...prev, followersCount: Math.max((prev?.followersCount || 1) - 1, 0) }));
      } else {
        await followUser(currentUser.uid, userId);
        setProfileUser(prev => ({ ...prev, followersCount: (prev?.followersCount || 0) + 1 }));
      }
      setIsFollowing(!isFollowing);
    } catch (err) {
      console.error('关注操作失败', err);
      alert('操作失败，请稍后重试');
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleStartChat = (e) => {
    e?.stopPropagation?.();
    if (!currentUser) return router.push('/login');
    startChat(userId);
  };

  const handleOpenFollowModal = (type) => {
    setModalType(type);
    setShowFollowModal(true);
  };

  const handleProfileUpdate = () => fetchUserProfile();

  // 拉黑/取消拉黑
  const toggleBlock = async () => {
    if (!currentUser) return router.push('/login');
    if (!confirm(isBlocked ? '确定取消拉黑该用户？' : '确定拉黑该用户？对方将无法查看或与您互动。')) return;
    setProcessing(true);
    try {
      if (isBlocked) {
        await unblockUser(currentUser.uid, userId);
        setIsBlocked(false);
      } else {
        await blockUser(currentUser.uid, userId);
        setIsBlocked(true);
      }
      alert('操作成功');
    } catch (err) {
      console.error('拉黑操作失败', err);
      alert('操作失败，请稍后重试');
    } finally {
      setProcessing(false);
    }
  };

  // 举报
  const handleReport = async () => {
    if (!currentUser) return router.push('/login');
    const reason = prompt('请简要描述举报理由（违规类型、截图链接或说明）:');
    if (!reason) return;
    setProcessing(true);
    try {
      await reportUser({ reporterId: currentUser.uid, reportedId: userId, reason, createdAt: new Date() });
      alert('举报已提交，我们会尽快处理。');
    } catch (err) {
      console.error('举报失败', err);
      alert('提交失败，请稍后再试');
    } finally {
      setProcessing(false);
    }
  };

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

  // 排序逻辑
  const sortedContent = useMemo(() => {
    if (sortBy === 'hot') {
      return [...tabContent].sort((a, b) => ((b.likesCount || 0) * 2 + (b.commentsCount || 0)) - ((a.likesCount || 0) * 2 + (a.commentsCount || 0)));
    }
    return tabContent;
  }, [sortBy, tabContent]);

  if (loading) return <LayoutBase><div className="p-10 text-center">正在加载用户资料...</div></LayoutBase>;
  if (!profileUser) return <LayoutBase><div className="p-10 text-center text-red-500">无法加载该用户的信息或用户不存在。</div></LayoutBase>;

  return (
    <LayoutBase>
      <div className="flex flex-col min-h-screen">
        <header
          className="relative w-full bg-cover bg-center text-white p-4 flex flex-col justify-end"
          style={{
            backgroundImage: `linear-gradient(to top, rgba(0,0,0,0.6), transparent), url(${profileUser.backgroundImageUrl || '/images/zhuyetu.jpg'})`, // FIX: Wrapped value in `...`
            minHeight: '30vh'
          }}
        >
          <div className="relative z-10 container mx-auto">
            <div className="flex items-start gap-4">
              <img src={profileUser.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={profileUser.displayName} className="w-20 h-20 rounded-full border-2 border-white/80 object-cover" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-4">
                  <h1 className="text-2xl md:text-3xl font-bold truncate">{profileUser.displayName || '未命名用户'}</h1>
                  <div className="ml-auto flex items-center gap-2">
                    {isMyProfile ? (
                      <>
                        <button onClick={() => setIsEditing(true)} className="px-3 py-1 rounded-full bg-white/20 text-white">编辑资料</button>
                        <button onClick={handleLogout} className="px-3 py-1 rounded-full bg-red-500 text-white">退出登录</button>
                      </>
                    ) : (
                      <>
                        <button onClick={handleFollow} disabled={isFollowLoading}
                          className={`px-4 py-1 rounded-full font-semibold transition ${isFollowing ? 'bg-gray-200 text-gray-800' : 'bg-blue-500 text-white'}`}>
                          {isFollowing ? '已关注' : '关注'}
                        </button>
                        <button onClick={handleStartChat} className="px-4 py-1 rounded-full bg-white/20">私信</button>
                      </>
                    )}
                  </div>
                </div>
                <p className="text-sm mt-1 text-white/90 truncate">{profileUser.bio || '这位用户很神秘，什么都没留下...'}</p>
                <div className="flex items-center gap-3 mt-3 text-xs text-white/90">
                  <div className="px-2 py-1 bg-white/10 rounded">{profileUser.nationality}</div>
                  {profileUser.city && <div className="px-2 py-1 bg-white/10 rounded">{profileUser.city}</div>}
                  {profileUser.tags && profileUser.tags.slice(0, 5).map((t, i) => <div key={i} className="px-2 py-1 bg-white/10 rounded">{t}</div>)}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center gap-6">
                <button onClick={() => handleOpenFollowModal('following')} className="text-center">
                  <div className="font-bold text-lg text-white">{profileUser.followingCount || 0}</div>
                  <div className="text-xs text-white/80">关注</div>
                </button>
                <button onClick={() => handleOpenFollowModal('followers')} className="text-center">
                  <div className="font-bold text-lg text-white">{profileUser.followersCount || 0}</div>
                  <div className="text-xs text-white/80">粉丝</div>
                </button>
              </div>
              {!isMyProfile && (
                <div className="flex items-center gap-2">
                  <button onClick={toggleBlock} disabled={processing}
                    className={`px-3 py-1 text-sm rounded-full ${isBlocked ? 'bg-yellow-500 text-white' : 'bg-white/20 text-white'}`}>
                    {isBlocked ? '已拉黑' : '拉黑'}
                  </button>
                  <button onClick={handleReport} disabled={processing} className="px-3 py-1 bg-white/20 rounded-full">举报</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <nav className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
          <div className="container mx-auto flex">
            <button onClick={() => setActiveTab('posts')} className={`py-3 px-6 font-semibold ${activeTab === 'posts' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>帖子 ({profileUser.postsCount || 0})</button>
            {isMyProfile && (
              <>
                <button onClick={() => setActiveTab('favorites')} className={`py-3 px-6 font-semibold ${activeTab === 'favorites' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>收藏</button>
                <button onClick={() => setActiveTab('footprints')} className={`py-3 px-6 font-semibold ${activeTab === 'footprints' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-600 dark:text-gray-400'}`}>足迹</button>
              </>
            )}
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

      {isMyProfile && isEditing && (
        <EditProfileModal onClose={() => setIsEditing(false)} onProfileUpdate={handleProfileUpdate} />
      )}

      {showFollowModal && (
        <FollowListModal userId={userId} type={modalType} onClose={() => setShowFollowModal(false)} />
      )}
    </LayoutBase>
  );
};

export default ProfilePage;

// components/FollowListModal.js

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { getFollowingList, getFollowersList, followUser, unfollowUser } from '@/lib/user'; // 假设您的 API 函数在这里
import Link from 'next/link';

const FollowListModal = ({ userId, type, onClose }) => {
  const { user: currentUser } = useAuth();
  const [userList, setUserList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myFollowingIds, setMyFollowingIds] = useState(new Set());
  const [processingId, setProcessingId] = useState(null); // 用于跟踪哪个按钮正在处理中

  const title = type === 'following' ? '关注列表' : '粉丝列表';

  // 获取主列表 (关注或粉丝) 和 “我”的关注列表
  useEffect(() => {
    const fetchLists = async () => {
      setLoading(true);
      try {
        // 1. 获取要展示的列表
        const mainListFetcher = type === 'following' ? getFollowingList : getFollowersList;
        const mainList = await mainListFetcher(userId);
        setUserList(mainList);

        // 2. 获取当前登录用户的关注列表，用于判断按钮状态
        if (currentUser) {
          const myFollows = await getFollowingList(currentUser.uid);
          setMyFollowingIds(new Set(myFollows.map(user => user.id)));
        }
      } catch (error) {
        console.error(`无法获取${title}:`, error);
        alert(`无法获取${title}，请稍后重试。`);
      } finally {
        setLoading(false);
      }
    };
    
    if (userId) {
        fetchLists();
    }
  }, [userId, type, currentUser]);

  // 处理关注/取关操作
  const handleFollowToggle = async (targetUserId) => {
    if (!currentUser || processingId) return;

    setProcessingId(targetUserId);
    const isCurrentlyFollowing = myFollowingIds.has(targetUserId);

    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.uid, targetUserId);
        // 实时更新UI
        setMyFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(targetUserId);
          return newSet;
        });
      } else {
        await followUser(currentUser.uid, targetUserId);
        // 实时更新UI
        setMyFollowingIds(prev => {
          const newSet = new Set(prev);
          newSet.add(targetUserId);
          return newSet;
        });
      }
    } catch (error) {
      console.error("操作失败:", error);
      alert("操作失败，请稍后重试。");
    } finally {
      setProcessingId(null);
    }
  };


  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-[70vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b dark:border-gray-700 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>
        
        <div className="flex-grow overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center">正在加载列表...</div>
          ) : userList.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              {type === 'following' ? '还没有关注任何人' : '还没有粉丝'}
            </div>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {userList.map(user => (
                <li key={user.id} className="p-4 flex items-center justify-between">
                  <Link href={`/profile/${user.id}`} passHref>
                    <a className="flex items-center gap-4 flex-grow min-w-0" onClick={onClose}>
                      <img src={user.photoURL || 'https://www.gravatar.com/avatar?d=mp'} alt={user.displayName} className="w-12 h-12 rounded-full object-cover"/>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white truncate">{user.displayName}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{user.bio || '...'}</p>
                      </div>
                    </a>
                  </Link>

                  {/* 关注/取关按钮 (如果不是用户自己) */}
                  {currentUser && currentUser.uid !== user.id && (
                    <button
                      onClick={() => handleFollowToggle(user.id)}
                      disabled={processingId === user.id}
                      className={`px-3 py-1 text-sm rounded-full font-semibold transition-colors flex-shrink-0 ml-4 ${
                        myFollowingIds.has(user.id)
                          ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200'
                          : 'bg-blue-500 text-white hover:bg-blue-600'
                      }`}
                    >
                      {processingId === user.id ? '...' : myFollowingIds.has(user.id) ? '已关注' : '关注'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;

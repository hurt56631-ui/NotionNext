// lib/user.js (100% 完整版，已修复关键查询问题)

import { db, storage } from './firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  writeBatch,
  serverTimestamp,
  getDocs,
  limit,
  documentId,
  increment // ✅ 确保 increment 已导入，用于更新计数
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ============================================================================
// == 用户资料管理 (User Profile Management)
// ============================================================================

/**
 * 当用户首次通过社交登录或注册时，为他们创建一份个人资料文档
 * @param {object} user - Firebase Auth 返回的用户对象
 */
export const createUserProfile = async (user) => {
  const userRef = doc(db, 'users', user.uid);
  const docSnap = await getDoc(userRef);

  if (!docSnap.exists()) {
    const { uid, displayName, email, photoURL } = user;
    try {
      await setDoc(userRef, {
        uid,
        displayName: displayName || '新用户',
        email,
        photoURL: photoURL || 'https://www.gravatar.com/avatar?d=mp', // 默认头像
        createdAt: serverTimestamp(),
        // 初始化一些空字段或默认值
        bio: '',
        backgroundImageUrl: '',
        gender: 'not_specified',
        nationality: '',
        city: '',
        tags: [],
        postsCount: 0,
        followersCount: 0,
        followingCount: 0
      });
    } catch (error) {
      console.error("创建用户资料失败:", error);
    }
  }
};

/**
 * 根据用户ID获取其完整的个人资料
 * @param {string} userId - 用户的 UID
 * @returns {Promise<object|null>} 用户资料对象或 null
 */
export const getUserProfile = async (userId) => {
  if (!userId) return null;
  const userRef = doc(db, 'users', userId);
  const docSnap = await getDoc(userRef);
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() };
  } else {
    console.warn(`未找到用户资料: ${userId}`);
    return null;
  }
};

/**
 * 更新用户的个人资料
 * @param {string} userId - 用户的 UID
 * @param {object} updates - 需要更新的字段对象
 */
export const updateUserProfile = async (userId, updates) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
  });
};

// ============================================================================
// == 图片上传 (Image Upload)
// ============================================================================

/**
 * 上传图片到 Firebase Storage 并返回其下载 URL
 * @param {File} file - 用户选择的图片文件
 * @param {string} path - 在 Storage 中的存储路径 (例如: 'profile_images/userId/avatar')
 * @returns {Promise<string>} 图片的公开下载 URL
 */
export const uploadImage = async (file, path) => {
  if (!file) throw new Error("没有提供文件!");
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const downloadURL = await getDownloadURL(storageRef);
  return downloadURL;
};


// ============================================================================
// == 帖子、收藏、足迹 (Posts, Favorites, Footprints)
// ============================================================================

/**
 * 实时获取指定用户发布的所有帖子
 * @param {string} userId - 用户的 UID
 * @param {function} callback - 一个回调函数，用于接收帖子列表 (e.g., setTabContent)
 * @returns {function} 一个可以用来取消监听的函数 (unsubscribe)
 */
export const getPostsByUser = (userId, callback) => {
  const q = query(
    collection(db, 'posts'), 
    where('authorId', '==', userId), 
    orderBy('createdAt', 'desc')
  );
  
  const unsubscribe = onSnapshot(q, (querySnapshot) => {
    const posts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(posts);
  });
  
  return unsubscribe;
};

/**
 * 获取用户收藏的帖子ID列表
 * (假设用户文档中有一个 `favorites` 数组字段存储帖子ID)
 * @param {string} userId - 用户的 UID
 * @returns {Promise<string[]>} 收藏的帖子ID数组
 */
export const getFavoritesByUser = async (userId) => {
  const userProfile = await getUserProfile(userId);
  return userProfile?.favorites || []; // 返回 favorites 数组或空数组
};

/**
 * 获取用户的浏览历史帖子ID列表
 * (假设用户文档中有一个 `viewHistory` 数组字段存储帖子ID)
 * @param {string} userId - 用户的 UID
 * @returns {Promise<string[]>} 浏览过的帖子ID数组
 */
export const getViewHistoryByUser = async (userId) => {
  const userProfile = await getUserProfile(userId);
  return userProfile?.viewHistory || []; // 返回 viewHistory 数组或空数组
};

/**
 * 根据一个ID数组，批量获取完整的文档对象 (通用函数)
 * @param {string[]} ids - 文档ID数组
 * @param {string} collectionName - 集合名称 (e.g., 'posts' or 'users')
 * @returns {Promise<object[]>} 完整的文档对象数组
 */
export const getDocsByIds = async (ids, collectionName) => {
    if (!ids || ids.length === 0) return [];
    
    // Firestore `in` 查询现在支持最多30个元素
    const MAX_IN_QUERIES = 30;
    const promises = [];

    // 分块处理，以防ID列表超过30个
    for (let i = 0; i < ids.length; i += MAX_IN_QUERIES) {
        const chunk = ids.slice(i, i + MAX_IN_QUERIES);
        const q = query(collection(db, collectionName), where(documentId(), 'in', chunk));
        promises.push(getDocs(q));
    }
    
    const snapshots = await Promise.all(promises);
    const docs = [];
    snapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
            docs.push({ id: doc.id, ...doc.data() });
        });
    });

    // 保持原始ID数组的顺序
    const docsById = Object.fromEntries(docs.map(d => [d.id, d]));
    return ids.map(id => docsById[id]).filter(Boolean);
};

// ============================================================================
// == 关注系统 (Follow System)
// ============================================================================
// 设计: 使用子集合来存储关系, e.g., /users/{userId}/following/{targetId}

/**
 * 关注一个用户
 * @param {string} currentUserId - 当前登录用户的 UID
 * @param {string} targetUserId - 要关注的用户的 UID
 */
export const followUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);

  const followingRef = doc(db, `users/${currentUserId}/following`, targetUserId);
  batch.set(followingRef, { userId: targetUserId, createdAt: serverTimestamp() });

  const followerRef = doc(db, `users/${targetUserId}/followers`, currentUserId);
  batch.set(followerRef, { userId: currentUserId, createdAt: serverTimestamp() });

  const currentUserRef = doc(db, 'users', currentUserId);
  batch.update(currentUserRef, { followingCount: increment(1) });
  const targetUserRef = doc(db, 'users', targetUserId);
  batch.update(targetUserRef, { followersCount: increment(1) });

  await batch.commit();
};

/**
 * 取消关注一个用户
 * @param {string} currentUserId - 当前登录用户的 UID
 * @param {string} targetUserId - 要取关的用户的 UID
 */
export const unfollowUser = async (currentUserId, targetUserId) => {
  const batch = writeBatch(db);

  const followingRef = doc(db, `users/${currentUserId}/following`, targetUserId);
  batch.delete(followingRef);
  const followerRef = doc(db, `users/${targetUserId}/followers`, currentUserId);
  batch.delete(followerRef);

  const currentUserRef = doc(db, 'users', currentUserId);
  batch.update(currentUserRef, { followingCount: increment(-1) });
  const targetUserRef = doc(db, 'users', targetUserId);
  batch.update(targetUserRef, { followersCount: increment(-1) });

  await batch.commit();
};

/**
 * 检查当前用户是否关注了目标用户
 * @param {string} currentUserId - 当前登录用户的 UID
 * @param {string} targetUserId - 目标用户的 UID
 * @returns {Promise<boolean>} 是否已关注
 */
export const checkFollowing = async (currentUserId, targetUserId) => {
  if (!currentUserId || !targetUserId) return false;
  const followingRef = doc(db, `users/${currentUserId}/following`, targetUserId);
  const docSnap = await getDoc(followingRef);
  return docSnap.exists();
};

/**
 * 【已修复】获取用户的关注列表（前50个）
 * @param {string} userId - 用户的 UID
 * @returns {Promise<object[]>} 关注的用户资料列表
 */
export const getFollowingList = async (userId) => {
    const q = query(collection(db, `users/${userId}/following`), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    const userIds = snapshot.docs.map(doc => doc.id);
    
    // ✅ 核心修复：复用通用的 getDocsByIds 函数来高效获取用户资料
    return await getDocsByIds(userIds, 'users');
};

/**
 * 【已修复】获取用户的粉丝列表（前50个）
 * @param {string} userId - 用户的 UID
 * @returns {Promise<object[]>} 粉丝的用户资料列表
 */
export const getFollowersList = async (userId) => {
    const q = query(collection(db, `users/${userId}/followers`), orderBy('createdAt', 'desc'), limit(50));
    const snapshot = await getDocs(q);
    const userIds = snapshot.docs.map(doc => doc.id);
    
    // ✅ 核心修复：复用通用的 getDocsByIds 函数来高效获取用户资料
    return await getDocsByIds(userIds, 'users');
};


// ============================================================================
// == 其他功能 (私信, 管理)
// ============================================================================

/**
 * 开始一个私信 (占位函数)
 * @param {string} targetUserId - 私信对象的 UID
 */
export const startChat = (targetUserId) => {
  // 这里的实现会比较复杂，通常需要跳转到一个聊天页面，并创建一个新的聊天室文档
  // 例如: /chats/{chatRoomId}
  console.log(`正在与 ${targetUserId} 开始聊天...`);
  // router.push(`/messages/${targetUserId}`);
};

/**
 * 拉黑用户
 * @param {string} currentUserId - 操作者的 UID
 * @param {string} targetUserId - 被拉黑者的 UID
 */
export const blockUser = async (currentUserId, targetUserId) => {
  const userRef = doc(db, 'users', currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayUnion(targetUserId)
  });
};

/**
 * 取消拉黑用户
 * @param {string} currentUserId - 操作者的 UID
 * @param {string} targetUserId - 被取消拉黑者的 UID
 */
export const unblockUser = async (currentUserId, targetUserId) => {
  const userRef = doc(db, 'users', currentUserId);
  await updateDoc(userRef, {
    blockedUsers: arrayRemove(targetUserId)
  });
};

/**
 * 举报用户
 * @param {object} reportData - 举报信息对象
 */
export const reportUser = async (reportData) => {
  // 将举报信息写入一个新的集合，方便后台审核
  const reportRef = doc(collection(db, 'reports'));
  await setDoc(reportRef, reportData);
};

// lib/chat.js (抽屉模式最终版)

import { db } from './firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  limit,
  getDoc
} from 'firebase/firestore'

/**
 * 找到或创建一个聊天，并返回完整的对话数据
 * @param {string} currentUserUid 
 * @param {string} targetUserUid 
 * @returns {object | null} 返回对话对象或null
 */
export const startChat = async (currentUserUid, targetUserUid) => {
  if (currentUserUid === targetUserUid) return null;

  const chatsRef = collection(db, 'chats');
  const participantsSorted = [currentUserUid, targetUserUid].sort();
  const q = query(chatsRef, where('participants', '==', participantsSorted));
  
  const querySnapshot = await getDocs(q);
  let existingChatId = null;
  querySnapshot.forEach(doc => {
    existingChatId = doc.id;
  });

  let chatId = existingChatId;

  if (!chatId) {
    const newChatRef = await addDoc(chatsRef, {
      participants: participantsSorted,
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
    });
    chatId = newChatRef.id;
  }
  
  // 核心修改：不再调用 navigate，而是获取完整的对话数据并返回
  try {
    const convDoc = await getDoc(doc(db, 'chats', chatId));
    if (convDoc.exists()) {
      return { id: convDoc.id, ...convDoc.data() };
    }
  } catch (error) {
    console.error("获取对话数据失败:", error);
  }
  
  return null;
};

// ----- 下面的函数保持不变 -----

export const getConversationsForUser = (userId, callback) => {
  if (!userId) return () => {};
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTimestamp', 'desc')
  );
  return onSnapshot(q, snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(conversations);
  });
};

export const getMessagesForChat = (chatId, callback) => {
    if (!chatId) return () => {};

    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    // 监听器会处理初始加载和后续更新
    return onSnapshot(q, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(messages);
    });
};

export const sendMessage = async (chatId, text, senderId) => {
  if (!text.trim()) return;
  const chatRef = doc(db, 'chats', chatId);
  const messagesRef = collection(chatRef, 'messages');

  await addDoc(messagesRef, {
    senderId,
    text,
    timestamp: serverTimestamp()
  });

  await updateDoc(chatRef, {
    lastMessage: text,
    lastMessageTimestamp: serverTimestamp()
  });
};

export const getUserProfile = async (uid) => {
    if (!uid) return null;
    try {
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return userDoc.data();
        }
    } catch (error) {
        console.error("从 'users' 集合获取用户信息失败: ", error);
    }
    return { displayName: '未知用户', photoURL: 'https://www.gravatar.com/avatar?d=mp' };
};

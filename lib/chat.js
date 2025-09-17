// lib/chat.js (最终完整版)

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

export const startChat = async (currentUserUid, targetUserUid, navigate) => {
  if (currentUserUid === targetUserUid) return;

  const chatsRef = collection(db, 'chats');
  const q = query(chatsRef, where('participants', '==', [currentUserUid, targetUserUid].sort()));
  
  const querySnapshot = await getDocs(q);
  let existingChat = null;
  querySnapshot.forEach(doc => {
      existingChat = { id: doc.id, ...doc.data() };
  });

  if (existingChat) {
    navigate(`/forum/messages?chatId=${existingChat.id}`);
  } else {
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUserUid, targetUserUid].sort(), // 排序以确保唯一性
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
      unreadCount: {
        [currentUserUid]: 0,
        [targetUserUid]: 0
      }
    });
    navigate(`/forum/messages?chatId=${newChatRef.id}`);
  }
};


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
  return onSnapshot(q, snapshot => {
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
        // NotionNext 项目的用户信息似乎和 Auth 用户信息在一起，我们先假设存在一个 'users' 集合
        // 这是一个需要根据您项目实际情况调整的地方
        const userDocRef = doc(db, 'users', uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            return userDoc.data();
        }
    } catch (error) {
        console.error("从 'users' 集合获取用户信息失败: ", error);
    }
    // 如果失败，返回一个默认对象，保证UI不崩溃
    return { displayName: '未知用户', photoURL: 'https://www.gravatar.com/avatar?d=mp' };
};

// lib/chat.js (最终简化版)

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
  // 关键改动：为了查询唯一，我们将两个UID排序后组合
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
  
  // 核心修复：无论是新创建还是已存在，都直接跳转到移动端专用的全屏聊天页
  navigate(`/forum/messages/${chatId}`);
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

export const getMessagesForChat = async (chatId, callback) => {
    if (!chatId) return () => { };

    const messagesRef = collection(db, `chats/${chatId}/messages`);
    const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100));

    // 先获取一次数据
    const initialSnapshot = await getDocs(q);
    const initialMessages = initialSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(initialMessages);

    // 再设置监听器
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

// lib/chat.js

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
  getDoc,
  writeBatch
} from 'firebase/firestore'
import { useRouter } from 'next/router'

/**
 * 作用: 发起一个新的聊天，或者跳转到已有的聊天
 * 它会先检查这两个用户是否已经聊过天，如果，有，就直接跳转；如果没有，就创建一个新的聊天室。
 * @param {string} currentUserUid - 当前登录用户的UID
 * @param {string} targetUserUid - 你想和他聊天的用户的UID
 * @param {function} navigate - 一个用于页面跳转的函数 (来自 Next.js 的 router)
 */
export const startChat = async (currentUserUid, targetUserUid, navigate) => {
  if (currentUserUid === targetUserUid) {
    alert('你不能和自己聊天！')
    return
  }

  // 查询是否已存在包含这两个用户的聊天
  const chatsRef = collection(db, 'chats')
  const q = query(
    chatsRef,
    where('participants', 'array-contains', currentUserUid)
  )

  const querySnapshot = await getDocs(q)
  let existingChat = null
  querySnapshot.forEach(doc => {
    const data = doc.data()
    if (data.participants.includes(targetUserUid)) {
      existingChat = { id: doc.id, ...data }
    }
  })

  if (existingChat) {
    // 如果存在，直接跳转
    navigate(`/forum/messages?chatId=${existingChat.id}`)
  } else {
    // 如果不存在，创建一个新的聊天
    const newChatRef = await addDoc(chatsRef, {
      participants: [currentUserUid, targetUserUid],
      lastMessage: '对话已创建',
      lastMessageTimestamp: serverTimestamp(),
      unreadCount: {
        [currentUserUid]: 0,
        [targetUserUid]: 0
      }
    })
    navigate(`/forum/messages?chatId=${newChatRef.id}`)
  }
}

/**
 * 作用: 实时获取一个用户的所有对话列表
 * @param {string} userId - 当前登录用户的UID
 * @param {function} callback - 每当列表更新时，这个函数会被调用
 * @returns {function} - 一个可以停止监听的函数
 */
export const getConversationsForUser = (userId, callback) => {
  if (!userId) return () => {}
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageTimestamp', 'desc')
  )
  return onSnapshot(q, snapshot => {
    const conversations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(conversations)
  })
}

/**
 * 作用: 实时获取某一个特定对话的所有消息
 * @param {string} chatId - 对话的ID
 * @param {function} callback - 每当有新消息时，这个函数会被调用
 * @returns {function} - 一个可以停止监听的函数
 */
export const getMessagesForChat = (chatId, callback) => {
  if (!chatId) return () => {}
  const messagesRef = collection(db, `chats/${chatId}/messages`)
  const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(100))
  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
    callback(messages)
  })
}

/**
 * 作用: 发送一条新消息
 * @param {string} chatId - 要发送到哪个对话
 * @param {string} text - 消息内容
 * @param {string} senderId - 发送者的UID
 */
export const sendMessage = async (chatId, text, senderId) => {
  if (!text.trim()) return

  const chatRef = doc(db, 'chats', chatId)
  const messagesRef = collection(chatRef, 'messages')

  // 1. 添加新消息
  await addDoc(messagesRef, {
    senderId,
    text,
    timestamp: serverTimestamp()
  })

  // 2. 更新对话的最后一条消息摘要，方便在列表页显示
  await updateDoc(chatRef, {
    lastMessage: text,
    lastMessageTimestamp: serverTimestamp()
    // 可以在这里增加更新未读消息数的逻辑，后续再优化
  })
}

/**
 * 作用: 根据用户UID获取用户的公开信息（昵称、头像）
 * @param {string} uid - 用户UID
 * @returns {object} - 包含 displayName 和 photoURL 的对象
 */
export const getUserProfile = async (uid) => {
  if (!uid) return null;
  const userDocRef = doc(db, 'users', uid); // 假设你的用户信息存在 'users' 集合
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    return userDoc.data();
  }
  // 如果你的用户信息不在 'users' 集合，你可能需要修改这里
  // 这是一个备用方案，如果找不到用户信息，就返回一个默认值
  console.warn(`无法找到UID为 ${uid} 的用户信息。`);
  return { displayName: '未知用户', photoURL: 'https://via.placeholder.com/150' };
}

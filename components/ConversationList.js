// /components/ConversationList.js (这是一个新文件)

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';

const ConversationList = () => {
    const { user } = useAuth();
    const router = useRouter();
    const [conversations, setConversations] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setLoading(false);
            return;
        }

        const chatsQuery = query(
            collection(db, 'privateChats'),
            where('members', 'array-contains', user.uid),
            orderBy('lastMessageTimestamp', 'desc')
        );

        const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
            setLoading(true);
            const chatPromises = snapshot.docs.map(async (chatDoc) => {
                const chatData = chatDoc.data();
                const otherUserId = chatData.members.find(id => id !== user.uid);
                if (!otherUserId) return null;
                
                const userProfileDoc = await getDoc(doc(db, 'users', otherUserId));
                const otherUser = userProfileDoc.exists()
                    ? { id: userProfileDoc.id, ...userProfileDoc.data() }
                    : { id: otherUserId, displayName: '未知用户', photoURL: '/img/avatar.svg' };

                const lastReadTimestamp = chatData.lastRead?.[user.uid]?.toDate();
                const lastMessageTimestamp = chatData.lastMessageTimestamp?.toDate();
                const isUnread = lastReadTimestamp && lastMessageTimestamp && lastMessageTimestamp > lastReadTimestamp;
                
                return { id: chatDoc.id, ...chatData, otherUser, isUnread };
            });

            const resolvedChats = (await Promise.all(chatPromises)).filter(Boolean);
            setConversations(resolvedChats);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);
    
    const handleConversationClick = (peerUser) => {
        router.push({
            pathname: `/chat/${peerUser.id}`,
            query: {
                peerDisplayName: peerUser.displayName,
            }
        });
    };

    if (loading) {
        return <div className="p-8 text-center text-gray-500">正在加载私信...</div>;
    }
    
    if (!user) {
        return <div className="p-8 text-center text-gray-500">请先登录以查看私信。</div>;
    }

    if (conversations.length === 0) {
        return <div className="p-8 text-center text-gray-500">还没有任何私信哦。</div>;
    }

    return (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map(convo => (
                <li key={convo.id} onClick={() => handleConversationClick(convo.otherUser)} className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                    <div className="relative">
                        <img src={convo.otherUser.photoURL || '/img/avatar.svg'} alt={convo.otherUser.displayName} className="w-14 h-14 rounded-full object-cover" />
                        {convo.isUnread && (
                            <span className="absolute top-0 right-0 block h-3 w-3 rounded-full bg-red-500 border-2 border-white dark:border-gray-800" />
                        )}
                    </div>
                    <div className="ml-4 flex-1 overflow-hidden">
                        <div className="flex justify-between items-center">
                            <p className="font-semibold truncate dark:text-gray-200">{convo.otherUser.displayName || '未知用户'}</p>
                            <p className="text-xs text-gray-400">{convo.lastMessageTimestamp?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                        <p className="text-sm text-gray-500 truncate mt-1">{convo.lastMessage}</p>
                    </div>
                </li>
            ))}
        </ul>
    );
};

export default ConversationList;

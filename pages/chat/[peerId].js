// /pages/chat/[peerId].js

import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import PrivateChat from '@/components/PrivateChat';

const ChatPage = () => {
    const router = useRouter();
    const { user } = useAuth();
    
    // 从路由中获取对方的用户信息
    const { peerId, peerDisplayName } = router.query;

    // 如果数据还没加载好，可以显示一个加载状态
    if (!peerId || !user) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-black">
                正在加载聊天...
            </div>
        );
    }
    
    return (
        <PrivateChat
            peerUid={peerId}
            peerDisplayName={peerDisplayName}
            currentUser={user}
            onClose={() => router.back()} // 点击返回按钮时，返回到上一个页面（消息列表）
        />
    );
};

export default ChatPage;

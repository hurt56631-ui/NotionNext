// /pages/chat/[peerId].js (已修复 self is not defined 错误)

import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import dynamic from 'next/dynamic'; // 引入 dynamic

// 【核心修复】将 PrivateChat 动态导入，并禁用 SSR
const PrivateChatWithNoSSR = dynamic(
  () => import('@/themes/heo/components/PrivateChat'),
  { ssr: false }
);

const ChatPage = () => {
    const router = useRouter();
    const { user } = useAuth();
    
    const { peerId, peerDisplayName } = router.query;

    // 使用 router.isReady 确保 query 参数已加载
    if (!router.isReady || !user) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-gray-100 dark:bg-black text-gray-500">
                正在加载聊天室...
            </div>
        );
    }
    
    if (!peerId) {
        return (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-100 dark:bg-black text-gray-500">
                <p>无法加载聊天对象。</p>
                <button onClick={() => router.back()} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">返回</button>
            </div>
        );
    }
    
    return (
        <PrivateChatWithNoSSR
            peerUid={peerId}
            peerDisplayName={peerDisplayName || '聊天'}
            currentUser={user}
            onClose={() => router.back()}
        />
    );
};

export default ChatPage;

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/lib/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Send, Globe, MessageCircle } from 'lucide-react';

// --- 单个语伴卡片骨架屏 (加载时显示) ---
const PartnerCardSkeleton = () => (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md animate-pulse">
        <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
            </div>
        </div>
        <div className="mt-4 space-y-2">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        </div>
    </div>
);


// --- 单个语伴卡片组件 ---
const LanguagePartnerCard = ({ partner, onStartChat }) => {
    const router = useRouter();

    return (
        <div 
            onClick={() => router.push(`/profile/${partner.uid}`)}
            className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-shadow cursor-pointer border border-transparent hover:border-blue-500"
        >
            <div className="flex items-start space-x-4">
                {/* 头像和在线状态 */}
                <div className="relative flex-shrink-0">
                    <img 
                        src={partner.photoURL || '/img/avatar.svg'} 
                        alt={partner.displayName}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white dark:border-gray-700 shadow-sm"
                    />
                    <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-400 rounded-full border-2 border-white dark:border-gray-800 ring-1 ring-green-300">
                        <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75"></span>
                    </div>
                </div>

                {/* 用户信息 */}
                <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{partner.displayName || '新用户'}</h3>
                    {/* 语言信息 */}
                    <div className="mt-1 flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                            <Globe size={14} className="mr-1.5 text-gray-400"/>
                            <span>母语: <span className="font-semibold text-gray-700 dark:text-gray-300">{partner.nativeLanguage || '未知'}</span></span>
                        </div>
                    </div>
                     <div className="mt-1 flex items-center space-x-3 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center">
                            <MessageCircle size={14} className="mr-1.5 text-gray-400"/>
                            <span>在学: <span className="font-semibold text-gray-700 dark:text-gray-300">{partner.learningLanguage || '未知'}</span></span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 简介和私信按钮 */}
            <div className="mt-4">
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed h-10 overflow-hidden">
                    {partner.bio || '这位语伴很神秘，什么也没留下...'}
                </p>
                <div className="mt-4 flex justify-end">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onStartChat(partner);
                        }}
                        className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500 text-white font-semibold text-sm hover:bg-blue-600 transition-colors active:scale-95 shadow-md"
                    >
                        <Send size={16} className="mr-2" />
                        私信
                    </button>
                </div>
            </div>
        </div>
    );
};


// --- 语伴列表主组件 ---
export default function LanguagePartnerList() {
    const [partners, setPartners] = useState([]);
    const [loading, setLoading] = useState(true);
    const { user: currentUser } = useAuth();
    const router = useRouter();

    useEffect(() => {
        const fetchPartners = async () => {
            if (!db) return;
            setLoading(true);
            try {
                // 计算24小时前的时间戳
                const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

                // 查询 users 集合中，lastSeen 在24小时内的用户
                const q = query(
                    collection(db, 'users'),
                    where('lastSeen', '>=', oneDayAgo),
                    orderBy('lastSeen', 'desc'),
                    limit(50) // 最多显示50个
                );

                const querySnapshot = await getDocs(q);
                const fetchedPartners = [];
                querySnapshot.forEach((doc) => {
                    // 排除当前用户自己
                    if (currentUser && doc.id === currentUser.uid) return;
                    fetchedPartners.push({ uid: doc.id, ...doc.data() });
                });

                setPartners(fetchedPartners);
            } catch (error) {
                console.error("获取语伴列表失败:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPartners();
    }, [currentUser]);

    const handleStartChat = (targetUser) => {
        if (!currentUser) {
            alert("请先登录再开始聊天");
            // 这里可以触发您的登录弹窗
            return;
        }
        const chatId = [currentUser.uid, targetUser.uid].sort().join('_');
        router.push(`/messages/${chatId}`);
    };

    return (
        <div className="bg-gray-50 dark:bg-black min-h-screen">
            <div className="max-w-3xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white text-center mb-2">发现语伴</h1>
                <p className="text-center text-gray-500 dark:text-gray-400 mb-8">以下是24小时内活跃的用户</p>
                
                <div className="space-y-6">
                    {loading ? (
                        // 加载时显示3个骨架屏
                        <>
                            <PartnerCardSkeleton />
                            <PartnerCardSkeleton />
                            <PartnerCardSkeleton />
                        </>
                    ) : partners.length > 0 ? (
                        partners.map(partner => (
                            <LanguagePartnerCard 
                                key={partner.uid} 
                                partner={partner}
                                onStartChat={handleStartChat}
                            />
                        ))
                    ) : (
                        <div className="text-center py-16">
                            <p className="text-gray-500">暂时没有找到活跃的语伴哦。</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// This is a self-contained component that integrates the full AiChatAssistant logic.
import { Transition } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';

// =================================================================================
// AiChatAssistant Component Logic (Integrated directly into this file)
// Version: Integrated with new custom AiTtsButton
// =================================================================================

// --- 辅助函数 ---
const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- 常量定义 ---
const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };
const CHAT_MODELS_LIST = [ { id: 'model-1', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 8192 }, { id: 'model-2', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 8192 }, { id: 'model-3', name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', maxContextTokens: 4096 }, { id: 'model-4', name: 'Gemini 1.5 Flash (最新)', value: 'gemini-1.5-flash-latest', maxContextTokens: 8192 }, { id: 'model-5', name: 'Gemini 1.5 Pro (最新)', value: 'gemini-1.5-pro-latest', maxContextTokens: 8192 }, ];
const DEFAULT_PROMPTS = [ { id: 'default-grammar-correction', name: '纠正中文语法', content: '你是一位专业的、耐心的中文老师，请纠正我发送的中文句子中的语法和用词错误，并给出修改建议和说明。', openingLine: '你好，请发送你需要我纠正的中文句子。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }, { id: 'explain-word', name: '解释中文词语', content: '你是一位专业的中文老师，请用简单易懂的方式解释我发送的中文词语，并提供几个例子。', openingLine: '你好，请问你想了解哪个中文词语？', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' }, { id: 'translate-myanmar', name: '中缅互译', content: '你是一位专业的翻译助手，请将我发送的内容在中文和缅甸语之间进行互译。', openingLine: '你好！请发送中文或缅甸语内容以进行翻译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' } ];
// [修改] 简化了默认设置中的TTS部分
const DEFAULT_SETTINGS = { apiKey: '', apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-2.5-flash', temperature: 0.8, maxOutputTokens: 2048, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS, currentPromptId: DEFAULT_PROMPTS[0]?.id || '', autoRead: false, ttsEngine: TTS_ENGINE.THIRD_PARTY, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', ttsRate: 0, ttsPitch: 0, systemTtsVoiceURI: '', speechLanguage: 'zh-CN', chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 70, userAvatarUrl: '/images/user-avatar.png', aiAvatarUrl: '/images/ai-avatar.png', isFacebookApp: false, };


// --- 【全新】内部 TTS 组件 ---
// /components/AiTtsButton.js (Microsoft TTS 专用版 + 音乐动画图标)

// 1. 发音人数据已内置
const MICROSOFT_TTS_VOICES = [
  // --- 中文 (大陆) ---
  { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
  { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
  { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
  { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' },
  { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' },
  { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' },
  { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' },
  // --- 中文 (台湾) ---
  { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' },
  { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' },
  // --- 英语 (美国) ---
  { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' },
  { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' },
  // --- 日语 ---
  { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' },
  { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' },
  // --- 缅甸语 ---
  { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
  { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
];

const AiTtsButton = ({ text, ttsSettings }) => {
    const [playbackState, setPlaybackState] = useState('idle'); // idle, loading, playing, paused
    const audioRef = useRef(null);
    const abortControllerRef = useRef(null);
    
    // 从 ttsSettings 中解构出需要的参数
    const {
        ttsVoice = 'zh-CN-XiaoxiaoMultilingualNeural',
        ttsRate = 0,
        ttsPitch = 0,
    } = ttsSettings || {};

    const cleanTextForSpeech = (rawText) => {
        if (!rawText) return '';
        let cleaned = rawText;
        cleaned = cleaned.replace(/!\[.*?\]\(.*?\)/g, '');
        cleaned = cleaned.replace(/\[(.*?)\]\(.*?\)/g, '$1');
        cleaned = cleaned.replace(/(\*\*|__|\*|_|~~|`)/g, '');
        cleaned = cleaned.replace(/^(#+\s*|[\*\-]\s*)/gm, '');
        cleaned = cleaned.replace(/【.*?】|\[.*?\]/g, '');
        const pinyinRegex = /\b[a-zA-ZüÜ]+[1-5]\b\s*/g;
        cleaned = cleaned.replace(pinyinRegex, '');
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        cleaned = cleaned.replace(emojiRegex, '');
        return cleaned.trim();
    };

    useEffect(() => {
        return () => {
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (audioRef.current) {
                audioRef.current.pause();
                if (audioRef.current.src?.startsWith('blob:')) URL.revokeObjectURL(audioRef.current.src);
            }
        };
    }, []);

    const startPlayback = useCallback(async (textToSpeak) => {
        if (playbackState === 'playing') {
            audioRef.current?.pause();
            return;
        }
        if (playbackState === 'paused') {
            audioRef.current?.play();
            return;
        }

        const cleanedText = cleanTextForSpeech(textToSpeak);
        if (!cleanedText) return;

        setPlaybackState('loading');
        abortControllerRef.current = new AbortController();

        try {
            const params = new URLSearchParams({
                t: cleanedText,
                v: ttsVoice,
                r: `${ttsRate}%`,
                p: `${ttsPitch}%`
            });
            const url = `https://t.leftsite.cn/tts?${params.toString()}`;
            const response = await fetch(url, { signal: abortControllerRef.current.signal });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API 请求失败: ${response.status} ${errorText}`);
            }

            const blob = await response.blob();
            const audioUrl = URL.createObjectURL(blob);

            if (audioRef.current?.src) URL.revokeObjectURL(audioRef.current.src);

            const audio = new Audio(audioUrl);
            audioRef.current = audio;

            audio.onplay = () => setPlaybackState('playing');
            audio.onpause = () => { if (audio.currentTime < audio.duration) setPlaybackState('paused'); };
            audio.onended = () => setPlaybackState('idle');
            audio.onerror = (e) => { console.error('音频播放错误:', e); setPlaybackState('idle'); };

            await audio.play();

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('语音合成失败:', err);
                alert(`语音合成失败: ${err.message}`);
            }
            setPlaybackState('idle');
        }
    }, [ttsVoice, ttsRate, ttsPitch, playbackState]);

    const AnimatedMusicIcon = ({ state }) => {
        const barStyle = (animationDelay) => ({
            animation: state === 'playing' ? `sound-wave 1.2s ease-in-out ${animationDelay} infinite alternate` : 'none',
        });
        return (
            <div className="relative w-6 h-6 flex items-center justify-center">
                <div className={`absolute transition-opacity duration-300 ${state === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
                    <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
                <div className={`absolute transition-opacity duration-300 ${state !== 'loading' ? 'opacity-100' : 'opacity-0'}`}>
                    <div className="flex items-end justify-center w-6 h-6 gap-0.5">
                        <span className="w-1 h-2 bg-current rounded-full" style={barStyle('0s')}></span>
                        <span className="w-1 h-4 bg-current rounded-full" style={barStyle('0.2s')}></span>
                        <span className="w-1 h-5 bg-current rounded-full" style={barStyle('0.4s')}></span>
                        <span className="w-1 h-3 bg-current rounded-full" style={barStyle('0.6s')}></span>
                    </div>
                </div>
                <style jsx>{`
                  @keyframes sound-wave { 0% { transform: scaleY(0.2); } 100% { transform: scaleY(1); } }
                `}</style>
            </div>
        );
    };

    return (
        <button
            onClick={(e) => { e.stopPropagation(); startPlayback(text); }}
            disabled={playbackState === 'loading'}
            className="p-2 rounded-full transition-colors duration-200 transform active:scale-90 hover:bg-black/10 text-gray-500 disabled:cursor-not-allowed disabled:opacity-50"
            title={playbackState === 'playing' ? "暂停" : "朗读"}
        >
            <AnimatedMusicIcon state={playbackState} />
        </button>
    );
};


// --- 子组件 ---
const TypingEffect = ({ text, onComplete, onUpdate }) => {
    const [displayedText, setDisplayedText] = useState('');
    useEffect(() => {
        if (!text) return; setDisplayedText(''); let index = 0;
        const intervalId = setInterval(() => {
            setDisplayedText(prev => prev + text.charAt(index));
            index++;
            if (onUpdate) onUpdate();
            if (index >= text.length) { clearInterval(intervalId); if (onComplete) onComplete(); }
        }, 30);
        return () => clearInterval(intervalId);
    }, [text, onComplete, onUpdate]);
    return <SimpleMarkdown text={displayedText} />;
};

const SimpleMarkdown = ({ text }) => { if (!text) return null; const lines = text.split('\n').map((line, index) => { if (line.trim() === '') return <br key={index} />; if (line.match(/\*\*(.*?)\*\*/)) { const content = line.replace(/\*\*/g, ''); return <strong key={index} className="block mt-2 mb-1">{content}</strong>; } if (line.startsWith('* ') || line.startsWith('- ')) { return <li key={index} className="ml-5 list-disc">{line.substring(2)}</li>; } return <p key={index} className="my-1">{line}</p>; }); return <div>{lines}</div>; };

const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, onTypingComplete, onTypingUpdate }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-500 text-white rounded-br-lg shadow-[0_5px_15px_rgba(59,130,246,0.3),_0_12px_28px_rgba(59,130,246,0.2)]';
    const aiBubbleClass = 'bg-white dark:bg-gray-700 border border-gray-200/50 dark:border-gray-600/50 shadow-[0_5px_15px_rgba(0,0,0,0.12),_0_15px_35px_rgba(0,0,0,0.08)]';
    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(settings.aiAvatarUrl)} alt="AI Avatar" className="w-8 h-8 rounded-full shrink-0 shadow-sm" />}
            <div className={`p-3 rounded-2xl text-left flex flex-col transition-shadow duration-300 ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '85%' }}>
                {msg.images && msg.images.length > 0 && (<div className="flex flex-wrap gap-2 mb-2">{msg.images.map((img, index) => <img key={index} src={img.previewUrl} alt={`附件 ${index + 1}`} className="w-24 h-24 object-cover rounded-md" />)}</div>)}
                <div className={`prose prose-sm max-w-none prose-p:my-1 ${isUser ? 'prose-white' : 'text-gray-900 dark:text-gray-100 [text-shadow:0_1px_2px_rgba(0,0,0,0.05)]'}`}>
                    {isLastAiMessage && msg.isTyping ? <TypingEffect text={msg.content || ''} onComplete={onTypingComplete} onUpdate={onTypingUpdate} /> : <SimpleMarkdown text={msg.content || ''} />}
                </div>
                {!isUser && msg.content && !msg.isTyping && (
                    <div className="flex items-center gap-2 mt-2 -mb-1 text-gray-500 dark:text-gray-400">
                        {settings.isFacebookApp && <span className="text-sm text-red-400" title="Facebook App内浏览器不支持语音功能">语音不可用</span>}
                        {/* [修改] 调用新的 AiTtsButton，并传递 settings */}
                        {!settings.isFacebookApp && <AiTtsButton text={msg.content} ttsSettings={settings} />}
                        <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="复制"><i className="fas fa-copy"></i></button>
                        {isLastAiMessage && (<button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10" title="重新生成"><i className="fas fa-sync-alt"></i></button>)}
                    </div>
                )}
            </div>
            {isUser && <img src={convertGitHubUrl(settings.userAvatarUrl)} alt="User Avatar" className="w-8 h-8 rounded-full shrink-0 shadow-sm" />}
        </div>
    );
};

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    const [editingId, setEditingId] = useState(null);
    const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) { onRename(id, newName.trim()); } setEditingId(null); };
    const groupedConversations = useMemo(() => {
        const groups = new Map();
        const uncategorized = [];
        (conversations || []).forEach(conv => {
            const promptId = conv.promptId;
            const prompt = (prompts || []).find(p => p.id === promptId);
            if (prompt) { if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); } groups.get(promptId).conversations.push(conv); } else { uncategorized.push(conv); }
        });
        return { sortedGroups: Array.from(groups.values()), uncategorized };
    }, [conversations, prompts]);
    const renderConversationItem = (conv) => (
        <div key={conv.id} className={`group flex items-center p-2 rounded-md cursor-pointer transition-all duration-200 ${currentId === conv.id ? 'bg-blue-500/10' : 'hover:bg-gray-200/50 dark:hover:bg-gray-700/50'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}>
                {editingId === conv.id ? ( <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b border-gray-400 dark:border-gray-500" autoFocus /> ) : ( <span className={`text-sm ${currentId === conv.id ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}>{conv.title}</span> )}
            </div>
            <div className={`flex items-center shrink-0 space-x-1 transition-opacity ${currentId === conv.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600" title="重命名"><i className="fas fa-pen w-3 h-3"></i></button>
                <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-2 rounded-full text-red-500 hover:bg-red-500/10" title="删除"><i className="fas fa-trash w-3 h-3"></i></button>
            </div>
        </div>
    );
    return (
        <div className={`absolute lg:relative h-full bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-md flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-60 p-3 shadow-[10px_0px_20px_rgba(0,0,0,0.1)]' : 'w-0 p-0'} overflow-hidden`}>
             <button onClick={onNew} className="flex items-center justify-center w-full px-4 py-2 mb-3 font-semibold text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-800 rounded-full shadow-lg shadow-gray-300/20 dark:shadow-black/20 hover:bg-gray-50 dark:hover:bg-gray-700 active:scale-95 transition-all duration-200 border border-gray-200 dark:border-gray-700"> <i className="fas fa-plus mr-2"></i> 新对话 </button>
            <div className="flex-grow overflow-y-auto space-y-2 -mr-2 pr-2">
                {groupedConversations.sortedGroups.map(({ prompt, conversations }) => ( <details key={prompt.id} className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={prompt.name} className="w-5 h-5 rounded-full object-cover" /> <span className="text-xs font-semibold flex-grow">{prompt.name}</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(conversations || []).map(renderConversationItem)} </div> </details> ))}
                {groupedConversations.uncategorized.length > 0 && ( <details className="group" open> <summary className="flex items-center gap-2 p-2 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 list-none"> <i className="fas fa-folder w-5 h-5 text-gray-500"></i> <span className="text-xs font-semibold flex-grow">未分类对话</span> <i className="fas fa-chevron-down text-xs text-gray-500 transition-transform group-open:rotate-180"></i> </summary> <div className="pl-3 mt-1 space-y-1"> {(groupedConversations.uncategorized || []).map(renderConversationItem)} </div> </details> )}
            </div>
        </div>
    );
};

const SubPageWrapper = ({ title, onBack, children }) => (
    <div className="p-6 h-full flex flex-col bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200">
        <h3 className="text-2xl font-bold mb-4 shrink-0">{title}</h3>
        <div className="flex-grow overflow-y-auto pr-2">{children}</div>
        <button onClick={onBack} className="fixed bottom-8 right-8 w-14 h-14 bg-gray-800 text-white rounded-full shadow-lg flex items-center justify-center z-10 hover:bg-gray-900 active:scale-95 transition-all">
            <i className="fas fa-arrow-left text-xl"></i>
        </button>
    </div>
);

const PromptManager = ({ prompts, onChange, onAdd, onDelete, settings }) => ( <> {(prompts || []).map(p => ( <div key={p.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> <div className="flex items-center justify-between"> <label className="flex items-center flex-grow cursor-pointer gap-2"> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-6 h-6 rounded-full object-cover"/> <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="font-semibold bg-transparent w-full text-lg" /> </label> <button onClick={() => onDelete(p.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> {p.id.startsWith('default-') ? ( <div className="w-full h-24 p-2 bg-gray-100 dark:bg-gray-600 border rounded-md text-sm text-gray-500 dark:text-gray-400 italic flex items-center justify-center">[内置提示词，内容已隐藏]</div> ) : ( <textarea value={p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} placeholder="请输入系统提示词 (System Prompt)..." className="w-full h-24 p-2 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm" /> )} <textarea value={p.openingLine || ''} onChange={(e) => onChange(p.id, 'openingLine', e.target.value)} placeholder="请输入AI第一句开场白..." className="w-full p-2 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-sm" /> <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"> <div><label className="text-xs font-medium">模型:</label><select value={p.model || settings.selectedModel} onChange={(e) => onChange(p.id, 'model', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs">{(settings.chatModels || []).map(m => <option key={m.id} value={m.value}>{m.name}</option>)}</select></div> <div><label className="text-xs font-medium">声音:</label><select value={p.ttsVoice || settings.ttsVoice} onChange={(e) => onChange(p.id, 'ttsVoice', e.target.value)} className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs">{(MICROSOFT_TTS_VOICES || []).map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div> <div><label className="text-xs font-medium">头像 URL:</label><input type="text" value={p.avatarUrl || ''} onChange={(e) => onChange(p.id, 'avatarUrl', e.target.value)} placeholder="输入头像图片URL" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /></div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-green-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新提示词</button> </> );
const ModelManager = ({ models, onChange, onAdd, onDelete }) => ( <> {(models || []).map(m => ( <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> <div className="flex items-center justify-between"> <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-lg" /> <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div> <label className="text-xs font-medium">模型值 (Value)</label> <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gemini-1.5-pro-latest" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> <div> <label className="text-xs font-medium">最大上下文 (Tokens)</label> <input type="number" value={m.maxContextTokens} onChange={(e) => onChange(m.id, 'maxContextTokens', parseInt(e.target.value, 10) || 0)} placeholder="例如: 8192" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-blue-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新模型</button> </> );
const ApiKeyManager = ({ apiKeys, activeApiKeyId, onChange, onAdd, onDelete, onSetActive }) => ( <> {(apiKeys || []).map(k => ( <div key={k.id} className={`p-3 rounded-md border-2 ${activeApiKeyId === k.id ? 'border-blue-500 bg-blue-500/10' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700'}`}> <div className="flex items-center justify-between mb-2"> <select value={k.provider} onChange={(e) => onChange(k.id, 'provider', e.target.value)} className="font-semibold bg-transparent text-lg"> <option value="gemini">Google Gemini</option> <option value="openai">OpenAI 兼容</option> </select> <div className="flex items-center gap-2"> <button onClick={() => onSetActive(k.id)} disabled={activeApiKeyId === k.id} className="px-2 py-1 text-xs bg-green-500 text-white rounded disabled:bg-gray-400">设为当前</button> <button onClick={() => onDelete(k.id)} className="p-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> </div> {k.provider === 'openai' && ( <div className="mt-2"> <label className="text-xs font-medium">API 接口地址 (URL)</label> <input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="例如: https://api.openai.com/v1" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> )} {k.provider === 'gemini' && ( <div className="mt-2"> <label className="text-xs font-medium">API 接口地址 (官方)</label> <p className="w-full mt-1 px-2 py-1 bg-gray-100 dark:bg-gray-600 border dark:border-gray-500 rounded-md text-xs text-gray-500 dark:text-gray-400 truncate">https://generativelanguage.googleapis.com</p> </div> )} <div className="mt-2"> <label className="text-xs font-medium">API 密钥 (Key)</label> <input type="password" value={k.key} onChange={(e) => onChange(k.id, 'key', e.target.value)} placeholder="请输入密钥" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-indigo-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新密钥</button> </> );

const SettingsModal = ({ settings, onSave, onClose }) => { const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); const fileInputRef = useRef(null); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { handleChange('chatBackgroundUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; }; const handleAddPrompt = () => { const newPrompt = { id: generateSimpleId('prompt'), name: '新助理', content: '你是一个...', openingLine: '你好，我是你的新助理。', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; const newPrompts = [...(tempSettings.prompts || []), newPrompt]; handleChange('prompts', newPrompts); }; const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; const handlePromptSettingChange = (promptId, field, value) => { const newPrompts = (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p); handleChange('prompts', newPrompts); }; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; const handleAddModel = () => { const newModel = { id: generateSimpleId('model'), name: '新模型', value: '', maxContextTokens: 8192 }; const newModels = [...(tempSettings.chatModels || []), newModel]; handleChange('chatModels', newModels); }; const handleDeleteModel = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newModels = (tempSettings.chatModels || []).filter(m => m.id !== idToDelete); handleChange('chatModels', newModels); }; const handleModelSettingChange = (modelId, field, value) => { const newModels = (tempSettings.chatModels || []).map(m => m.id === modelId ? { ...m, [field]: value } : m); handleChange('chatModels', newModels); }; const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), provider: 'gemini', key: '', url: 'https://generativelanguage.googleapis.com/v1beta/models/' }; const newKeys = [...(tempSettings.apiKeys || []), newKey]; handleChange('apiKeys', newKeys); }; const handleDeleteApiKey = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== idToDelete); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === idToDelete) handleChange('activeApiKeyId', newKeys[0]?.id || ''); }; const handleApiKeySettingChange = (keyId, field, value) => { const newKeys = (tempSettings.apiKeys || []).map(k => k.id === keyId ? { ...k, [field]: value } : k); handleChange('apiKeys', newKeys); }; const handleSetActiveApiKey = (keyId) => { handleChange('activeApiKeyId', keyId); };
    const commonInputClasses = 'w-full px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md';
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200" style={{ height: 'min(650px, 90vh)' }} onClick={e => e.stopPropagation()}>
                {view === 'main' && ( <div className="p-6 h-full flex flex-col"> <h3 className="text-2xl font-bold mb-4 shrink-0">设置</h3> <div className="space-y-4 flex-grow overflow-y-auto pr-2"> <button type="button" onClick={() => setView('apiKeys')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">API 密钥管理</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('prompts')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">助理工作室</h4><i className={`fas fa-arrow-right`}></i></button> <button type="button" onClick={() => setView('models')} className="w-full flex justify-between items-center p-3 rounded-md bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"><h4 className="text-lg font-bold">模型管理</h4><i className={`fas fa-arrow-right`}></i></button> <div><label className="block text-sm font-medium mb-1">聊天背景图片</label><div className="flex gap-2"><input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="输入URL或从本地上传" className={commonInputClasses} /><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" /><button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-gray-600 text-white rounded-md shrink-0 hover:bg-gray-700">上传</button></div></div><div className="flex items-center gap-4"><label className="text-sm shrink-0">背景图透明度: {tempSettings.backgroundOpacity}%</label><input type="range" min="0" max="100" step="1" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="w-full"/></div> <div className="flex items-center justify-between"><label className="block text-sm font-medium">始终开启新对话</label><input type="checkbox" checked={tempSettings.startWithNewChat} onChange={(e) => handleChange('startWithNewChat', e.target.checked)} className="h-5 w-5 text-blue-500 rounded" /></div> <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-3"><label className="block text-sm font-medium">高级参数</label><div className="flex items-center gap-4"><label className="text-sm shrink-0">温度: {tempSettings.temperature}</label><input type="range" min="0" max="1" step="0.1" value={tempSettings.temperature} onChange={(e) => handleChange('temperature', parseFloat(e.target.value))} className="w-full"/></div><div><div className="flex items-center justify-between"><label htmlFor="thinking-mode-toggle" className="block text-sm font-medium">关闭 2.5 系列模型思考模式</label><input id="thinking-mode-toggle" type="checkbox" checked={tempSettings.disableThinkingMode} onChange={(e) => handleChange('disableThinkingMode', e.target.checked)} className="h-5 w-5 text-blue-500 rounded cursor-pointer" /></div><p className="text-xs text-gray-500 dark:text-gray-400 mt-1">开启后可大幅提升响应速度和降低成本，但可能影响复杂问题的回答质量。</p></div></div> 
                {/* [修改] 简化朗读设置区域 */}
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-md space-y-4">
                    <h4 className="text-md font-semibold">朗读设置</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex items-center gap-2"><label className="text-sm shrink-0">语速 ({tempSettings.ttsRate}%)</label><input type="range" min="-100" max="100" step="5" value={tempSettings.ttsRate} onChange={(e) => handleChange('ttsRate', parseInt(e.target.value, 10))} className="w-full"/></div>
                        <div className="flex items-center gap-2"><label className="text-sm shrink-0">音调 ({tempSettings.ttsPitch}%)</label><input type="range" min="-100" max="100" step="5" value={tempSettings.ttsPitch} onChange={(e) => handleChange('ttsPitch', parseInt(e.target.value, 10))} className="w-full"/></div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">朗读引擎</label>
                        <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className={commonInputClasses}>
                            <option value={TTS_ENGINE.THIRD_PARTY}>Microsoft TTS (音质更好)</option>
                            <option value={TTS_ENGINE.SYSTEM}>系统内置 (速度快)</option>
                        </select>
                    </div>
                    {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (
                        <div>
                            <label className="block text-sm font-medium mb-1">发音人</label>
                            <select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className={commonInputClasses}>
                                {MICROSOFT_TTS_VOICES.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}
                            </select>
                        </div>
                    )}
                    {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (
                        <div>
                           <label className="block text-sm font-medium mb-1">发音人 (系统)</label>
                           {systemVoices.length > 0 ? (
                               <select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className={commonInputClasses}>
                                   <option value="">浏览器默认</option>
                                   {systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}
                               </select>
                           ) : <p className="text-sm text-gray-500 mt-1">无可用内置声音。</p>}
                        </div>
                    )}
                </div> 

                <div><label className="block text-sm font-medium mb-1">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className={commonInputClasses}>{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div> 
                <div className="flex items-center justify-between"><label className="block text-sm font-medium">AI 回复后自动朗读</label><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="h-5 w-5 text-blue-500 rounded" /></div> 
                </div> <div className="flex justify-end gap-3 mt-6 shrink-0"><button onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 rounded-md">关闭</button><button onClick={() => onSave(tempSettings)} className="px-4 py-2 bg-blue-600 text-white rounded-md">保存</button></div> </div> )}
                {view === 'prompts' && <SubPageWrapper title="助理工作室" onBack={() => setView('main')}><PromptManager prompts={tempSettings.prompts} settings={tempSettings} onChange={handlePromptSettingChange} onAdd={handleAddPrompt} onDelete={handleDeletePrompt} /></SubPageWrapper>}
                {view === 'models' && <SubPageWrapper title="模型管理" onBack={() => setView('main')}><ModelManager models={tempSettings.chatModels} onChange={handleModelSettingChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></SubPageWrapper>}
                {view === 'apiKeys' && <SubPageWrapper title="API 密钥管理" onBack={() => setView('main')}><ApiKeyManager apiKeys={tempSettings.apiKeys} activeApiKeyId={tempSettings.activeApiKeyId} onChange={handleApiKeySettingChange} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} onSetActive={handleSetActiveApiKey} /></SubPageWrapper>}
            </div>
        </div>
    );
};

const ModelSelector = ({ settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative"> <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">切换模型</h3> <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh]"> {(settings.chatModels || []).map(m => ( <button key={m.id} type="button" onClick={() => { onSelect(m.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-blue-500/10 ${settings.selectedModel === m.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10' : 'text-gray-800 dark:text-gray-200'}`}>{m.name}</button> ))} </div> </div> </div> );

const AssistantSelector = ({ prompts, settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-2xl m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative"><h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">更换助理</h3><button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button></div> <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-4 overflow-y-auto max-h-[60vh]"> {(prompts || []).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className={`flex flex-col items-center p-4 rounded-lg border-2 transition-all ${settings.currentPromptId === p.id ? 'border-blue-600 bg-blue-500/10' : 'border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-16 h-16 rounded-full object-cover mb-2 shadow-md"/> <span className="text-sm font-semibold text-center text-gray-800 dark:text-gray-200">{p.name}</span> </button> ))} </div> </div> </div> );

const AiChatAssistant = ({ onClose }) => {
    const [conversations, setConversations] = useState([]);
    const [currentConversationId, setCurrentConversationId] = useState(null);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [showSettings, setShowSettings] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [showAssistantSelector, setShowAssistantSelector] = useState(false);
    const [showModelSelector, setShowModelSelector] = useState(false);
    const [selectedImages, setSelectedImages] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const imageInputRef = useRef(null);
    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const lastAutoReadMessageId = useRef(null);

    // --- 应用初始化 ---
    useEffect(() => {
        setIsMounted(true);
        let finalSettings = { ...DEFAULT_SETTINGS };
        const savedSettings = safeLocalStorageGet('ai_chat_settings');
        if (savedSettings) {
            const parsed = JSON.parse(savedSettings);
            // [修改] 清理旧的、复杂的TTS设置结构
            if (parsed.thirdPartyTtsConfig) {
                parsed.ttsVoice = parsed.thirdPartyTtsConfig.microsoftVoice || DEFAULT_SETTINGS.ttsVoice;
                delete parsed.thirdPartyTtsConfig;
            }
            parsed.prompts = (parsed.prompts || []).map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || DEFAULT_SETTINGS.ttsVoice, avatarUrl: p.avatarUrl || '' }));
            if (!parsed.chatModels || parsed.chatModels.length === 0) { parsed.chatModels = CHAT_MODELS_LIST; }
            if (!parsed.apiKeys) { parsed.apiKeys = []; }
            finalSettings = { ...DEFAULT_SETTINGS, ...parsed };
        }
        if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) { finalSettings.isFacebookApp = true; }
        setSettings(finalSettings);
        const savedConversations = safeLocalStorageGet('ai_chat_conversations');
        const parsedConvs = savedConversations ? JSON.parse(savedConversations) : [];
        setConversations(parsedConvs);
        if (finalSettings.startWithNewChat || parsedConvs.length === 0) {
            createNewConversation(finalSettings.currentPromptId, true);
        } else {
            const firstConv = parsedConvs[0];
            setCurrentConversationId(firstConv.id);
            if (firstConv.messages.length > 0) { lastAutoReadMessageId.current = firstConv.messages[firstConv.messages.length - 1]?.timestamp; }
        }
    }, []);
    
    // --- 核心hooks和函数 ---
    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    useEffect(() => { if (isMounted) { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); safeLocalStorageSet('ai_chat_conversations', JSON.stringify(conversations)); } }, [settings, conversations, isMounted]);
    const scrollToBottom = useCallback((behavior = 'smooth') => { messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }); }, []);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('auto'), 100); return () => clearTimeout(timeout); }, [currentConversationId, scrollToBottom]);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('smooth'), 100); return () => clearTimeout(timeout); }, [currentConversation?.messages?.length]);
    useEffect(() => { if (!currentConversation || !settings.autoRead || !isMounted) return; const messages = currentConversation.messages; const lastMessage = messages[messages.length - 1]; if (lastMessage && lastMessage.role === 'ai' && lastMessage.content && !lastMessage.isTyping && lastMessage.timestamp > (lastAutoReadMessageId.current || 0)) { lastAutoReadMessageId.current = lastMessage.timestamp; setTimeout(() => { const bubble = document.getElementById(`msg-${currentConversation.id}-${messages.length - 1}`); const ttsButton = bubble?.querySelector('button[title="朗读"]'); if (bubble && document.body.contains(bubble)) { ttsButton?.click(); } }, 300); } }, [currentConversation?.messages, settings.autoRead, isMounted]);
    const adjustTextareaHeight = useCallback(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, []);
    useEffect(() => { adjustTextareaHeight(); }, [userInput, adjustTextareaHeight]);
    const createNewConversation = (promptId, isInitial = false) => { const newId = generateSimpleId('conv'); const currentPrompt = (settings.prompts || []).find(p => p.id === (promptId || settings.currentPromptId)) || DEFAULT_PROMPTS[0]; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: currentPrompt.openingLine || '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: currentPrompt.id }; if (isInitial) { lastAutoReadMessageId.current = newConv.messages[0].timestamp; } setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => { const conv = conversations.find(c => c.id === id); if (conv) { lastAutoReadMessageId.current = conv.messages[conv.messages.length - 1]?.timestamp; } setCurrentConversationId(id); };
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { handleSelectConversation(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    const handleAssistantSelect = (promptId) => { const selectedPrompt = settings.prompts.find(p => p.id === promptId); if (!selectedPrompt) return; setSettings(s => ({ ...s, currentPromptId: promptId, selectedModel: selectedPrompt.model || s.selectedModel, ttsVoice: selectedPrompt.ttsVoice || s.ttsVoice })); setConversations(prevConvs => prevConvs.map(c => c.id === currentConversationId ? { ...c, promptId: promptId } : c)); setShowAssistantSelector(false); };
    const startListening = useCallback(() => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } if (recognitionRef.current) recognitionRef.current.abort(); const recognition = new SpeechRecognition(); recognition.lang = settings.speechLanguage; recognition.interimResults = false; recognition.maxAlternatives = 1; recognition.onstart = () => setIsListening(true); recognition.onresult = (e) => { const transcript = e.results[0][0].transcript.trim(); setUserInput(transcript); }; recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); setError(`语音识别失败: ${event.error}`); setIsListening(false); }; recognition.onend = () => setIsListening(false); recognition.start(); recognitionRef.current = recognition; }, [settings.speechLanguage]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); setIsListening(false); } }, []);
    const handleImageSelection = (event) => { const files = Array.from(event.target.files); if (files.length === 0) return; const newImages = files.slice(0, 4 - selectedImages.length); newImages.forEach(file => { const reader = new FileReader(); reader.onload = (e) => { const base64Data = e.target.result.split(',')[1]; const newImage = { previewUrl: URL.createObjectURL(file), data: base64Data, type: file.type, name: file.name }; setSelectedImages(prev => [...prev, newImage]); }; reader.readAsDataURL(file); }); event.target.value = null; };
    const triggerImageInput = () => { if (imageInputRef.current) { imageInputRef.current.removeAttribute('capture'); imageInputRef.current.click(); } };
    const triggerCameraInput = () => { if (imageInputRef.current) { imageInputRef.current.setAttribute('capture', 'environment'); imageInputRef.current.click(); } };
    const removeSelectedImage = (index) => { const imageToRemove = selectedImages[index]; if (imageToRemove) { URL.revokeObjectURL(imageToRemove.previewUrl); } setSelectedImages(prev => prev.filter((_, i) => i !== index)); };
    
    const handleSubmit = async (isRegenerate = false) => {
        if (!currentConversation || isLoading) return;
        const activeKey = (settings.apiKeys || []).find(k => k.id === settings.activeApiKeyId);
        if (!activeKey || !activeKey.key) { setError('请在设置中配置并激活一个有效的 API 密钥。'); return; }
        let messagesForApi = [...currentConversation.messages];
        let textToProcess = userInput.trim();
        if (isRegenerate) { if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') { messagesForApi.pop(); } } else { if (!textToProcess && selectedImages.length === 0) { setError('请输入文字或添加图片后再发送！'); return; } const userMessage = { role: 'user', content: textToProcess, images: selectedImages, timestamp: Date.now() }; const updatedMessages = [...messagesForApi, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages, promptId: c.promptId || settings.currentPromptId } : c)); messagesForApi = updatedMessages; setUserInput(''); setSelectedImages([]); }
        if (messagesForApi.length === 0) return;
        setIsLoading(true); setError(''); abortControllerRef.current = new AbortController();
        try {
            const currentPrompt = (settings.prompts || []).find(p => p.id === currentConversation.promptId) || (settings.prompts || []).find(p => p.id === settings.currentPromptId) || DEFAULT_PROMPTS[0];
            const modelInfo = (settings.chatModels || []).find(m => m.value === settings.selectedModel) || (settings.chatModels || [])[0];
            const modelToUse = modelInfo.value;
            const contextLimit = modelInfo.maxContextTokens || 8192;
            const contextMessages = messagesForApi.slice(-contextLimit);
            let response;
            if (activeKey.provider === 'gemini') {
                const history = contextMessages.map(msg => { const parts = []; if (msg.content) parts.push({ text: msg.content }); if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } })); return { role: msg.role === 'user' ? 'user' : 'model', parts }; });
                const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ];
                const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens };
                if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) { generationConfig.thinkingConfig = { thinkingBudget: 0 }; }
                const url = `${activeKey.url || 'https://generativelanguage.googleapis.com/v1beta/models/'}${modelToUse}:generateContent?key=${activeKey.key}`;
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: abortControllerRef.current.signal });
            } else if (activeKey.provider === 'openai') {
                const messages = [ { role: 'system', content: currentPrompt.content }, ...contextMessages.map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })) ];
                const url = `${activeKey.url || 'https://api.openai.com/v1'}/chat/completions`;
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` }, body: JSON.stringify({ model: modelToUse, messages, temperature: settings.temperature, max_tokens: settings.maxOutputTokens, stream: false }), signal: abortControllerRef.current.signal });
            }
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (状态码: ${response.status})`); }
            const data = await response.json();
            let aiResponseContent;
            if (activeKey.provider === 'gemini') { aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text; } else { aiResponseContent = data.choices?.[0]?.message?.content; }
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            const aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), isTyping: true };
            const finalMessages = [...messagesForApi, aiMessage];
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } catch (err) {
            const finalMessages = [...messagesForApi];
            let errorMessage = `请求错误: ${err.message}`;
            if (err.name === 'AbortError') errorMessage = '请求被中断，请检查网络连接。';
            setError(errorMessage);
            finalMessages.push({ role: 'ai', content: `抱歉，出错了: ${errorMessage}`, timestamp: Date.now() });
            setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: finalMessages } : c));
        } finally { setIsLoading(false); }
    };
    const handleTypingComplete = useCallback(() => { setConversations(prev => prev.map(c => { if (c.id === currentConversationId) { const updatedMessages = c.messages.map((msg, index) => index === c.messages.length - 1 ? { ...msg, isTyping: false } : msg); return { ...c, messages: updatedMessages }; } return c; })); }, [currentConversationId]);

    if (!isMounted) { return <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><p className="ml-3 text-gray-500 dark:text-gray-400">正在加载...</p></div>; }
    const showSendButton = userInput.trim().length > 0 || selectedImages.length > 0;
    
    return (
        <div className="w-full h-full flex flex-col bg-transparent text-gray-800 dark:text-gray-200">
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100, zIndex: -1 }}></div>
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20" style={{ zIndex: -1 }}></div>
            <div className="relative flex flex-1 min-h-0">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onNew={() => createNewConversation()} prompts={settings.prompts} settings={settings} />
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-20 lg:hidden"></div> )}
                <div className="flex-1 flex flex-col h-full min-w-0">
                    <header className="flex items-center justify-between py-2 px-2 shrink-0 bg-white/40 dark:bg-black/20 backdrop-blur-lg shadow-sm border-b border-gray-200/50 dark:border-gray-800/50">
                        <div className="flex items-center gap-2">
                            <button onClick={onClose} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10" title="关闭"><i className="fas fa-times"></i></button>
                            <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10" title="切换对话列表"><i className="fas fa-bars"></i></button>
                        </div>
                        <div className="text-center flex-grow"> <h2 className="text-lg font-semibold truncate">{currentConversation?.title || '聊天'}</h2></div>
                        <div className="w-10 flex justify-end"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10" title="设置"><i className="fas fa-cog"></i></button> </div>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} onTypingUpdate={scrollToBottom} /> </div> ))}
                        </div>
                        <div ref={messagesEndRef} />
                    </main>
                    <footer className="flex-shrink-0 p-2 sm:p-4 pb-safe bg-gradient-to-t from-white/80 via-white/50 to-transparent dark:from-gray-800/80 dark:via-gray-800/50 z-10">
                        {error && <div className="mb-2 p-2 bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-lg text-center text-sm" onClick={()=>setError('')}>{error} <span className='text-xs'>(点击关闭)</span></div>}
                        {selectedImages.length > 0 && (<div className="max-w-3xl mx-auto mb-2 px-2"> <div className="flex items-center gap-2 overflow-x-auto p-1 bg-gray-200/50 dark:bg-gray-900/50 rounded-lg"> {selectedImages.map((img, index) => ( <div key={index} className="relative shrink-0"> <img src={img.previewUrl} alt={`preview ${index}`} className="w-16 h-16 object-cover rounded-md" /> <button onClick={() => removeSelectedImage(index)} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow-md">&times;</button> </div> ))} </div> </div>)}
                        <div className="flex items-center justify-center gap-2 mb-2 max-w-3xl mx-auto">
                           <button onClick={() => createNewConversation()} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),_0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 active:scale-95" title="新对话"> <i className="fas fa-plus mr-1"></i> <span>新对话</span> </button>
                           <button type="button" onClick={() => setShowModelSelector(true)} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),_0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 active:scale-95" title="切换模型"> <i className="fas fa-brain mr-1"></i> <span>模型</span> </button>
                           <button type="button" onClick={() => setShowAssistantSelector(true)} className="px-3 py-1.5 bg-white dark:bg-gray-700 rounded-full text-xs text-gray-700 dark:text-gray-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.7),_0_1px_3px_rgba(0,0,0,0.08)] dark:shadow-none hover:bg-gray-100 dark:hover:bg-gray-600 transition-all duration-200 active:scale-95" title="更换助理"> <i className="fas fa-user-tie mr-1"></i> <span>助理</span> </button>
                        </div>
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end w-full max-w-3xl mx-auto p-2 bg-white dark:bg-gray-700 backdrop-blur-sm rounded-2xl border border-gray-200/80 dark:border-gray-600/80 transition-shadow duration-300 ease-in-out hover:shadow-2xl focus-within:shadow-2xl shadow-[0_-10px_25px_rgba(0,0,0,0.05),_0_-5px_10px_rgba(0,0,0,0.04)]">
                            <input type="file" ref={imageInputRef} onChange={handleImageSelection} accept="image/*" multiple className="hidden" />
                             <div className="flex items-center flex-shrink-0 mr-1">
                                <button type="button" onClick={triggerImageInput} className="p-2 rounded-full hover:bg-gray-500/10 dark:hover:bg-white/10" title="选择图片"><i className="fas fa-image text-xl text-gray-500 dark:text-gray-400"></i></button>
                                <button type="button" onClick={triggerCameraInput} className="p-2 rounded-full hover:bg-gray-500/10 dark:hover:bg-white/10" title="拍照"><i className="fas fa-camera text-xl text-gray-500 dark:text-gray-400"></i></button>
                            </div>
                            <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } }} placeholder="与 AI 聊天..." className="flex-1 bg-transparent focus:outline-none text-gray-800 dark:text-gray-200 text-base resize-none overflow-hidden mx-2 py-1 leading-6 max-h-36 placeholder-gray-500 dark:placeholder-gray-400" rows="1" style={{minHeight:'2.5rem'}} />
                            <div className="flex items-center flex-shrink-0 ml-1">
                                {!showSendButton ? ( <button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isListening ? 'text-white bg-red-500 animate-pulse' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-500/10 dark:hover:bg-white/10'}`} title="语音输入"> <i className="fas fa-microphone text-xl"></i> </button> ) : ( <button type="submit" className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-lg shadow-blue-500/30 hover:bg-blue-700 disabled:opacity-50 transition-all duration-200 ease-in-out transform hover:scale-105 active:scale-95" disabled={isLoading}> <i className="fas fa-arrow-up text-xl"></i> </button> )}
                            </div>
                        </form>
                    </footer>
                </div>
                {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
                {showAssistantSelector && <AssistantSelector prompts={settings. prompts} settings={settings} onSelect={handleAssistantSelect} onClose={() => setShowAssistantSelector(false)} />}
                {showModelSelector && <ModelSelector settings={settings} onSelect={(modelValue) => { setSettings(s => ({...s, selectedModel: modelValue})); setShowModelSelector(false); }} onClose={() => setShowModelSelector(false)} />}
            </div>
        </div>
    );
};

// =================================================================================
// AIChatDrawer Component (The Wrapper)
// =================================================================================

/**
 * AI 聊天全屏抽屉组件
 * @param {boolean} isOpen - 是否打开
 * @param {function} onClose - 关闭时的回调函数
 */
const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className='fixed inset-0 z-50'>
        {/* 背景遮罩 */}
        <Transition.Child
          as={Fragment}
          enter='ease-in-out duration-300'
          enterFrom='opacity-0'
          enterTo='opacity-100'
          leave='ease-in-out duration-200'
          leaveFrom='opacity-100'
          leaveTo='opacity-0'
        >
          <div className='absolute inset-0 bg-black bg-opacity-30' />
        </Transition.Child>

        {/* 主内容面板 */}
        <Transition.Child
          as={Fragment}
          enter='transform transition ease-in-out duration-300'
          enterFrom='translate-y-full'
          enterTo='translate-y-0'
          leave='transform transition ease-in-out duration-200'
          leaveFrom='translate-y-0'
          leaveTo='translate-y-full'
        >
          {/* 这里是抽屉的容器，设置了背景色和flex布局 */}
          <div className='fixed inset-0 flex flex-col bg-white dark:bg-[#18171d]'>
            {/* 渲染完整的、自包含的 AI 聊天助手组件 */}
            {/* onClose 事件被传递给助手，用于处理内部的关闭按钮 */}
            <AiChatAssistant onClose={onClose} />
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

export default AIChatDrawer;

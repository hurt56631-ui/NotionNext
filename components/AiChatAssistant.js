// AIChatDrawer.js (最终终极版 - 富文本、划词工具、流式朗读、API修正)

import { Transition } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import imageCompression from 'browser-image-compression';
import { pinyin } from 'pinyin-pro'; // 需安装: npm install pinyin-pro
import AiTtsButton from './AiTtsButton';

// 1. 导入你的题型组件
import PaiXuTi from './Tixing/PaiXuTi';

// 2. 组件映射表
const componentMap = {
  PaiXuTi: PaiXuTi
};

// --- 工具函数 ---
const sanitizeQuizData = (props) => {
    // ... (保持原有逻辑不变)
    if (!props || !props.items || !props.correctOrder) return props;
    let items = [...props.items];
    const correctOrder = [...props.correctOrder];
    const punctuationRegex = /^[。，、？！；：“”‘’（）《》〈〉【】 .,!?;:"'()\[\]{}]+$/;
    const orphanPunctuationItems = items.filter(item => {
        const isPunctuation = punctuationRegex.test(item.content.trim());
        const isInCorrectOrder = correctOrder.includes(item.id);
        return isPunctuation && !isInCorrectOrder;
    });
    if (orphanPunctuationItems.length > 0 && correctOrder.length > 0) {
        const lastWordId = correctOrder[correctOrder.length - 1];
        let lastWordIndex = items.findIndex(item => item.id === lastWordId);
        if (lastWordIndex !== -1) {
            const newContent = orphanPunctuationItems.reduce((acc, puncItem) => acc + puncItem.content, items[lastWordIndex].content);
            items[lastWordIndex] = { ...items[lastWordIndex], content: newContent };
        }
        const orphanIds = new Set(orphanPunctuationItems.map(item => item.id));
        items = items.filter(item => !orphanIds.has(item.id));
    }
    return { ...props, items: items, correctOrder: correctOrder };
};

const convertGitHubUrl = (url) => { if (typeof url === 'string' && url.includes('github.com') && url.includes('/blob/')) { return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/'); } return url; };
const safeLocalStorageGet = (key) => { if (typeof window !== 'undefined') { return localStorage.getItem(key); } return null; };
const safeLocalStorageSet = (key, value) => { if (typeof window !== 'undefined') { localStorage.setItem(key, value); } };
const generateSimpleId = (prefix = 'id') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// --- 常量 ---
const TTS_ENGINE = { SYSTEM: 'system', THIRD_PARTY: 'third_party' };
const CHAT_MODELS_LIST = [
    { id: 'model-1', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 1048576 },
    { id: 'model-2', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 1048576 },
    { id: 'model-3', name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', maxContextTokens: 1048576 },
    { id: 'model-4', name: 'Gemini 1.5 Flash', value: 'gemini-1.5-flash-latest', maxContextTokens: 1048576 },
    { id: 'model-5', name: 'Gemini 1.5 Pro', value: 'gemini-1.5-pro-latest', maxContextTokens: 1048576 },
];

const DEFAULT_PROMPTS = [
    { id: 'default-grammar-correction', name: '纠正中文语法', description: '纠正语法、优化用词，并提供详细说明。', content: '你是一位专业的中文老师。请纠正用户发送的中文句子中的语法错误，并给出修改建议。输出格式请使用Markdown，关键修改处请加粗。', openingLine: '你好，请发送你需要我纠正的中文句子。', model: 'gemini-2.5-flash', ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' },
    { id: 'explain-word', name: '解释中文词语', description: '简单易懂地解释词语。', content: '你是一位中文老师。请用简单易懂的方式解释用户发送的中文词语，并提供例句。', openingLine: '你好，想了解哪个词？', model: 'gemini-1.5-pro-latest', ttsVoice: 'zh-CN-YunxiNeural', avatarUrl: '' },
    { id: 'translate-myanmar', name: '中缅互译', description: '中缅互译助手。', content: '你是一位翻译助手。请将用户发送的内容在中文和缅甸语之间互译。', openingLine: '你好！请发送内容进行翻译。', model: 'gemini-2.5-flash', ttsVoice: 'my-MM-NilarNeural', avatarUrl: '' }
];

const DEFAULT_SETTINGS = {
    apiKey: '', apiKeys: [], activeApiKeyId: '', chatModels: CHAT_MODELS_LIST, selectedModel: 'gemini-2.5-flash',
    temperature: 0.8, maxOutputTokens: 8192, disableThinkingMode: true, startWithNewChat: false, prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: true, voiceAutoSend: false,
    ttsEngine: TTS_ENGINE.THIRD_PARTY, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', ttsRate: 0, ttsPitch: 0, systemTtsVoiceURI: '', speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg-light.jpg', backgroundOpacity: 70,
    userAvatarUrl: 'https://raw.githubusercontent.com/Flipped-Development/images/main/user-avatar-default.png',
    aiAvatarUrl: 'https://raw.githubusercontent.com/Flipped-Development/images/main/gemini-sparkle-animated.gif',
    isFacebookApp: false,
};

const MICROSOFT_TTS_VOICES = [ { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' }, { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' }, { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' }, { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' }, { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' }, { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' }, { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' }, { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' }, { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' }, { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' }, { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' }, { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' }, { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' }, { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' }, { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' }, ];

// --- 【重构】流式朗读打字机效果 ---
const TypingEffect = ({ text, settings, onComplete, onUpdate }) => {
    const [displayedText, setDisplayedText] = useState('');
    const lastReadIndex = useRef(0);
    const synthRef = useRef(window.speechSynthesis);

    useEffect(() => {
        if (!text) return;
        setDisplayedText('');
        lastReadIndex.current = 0;
        let index = 0;

        const intervalId = setInterval(() => {
            // 更新显示的文本
            const char = text.charAt(index);
            setDisplayedText(prev => prev + char);
            index++;

            // --- 流式朗读核心逻辑 ---
            if (settings.autoRead) {
                // 检测句子结束符
                if (['。', '！', '？', '!', '?', '\n', '.', ';'].includes(char)) {
                    const sentence = text.substring(lastReadIndex.current, index).trim();
                    if (sentence.length > 1) { // 避免朗读空字符或符号
                         speakSentence(sentence, settings);
                    }
                    lastReadIndex.current = index;
                }
            }

            if (onUpdate && index % 2 === 0) onUpdate();

            if (index >= text.length) {
                clearInterval(intervalId);
                // 朗读剩余部分
                if (settings.autoRead && lastReadIndex.current < text.length) {
                    const remaining = text.substring(lastReadIndex.current);
                     if (remaining.trim().length > 0) speakSentence(remaining, settings);
                }
                if (onComplete) onComplete();
            }
        }, 20); // 打字速度

        return () => {
            clearInterval(intervalId);
            if (synthRef.current) synthRef.current.cancel(); // 组件卸载时停止朗读
        };
    }, [text, onComplete, onUpdate, settings]); // 移除 speakSentence 依赖，避免闭包问题

    return <RichMarkdown text={displayedText} />;
};

// 辅助朗读函数（不仅用于打字机，也用于划词）
const speakSentence = (text, settings) => {
    if (!text) return;
    const synth = window.speechSynthesis;
    // 如果正在读，加入队列，而不是取消（为了连贯性）
    // 但为了避免队列过长，可以做一个简单的管理，这里为了简化直接调 speak
    
    // 如果是微软语音，这里需要简单模拟，因为浏览器原生 API 不支持直接调微软云。
    // 这里使用原生 API 作为流式朗读的基础，因为流式调用云端 API 延迟会很高。
    // 如果用户非要用微软 TTS，建议只在最后读全文，或者接受一定延迟。
    // 这里的实现为了“低延迟”，优先使用浏览器 API 配合设置的语速。
    
    // *修正策略*：为了响应用户“延迟高”的抱怨，流式朗读阶段强制使用浏览器本地 TTS (System)，
    // 只有点击小喇叭时才用高质量的微软 TTS。或者我们尽量匹配本地声音。
    
    const u = new SpeechSynthesisUtterance(text);
    // 尝试匹配语言
    u.lang = settings.speechLanguage || 'zh-CN';
    u.rate = 1 + (settings.ttsRate / 100); 
    u.pitch = 1 + (settings.ttsPitch / 100);
    
    // 如果设置了系统声音，尝试使用
    if (settings.ttsEngine === TTS_ENGINE.SYSTEM && settings.systemTtsVoiceURI) {
        const voices = synth.getVoices();
        const v = voices.find(x => x.voiceURI === settings.systemTtsVoiceURI);
        if (v) u.voice = v;
    }
    
    synth.speak(u);
};


// --- 【重构】富文本渲染 (RichMarkdown) ---
const RichMarkdown = ({ text }) => {
    if (!text) return null;

    // 1. 代码块处理
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        // 添加代码块前的文本
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: text.substring(lastIndex, match.index) });
        }
        // 添加代码块
        parts.push({ type: 'code', lang: match[1], content: match[2] });
        lastIndex = codeBlockRegex.lastIndex;
    }
    // 添加剩余文本
    if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.substring(lastIndex) });
    }

    return (
        <div className="markdown-body">
            {parts.map((part, i) => {
                if (part.type === 'code') {
                    return (
                        <div key={i} className="my-3 rounded-lg overflow-hidden bg-[#282c34] text-gray-200 text-xs font-mono shadow-md">
                            <div className="flex justify-between items-center px-3 py-1 bg-[#21252b] border-b border-gray-600/50 text-gray-400">
                                <span>{part.lang || 'code'}</span>
                                <button onClick={() => navigator.clipboard.writeText(part.content)} className="hover:text-white"><i className="fas fa-copy"></i></button>
                            </div>
                            <pre className="p-3 overflow-x-auto m-0"><code>{part.content}</code></pre>
                        </div>
                    );
                }
                return <FormatText key={i} text={part.content} />;
            })}
        </div>
    );
};

// 格式化普通文本（标题、粗体、列表）
const FormatText = ({ text }) => {
    const lines = text.split('\n');
    return (
        <>
            {lines.map((line, idx) => {
                if (line.trim() === '') return <div key={idx} className="h-2"></div>;
                
                // 标题
                if (line.startsWith('### ')) return <h4 key={idx} className="text-base font-bold mt-3 mb-1 text-blue-600 dark:text-blue-400">{line.substring(4)}</h4>;
                if (line.startsWith('## ')) return <h3 key={idx} className="text-lg font-bold mt-4 mb-2 border-b border-gray-200 dark:border-gray-700 pb-1">{line.substring(3)}</h3>;
                if (line.startsWith('# ')) return <h2 key={idx} className="text-xl font-bold mt-5 mb-3">{line.substring(2)}</h2>;

                // 列表
                if (line.match(/^[-*]\s/)) return <li key={idx} className="ml-4 list-disc marker:text-gray-400">{parseInline(line.substring(2))}</li>;
                if (line.match(/^\d+\.\s/)) return <div key={idx} className="ml-4 flex gap-1"><span className="font-bold text-gray-500">{line.match(/^\d+\./)[0]}</span><span>{parseInline(line.replace(/^\d+\.\s/, ''))}</span></div>;
                
                // 引用
                if (line.startsWith('> ')) return <blockquote key={idx} className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 py-1 my-2 text-gray-500 italic bg-gray-50 dark:bg-gray-800 rounded-r">{parseInline(line.substring(2))}</blockquote>;

                return <p key={idx} className="my-1 leading-relaxed text-justify break-words">{parseInline(line)}</p>;
            })}
        </>
    );
};

// 解析行内样式 (粗体、代码片段)
const parseInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-bold text-gray-900 dark:text-gray-100">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-gray-200 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono text-red-500 dark:text-red-400 mx-1">{part.slice(1, -1)}</code>;
        return part;
    });
};

// --- 【新增】划词工具菜单 ---
const TextActionMenu = ({ containerRef }) => {
    const [menuStyle, setMenuStyle] = useState({ display: 'none', top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState('');
    const [pinyinResult, setPinyinResult] = useState('');

    const handleSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            // 计算相对于 container 的位置，如果 containerRef 不存在则相对于视口
            // 简单处理：使用 fixed 定位
            setMenuStyle({
                display: 'flex',
                top: rect.top - 50, // 显示在上方
                left: rect.left + (rect.width / 2) - 80, // 居中
            });
            setSelectedText(text);
            setPinyinResult(''); // 重置拼音
        } else {
            setMenuStyle({ display: 'none', top: 0, left: 0 });
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelection);
        return () => document.removeEventListener('mouseup', handleSelection);
    }, [handleSelection]);

    const handleSpeak = (e) => {
        e.preventDefault(); e.stopPropagation();
        const u = new SpeechSynthesisUtterance(selectedText);
        u.lang = 'zh-CN'; // 默认读中文
        window.speechSynthesis.speak(u);
    };

    const handlePinyin = (e) => {
        e.preventDefault(); e.stopPropagation();
        try {
            const res = pinyin(selectedText, { toneType: 'symbol', type: 'string' });
            setPinyinResult(res);
        } catch (err) {
            setPinyinResult('无法生成');
        }
    };

    const handleTranslate = (e) => {
        e.preventDefault(); e.stopPropagation();
        window.open(`https://glosbe.com/zh/en/${encodeURIComponent(selectedText)}`, '_blank');
        setMenuStyle({ ...menuStyle, display: 'none' }); // 关掉菜单
    };

    if (menuStyle.display === 'none') return null;

    return (
        <div 
            className="fixed z-50 bg-gray-900 text-white rounded-lg shadow-xl flex flex-col items-center p-1 animate-fade-in"
            style={{ top: menuStyle.top, left: menuStyle.left }}
            onMouseDown={(e) => e.preventDefault()} // 防止点击菜单时取消选区
        >
            <div className="flex gap-1">
                <button onClick={handleSpeak} className="p-2 hover:bg-gray-700 rounded transition-colors text-xs flex flex-col items-center min-w-[40px]">
                    <i className="fas fa-volume-up mb-1"></i> 朗读
                </button>
                <button onClick={handlePinyin} className="p-2 hover:bg-gray-700 rounded transition-colors text-xs flex flex-col items-center min-w-[40px]">
                    <i className="fas fa-font mb-1"></i> 拼音
                </button>
                <button onClick={handleTranslate} className="p-2 hover:bg-gray-700 rounded transition-colors text-xs flex flex-col items-center min-w-[40px]">
                    <i className="fas fa-language mb-1"></i> 翻译
                </button>
            </div>
            {pinyinResult && (
                <div className="border-t border-gray-700 mt-1 pt-1 px-2 pb-1 text-xs text-yellow-300 max-w-[200px] break-words text-center">
                    {pinyinResult}
                </div>
            )}
            {/* 三角箭头 */}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-900"></div>
        </div>
    );
};


// --- MessageBubble 组件 (更新) ---
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, onTypingComplete, onTypingUpdate, onCorrectionRequest, explicitAiAvatar }) => {
    const isUser = msg.role === 'user';
    const userBubbleClass = 'bg-blue-600 text-white rounded-2xl rounded-br-none shadow-md';
    const aiBubbleClass = 'bg-white dark:bg-gray-700 rounded-2xl rounded-tl-none border border-gray-100 dark:border-gray-600 shadow-sm';
    const isComponentMessage = msg.isComponent || false;

    // AI 头像优先使用助理自定义的，用户头像使用设置里的
    const avatarToShow = isUser ? settings.userAvatarUrl : (explicitAiAvatar || settings.aiAvatarUrl);

    return (
        <div className={`flex items-end gap-2.5 my-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(avatarToShow)} alt="AI" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-white object-cover" />}
            <div className={`p-3.5 text-left flex flex-col transition-shadow duration-300 ${isUser ? userBubbleClass : aiBubbleClass}`} style={{ maxWidth: '88%' }}>
                {msg.images && msg.images.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                        {msg.images.map((img, index) => {
                             // 优先使用 src (base64)，防止 URL 失效
                            const imgSrc = img.src || img.previewUrl;
                            return <img key={index} src={imgSrc} alt="附件" className="w-24 h-24 object-cover rounded-lg border border-white/20" />;
                        })}
                    </div>
                )}
                {isComponentMessage ? (
                    React.createElement(componentMap[msg.componentName], { ...msg.props, onCorrectionRequest: onCorrectionRequest })
                ) : (
                    <>
                        <div className={`prose prose-sm max-w-none ${isUser ? 'prose-invert text-white' : 'text-gray-900 dark:text-gray-100'}`}>
                            {isLastAiMessage && msg.isTyping ?
                                // 使用新的流式打字机组件
                                <TypingEffect text={msg.content || ''} settings={settings} onComplete={onTypingComplete} onUpdate={onTypingUpdate} /> :
                                // 使用新的富文本渲染组件
                                <RichMarkdown text={msg.content || ''} />
                            }
                        </div>
                        {!isUser && msg.content && !msg.isTyping && (
                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-gray-100 dark:border-gray-600/50 text-gray-400 dark:text-gray-500">
                                {!settings.isFacebookApp && (
                                    <div className="scale-90 origin-left">
                                        <AiTtsButton text={msg.content} ttsSettings={settings} />
                                    </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(msg.content); }} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" title="复制"><i className="fas fa-copy text-sm"></i></button>
                                {isLastAiMessage && (<button onClick={(e) => { e.stopPropagation(); onRegenerate(); }} className="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors" title="重新生成"><i className="fas fa-sync-alt text-sm"></i></button>)}
                            </div>
                        )}
                    </>
                )}
            </div>
            {isUser && <img src={convertGitHubUrl(avatarToShow)} alt="User" className="w-8 h-8 rounded-full shrink-0 shadow-sm bg-gray-200 object-cover" />}
        </div>
    );
};

// --- ThinkingIndicator (保持不变) ---
const ThinkingIndicator = ({ settings, aiAvatar }) => (
    <div className="flex items-end gap-2.5 my-4 justify-start">
        <img src={convertGitHubUrl(aiAvatar || settings.aiAvatarUrl)} alt="AI" className="w-8 h-8 rounded-full shrink-0 shadow-sm" />
        <div className="p-3 rounded-2xl rounded-tl-none bg-white dark:bg-gray-700 border border-gray-200/50 dark:border-gray-600/50 shadow-sm">
            <div className="flex items-center gap-1.5">
                <span className="block w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.3s]"></span>
                <span className="block w-2 h-2 bg-gray-400 rounded-full animate-pulse [animation-delay:-0.15s]"></span>
                <span className="block w-2 h-2 bg-gray-400 rounded-full animate-pulse"></span>
            </div>
        </div>
    </div>
);

// --- ChatSidebar, PromptManager, ModelManager, ApiKeyManager, SettingsModal 等组件 (保持逻辑，更新 UI) ---
// 为了篇幅，以下组件逻辑在前面版本基础上进行了特定增强

const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts, settings }) => {
    // ... (保持 State 逻辑)
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
            if (prompt) {
                if (!groups.has(promptId)) { groups.set(promptId, { prompt, conversations: [] }); }
                groups.get(promptId).conversations.push(conv);
            } else {
                uncategorized.push(conv);
            }
        });
        return { sortedGroups: Array.from(groups.values()), uncategorized };
    }, [conversations, prompts]);

    const renderConversationItem = (conv) => (
        <div key={conv.id} className={`group flex items-center p-3 rounded-xl cursor-pointer transition-all duration-200 ${currentId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate" onDoubleClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }}>
                {editingId === conv.id ? (
                    <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onBlur={() => handleSaveRename(conv.id)} onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(conv.id)} className="w-full bg-transparent p-0 border-b border-blue-500 focus:outline-none" autoFocus />
                ) : (
                    <span className={`text-sm font-medium ${currentId === conv.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>{conv.title}</span>
                )}
            </div>
            {currentId === conv.id && (
                <div className="flex items-center shrink-0 space-x-1 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); handleRename(conv.id, conv.title); }} className="p-1.5 rounded-full text-gray-400 hover:text-blue-500 hover:bg-blue-100 dark:hover:bg-blue-900/30"><i className="fas fa-pen text-xs"></i></button>
                    <button onClick={(e) => { e.stopPropagation(); if (window.confirm('确定删除此对话吗？')) onDelete(conv.id); }} className="p-1.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"><i className="fas fa-trash text-xs"></i></button>
                </div>
            )}
        </div>
    );

    return (
        <div className={`absolute lg:relative h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-72 shadow-2xl' : 'w-0'} overflow-hidden border-r border-gray-200 dark:border-gray-800`}>
            <div className="p-4">
                <button onClick={onNew} className="flex items-center justify-center w-full py-3 font-bold text-white bg-blue-600 rounded-xl shadow-lg shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">
                    <i className="fas fa-plus mr-2"></i> 新对话
                </button>
            </div>
            <div className="flex-grow overflow-y-auto px-3 pb-safe space-y-4">
                {groupedConversations.sortedGroups.map(({ prompt, conversations }) => (
                    <details key={prompt.id} className="group" open>
                        <summary className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                            <i className="fas fa-chevron-right text-[10px] transition-transform group-open:rotate-90"></i>
                            <img src={convertGitHubUrl(prompt.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt="" className="w-4 h-4 rounded-full object-cover" />
                            {prompt.name}
                        </summary>
                        <div className="space-y-1 mt-1 pl-2">{(conversations || []).map(renderConversationItem)}</div>
                    </details>
                ))}
                {groupedConversations.uncategorized.length > 0 && (
                    <details className="group" open>
                         <summary className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer list-none hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                           <i className="fas fa-chevron-right text-[10px] transition-transform group-open:rotate-90 mr-2"></i> 未分类
                        </summary>
                        <div className="space-y-1 mt-1 pl-2">{(groupedConversations.uncategorized || []).map(renderConversationItem)}</div>
                    </details>
                )}
            </div>
        </div>
    );
};

const SubPageWrapper = ({ title, onBack, onSave, children }) => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                <i className="fas fa-times"></i>
            </button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-20">{children}</div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky bottom-0 z-10 flex justify-end gap-3 pb-safe">
            <button onClick={onBack} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">返回</button>
            <button onClick={onSave} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-500/30 hover:bg-blue-700">保存设置</button>
        </div>
    </div>
);

const PromptManager = ({ prompts, onChange, onAdd, onDelete, settings }) => {
    // ... (保持 PromptManager 逻辑不变，代码复用)
    const handleAvatarUpload = async (file, promptId) => { try { const compressedFile = await imageCompression(file, { maxSizeMB: 0.5, maxWidthOrHeight: 512 }); const reader = new FileReader(); reader.onload = (e) => onChange(promptId, 'avatarUrl', e.target.result); reader.readAsDataURL(compressedFile); } catch (err) { alert('图片上传失败'); } };
    return (
        <>
            {(prompts || []).map(p => (
                <div key={p.id} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-200 dark:border-gray-600 space-y-3">
                    <div className="flex items-start gap-4">
                        <div className="relative shrink-0 group">
                            <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm bg-white" />
                            <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                                <i className="fas fa-camera text-white"></i>
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files[0] && handleAvatarUpload(e.target.files[0], p.id)} />
                            </label>
                        </div>
                        <div className="flex-grow space-y-2">
                            <input type="text" value={p.name} onChange={(e) => onChange(p.id, 'name', e.target.value)} className="w-full bg-transparent font-bold text-lg border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="助理名称" />
                            <input type="text" value={p.description || ''} onChange={(e) => onChange(p.id, 'description', e.target.value)} className="w-full bg-transparent text-sm text-gray-500 border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors" placeholder="一句话简介..." />
                        </div>
                        {!p.id.startsWith('default-') && <button onClick={() => onDelete(p.id)} className="p-2 text-gray-400 hover:text-red-500"><i className="fas fa-trash"></i></button>}
                    </div>
                    {p.id.startsWith('default-') ? (<div className="p-3 bg-gray-100 dark:bg-gray-600 rounded-xl text-xs text-gray-500 italic text-center">系统内置提示词，不可修改核心内容</div>) : (<textarea value={p.content} onChange={(e) => onChange(p.id, 'content', e.target.value)} placeholder="系统提示词..." className="w-full h-24 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none resize-none" />)}
                    <input type="text" value={p.openingLine || ''} onChange={(e) => onChange(p.id, 'openingLine', e.target.value)} placeholder="开场白..." className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl text-sm outline-none" />
                </div>
            ))}
            <button onClick={onAdd} className="w-full py-4 font-bold text-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border-2 border-dashed border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"><i className="fas fa-plus mr-2"></i> 创建新助理</button>
        </>
    );
};

const ModelManager = ({ models, onChange, onAdd, onDelete }) => ( <> {(models || []).map(m => ( <div key={m.id} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600 space-y-2"> <div className="flex items-center justify-between"> <input type="text" value={m.name} onChange={(e) => onChange(m.id, 'name', e.target.value)} placeholder="模型显示名称" className="font-semibold bg-transparent w-full text-lg" /> <button onClick={() => onDelete(m.id)} className="p-2 ml-2 text-sm text-red-500 rounded-full hover:bg-red-500/10"><i className="fas fa-trash"></i></button> </div> <div className="grid grid-cols-2 gap-2 text-sm"> <div> <label className="text-xs font-medium">模型值 (Value)</label> <input type="text" value={m.value} onChange={(e) => onChange(m.id, 'value', e.target.value)} placeholder="例如: gemini-1.5-pro-latest" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> <div> <label className="text-xs font-medium">最大上下文 (Tokens)</label> <input type="number" value={m.maxContextTokens} onChange={(e) => onChange(m.id, 'maxContextTokens', parseInt(e.target.value, 10) || 0)} placeholder="例如: 8192" className="w-full mt-1 px-2 py-1 bg-white dark:bg-gray-800 border dark:border-gray-500 rounded-md text-xs" /> </div> </div> </div> ))} <button onClick={onAdd} className="w-full mt-4 py-3 bg-blue-500 text-white rounded-md shrink-0 mb-20"><i className="fas fa-plus mr-2"></i>添加新模型</button> </> );

const ApiKeyManager = ({ apiKeys, activeApiKeyId, onChange, onAdd, onDelete, onSetActive }) => (
    <>
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
            <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2"><i className="fas fa-info-circle mr-2"></i>关于 API 接口</h4>
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                选择 "OpenAI 兼容" 可使用第三方中转 (如 open-gemini-api.deno.dev)，无需 VPN。
            </p>
        </div>
        
        {(apiKeys || []).map(k => (
            <div key={k.id} className={`p-4 rounded-xl border-2 transition-all duration-200 ${activeApiKeyId === k.id ? 'border-green-500 bg-green-50 dark:bg-green-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <select value={k.provider} onChange={(e) => onChange(k.id, 'provider', e.target.value)} className="font-bold bg-transparent text-gray-700 dark:text-gray-200 border-none outline-none">
                            <option value="gemini">Google 官方 (需VPN)</option>
                            <option value="openai">OpenAI 兼容 (第三方)</option>
                        </select>
                    </div>
                    <div className="flex gap-2">
                        {activeApiKeyId !== k.id && <button onClick={() => onSetActive(k.id)} className="px-3 py-1 text-xs font-bold text-green-600 bg-green-100 rounded-lg hover:bg-green-200">启用</button>}
                        <button onClick={() => onDelete(k.id)} className="p-2 text-red-400 hover:text-red-600"><i className="fas fa-trash"></i></button>
                    </div>
                </div>
                <div className="space-y-3">
                    <input type="password" value={k.key} onChange={(e) => onChange(k.id, 'key', e.target.value)} placeholder="输入 API Key (sk-...)" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                    {k.provider === 'openai' && (
                        // 修正：将 placeholder 设为你提供的 Deno 地址，提示用户
                        <input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="默认: https://open-gemini-api.deno.dev/v1/chat/completions" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" />
                    )}
                </div>
            </div>
        ))}
        <button onClick={onAdd} className="w-full py-4 font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"><i className="fas fa-plus mr-2"></i> 添加新密钥</button>
    </>
);

const SettingsModal = ({ settings, onSave, onClose }) => {
    // ... (保持 SettingsModal 逻辑)
    const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); const fileInputRef = useRef(null); const userAvatarInputRef = useRef(null); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); 
    const handleBgImageSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { handleChange('chatBackgroundUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; }; 
    const handleUserAvatarSelect = (event) => { const file = event.target.files[0]; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { handleChange('userAvatarUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; };
    const handleAddPrompt = () => { const newPrompt = { id: generateSimpleId('prompt'), name: '新助理', description: '新助理', content: '你是一个...', openingLine: '你好', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; const newPrompts = [...(tempSettings.prompts || []), newPrompt]; handleChange('prompts', newPrompts); }; const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; const handlePromptSettingChange = (promptId, field, value) => { const newPrompts = (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p); handleChange('prompts', newPrompts); }; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; const handleAddModel = () => { const newModel = { id: generateSimpleId('model'), name: '新模型', value: '', maxContextTokens: 8192 }; const newModels = [...(tempSettings.chatModels || []), newModel]; handleChange('chatModels', newModels); }; const handleDeleteModel = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newModels = (tempSettings.chatModels || []).filter(m => m.id !== idToDelete); handleChange('chatModels', newModels); }; const handleModelSettingChange = (modelId, field, value) => { const newModels = (tempSettings.chatModels || []).map(m => m.id === modelId ? { ...m, [field]: value } : m); handleChange('chatModels', newModels); }; 
    // 修正：添加 API Key 时，如果是 OpenAI，自动填入推荐的 URL
    const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), provider: 'openai', key: '', url: 'https://open-gemini-api.deno.dev/v1/chat/completions' }; const newKeys = [...(tempSettings.apiKeys || []), newKey]; handleChange('apiKeys', newKeys); if (newKeys.length === 1) { handleChange('activeApiKeyId', newKey.id); } }; 
    const handleDeleteApiKey = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== idToDelete); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === idToDelete) handleChange('activeApiKeyId', newKeys[0]?.id || ''); }; const handleApiKeySettingChange = (keyId, field, value) => { const newKeys = (tempSettings.apiKeys || []).map(k => k.id === keyId ? { ...k, [field]: value } : k); handleChange('apiKeys', newKeys); }; const handleSetActiveApiKey = (keyId) => { handleChange('activeApiKeyId', keyId); }; const handleSubPageSave = () => { onSave(tempSettings); }; 
    
    const MenuItem = ({ title, icon, onClick, color = "blue" }) => (
        <button type="button" onClick={onClick} className={`w-full flex items-center p-4 mb-3 rounded-2xl bg-${color}-50 dark:bg-gray-700/50 border border-${color}-100 dark:border-gray-600 hover:bg-${color}-100 dark:hover:bg-gray-600 transition-all shadow-sm active:scale-98`}>
            <div className={`w-10 h-10 rounded-full bg-white dark:bg-gray-600 flex items-center justify-center text-${color}-500 shadow-sm mr-4`}><i className={`fas ${icon} text-lg`}></i></div>
            <span className="text-lg font-bold text-gray-800 dark:text-white flex-grow text-left">{title}</span>
            <i className="fas fa-chevron-right text-gray-400"></i>
        </button>
    );

    return ( 
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in" onClick={onClose}> 
            <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden relative text-gray-800 dark:text-gray-200 h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}> 
                {view === 'main' && ( 
                    <div className="h-full flex flex-col"> 
                        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between shrink-0">
                            <h3 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">设置中心</h3>
                            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><i className="fas fa-times"></i></button>
                        </div>
                        <div className="flex-grow overflow-y-auto p-6 space-y-6"> 
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">账号与模型</h4>
                                <MenuItem title="API 密钥管理" icon="fa-key" onClick={() => setView('apiKeys')} color="green" />
                                <MenuItem title="助理工作室" icon="fa-user-astronaut" onClick={() => setView('prompts')} color="indigo" />
                                <MenuItem title="模型管理" icon="fa-brain" onClick={() => setView('models')} color="purple" />
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">语音与交互</h4>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl space-y-4">
                                     <div className="flex items-center justify-between">
                                        <label className="text-sm font-bold">语音合成引擎</label>
                                        <select value={tempSettings.ttsEngine} onChange={(e) => handleChange('ttsEngine', e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 outline-none">
                                            <option value={TTS_ENGINE.THIRD_PARTY}>Microsoft Edge (推荐)</option>
                                            <option value={TTS_ENGINE.SYSTEM}>系统内置</option>
                                        </select>
                                    </div>
                                    {tempSettings.ttsEngine === TTS_ENGINE.THIRD_PARTY && (<div><label className="block text-sm font-bold mb-2">选择发音人</label><select value={tempSettings.ttsVoice} onChange={(e) => handleChange('ttsVoice', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 outline-none">{MICROSOFT_TTS_VOICES.map(voice => <option key={voice.value} value={voice.value}>{voice.name}</option>)}</select></div>)}
                                     {tempSettings.ttsEngine === TTS_ENGINE.SYSTEM && (<div><label className="block text-sm font-bold mb-2">系统声音</label><select value={tempSettings.systemTtsVoiceURI} onChange={(e) => handleChange('systemTtsVoiceURI', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 outline-none"><option value="">默认</option>{systemVoices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{`${voice.name} (${voice.lang})`}</option>)}</select></div>)}
                                    <div className="flex gap-4"><div className="flex-1"><div className="flex justify-between mb-1"><label className="text-xs font-bold">语速</label><span className="text-xs">{tempSettings.ttsRate}%</span></div><input type="range" min="-100" max="100" step="5" value={tempSettings.ttsRate} onChange={(e) => handleChange('ttsRate', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/></div><div className="flex-1"><div className="flex justify-between mb-1"><label className="text-xs font-bold">音调</label><span className="text-xs">{tempSettings.ttsPitch}%</span></div><input type="range" min="-100" max="100" step="5" value={tempSettings.ttsPitch} onChange={(e) => handleChange('ttsPitch', parseInt(e.target.value, 10))} className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"/></div></div>
                                    <div><label className="block text-sm font-bold mb-2">语音识别语言</label><select value={tempSettings.speechLanguage} onChange={(e) => handleChange('speechLanguage', e.target.value)} className="w-full px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 outline-none">{speechLanguageOptions.map(o => <option key={o.value} value={o.value}>{o.name}</option>)}</select></div>
                                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-600 pt-3"><label className="text-sm font-bold">语音识别后自动发送</label><div className="relative inline-block w-12 mr-2 align-middle select-none"><input type="checkbox" checked={tempSettings.voiceAutoSend} onChange={(e) => handleChange('voiceAutoSend', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-green-500"/><div className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${tempSettings.voiceAutoSend ? 'bg-green-500' : 'bg-gray-300'}`}></div></div></div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">个性化</h4>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl space-y-4">
                                    <div><label className="block text-sm font-bold mb-2">用户头像</label><div className="flex gap-2 items-center"><img src={tempSettings.userAvatarUrl} alt="User" className="w-10 h-10 rounded-full object-cover border border-gray-200"/><input type="text" value={tempSettings.userAvatarUrl} onChange={(e) => handleChange('userAvatarUrl', e.target.value)} placeholder="头像 URL..." className="flex-1 px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 shadow-sm outline-none" /><button onClick={() => userAvatarInputRef.current?.click()} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-sm"><i className="fas fa-upload"></i></button><input type="file" ref={userAvatarInputRef} onChange={handleUserAvatarSelect} accept="image/*" className="hidden" /></div></div>
                                    <div><label className="block text-sm font-bold mb-2">聊天背景</label><div className="flex gap-2"><input type="text" value={tempSettings.chatBackgroundUrl} onChange={(e) => handleChange('chatBackgroundUrl', e.target.value)} placeholder="图片 URL..." className="flex-1 px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 shadow-sm outline-none" /><button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-sm"><i className="fas fa-image"></i></button><input type="file" ref={fileInputRef} onChange={handleBgImageSelect} accept="image/*" className="hidden" /></div></div>
                                    <div className="flex items-center gap-3"><span className="text-sm font-bold">透明度</span><input type="range" min="0" max="100" value={tempSettings.backgroundOpacity} onChange={(e) => handleChange('backgroundOpacity', parseInt(e.target.value, 10))} className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" /><span className="text-sm w-8">{tempSettings.backgroundOpacity}%</span></div>
                                    <div className="flex items-center justify-between"><label className="text-sm font-bold">每次打开开启新对话</label><div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in"><input type="checkbox" name="toggle" id="toggle-newchat" checked={tempSettings.startWithNewChat} onChange={(e) => handleChange('startWithNewChat', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-blue-500"/><label htmlFor="toggle-newchat" className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${tempSettings.startWithNewChat ? 'bg-blue-500' : 'bg-gray-300'}`}></label></div></div>
                                </div>
                            </div>
                        </div>
                        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md pb-safe"><button onClick={() => onSave(tempSettings)} className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/30 active:scale-95 transition-all">保存设置</button></div>
                    </div> 
                )} 
                {view === 'prompts' && <SubPageWrapper title="助理工作室" onBack={() => setView('main')} onSave={handleSubPageSave}><PromptManager prompts={tempSettings.prompts} settings={tempSettings} onChange={handlePromptSettingChange} onAdd={handleAddPrompt} onDelete={handleDeletePrompt} /></SubPageWrapper>} 
                {view === 'models' && <SubPageWrapper title="模型管理" onBack={() => setView('main')} onSave={handleSubPageSave}><ModelManager models={tempSettings.chatModels} onChange={handleModelSettingChange} onAdd={handleAddModel} onDelete={handleDeleteModel} /></SubPageWrapper>} 
                {view === 'apiKeys' && <SubPageWrapper title="API 密钥管理" onBack={() => setView('main')} onSave={handleSubPageSave}><ApiKeyManager apiKeys={tempSettings.apiKeys} activeApiKeyId={tempSettings.activeApiKeyId} onChange={handleApiKeySettingChange} onAdd={handleAddApiKey} onDelete={handleDeleteApiKey} onSetActive={handleSetActiveApiKey} /></SubPageWrapper>} 
            </div> 
        </div> 
    ); 
};

const ModelSelector = ({ settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 flex flex-col p-4 animate-fade-in" onClick={onClose}> <div className="w-full max-w-md m-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}> <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-center relative"> <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">切换模型</h3> <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><i className="fas fa-times"></i></button> </div> <div className="p-2 overflow-y-auto max-h-[60vh]"> {(settings.chatModels || []).map(m => ( <button key={m.id} type="button" onClick={() => { onSelect(m.value); onClose(); }} className={`w-full text-left px-4 py-3 text-sm rounded-lg hover:bg-blue-500/10 ${settings.selectedModel === m.value ? 'text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10' : 'text-gray-800 dark:text-gray-200'}`}>{m.name}</button> ))} </div> </div> </div> );

const AssistantSelector = ({ prompts, settings, onSelect, onClose }) => ( <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 flex items-end sm:items-center justify-center animate-fade-in" onClick={onClose}> <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}> <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center"> <h3 className="text-xl font-black text-gray-800 dark:text-gray-200">选择 AI 助理</h3> <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center"><i className="fas fa-times"></i></button> </div> <div className="p-4 space-y-3 overflow-y-auto pb-safe"> {(prompts || []).map(p => ( <button key={p.id} onClick={() => onSelect(p.id)} className={`w-full flex items-center p-4 rounded-2xl text-left transition-all border ${settings.currentPromptId === p.id ? 'bg-blue-50 border-blue-500/30 shadow-md ring-1 ring-blue-500 dark:bg-blue-900/20' : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-gray-50 dark:bg-gray-700/50 dark:border-gray-600'}`}> <img src={convertGitHubUrl(p.avatarUrl) || convertGitHubUrl(settings.aiAvatarUrl)} alt={p.name} className="w-14 h-14 rounded-2xl object-cover mr-4 shrink-0 shadow-sm bg-gray-100"/> <div className="flex-grow min-w-0"> <div className="flex items-center justify-between mb-1"> <h4 className={`font-bold text-lg truncate ${settings.currentPromptId === p.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-800 dark:text-gray-200'}`}>{p.name}</h4> {settings.currentPromptId === p.id && <i className="fas fa-check-circle text-blue-600 text-lg"></i>} </div> <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-snug">{p.description || '暂无简介'}</p> </div> </button> ))} </div> </div> </div> );

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
    const handleSubmitRef = useRef();
    const assistantContainerRef = useRef(null); // 用于划词定位

    useEffect(() => { setIsMounted(true); let finalSettings = { ...DEFAULT_SETTINGS }; const savedSettings = safeLocalStorageGet('ai_chat_settings'); if (savedSettings) { const parsed = JSON.parse(savedSettings); if (parsed.thirdPartyTtsConfig) { parsed.ttsVoice = parsed.thirdPartyTtsConfig.microsoftVoice || DEFAULT_SETTINGS.ttsVoice; delete parsed.thirdPartyTtsConfig; } parsed.prompts = (parsed.prompts || []).map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || DEFAULT_SETTINGS.ttsVoice, avatarUrl: p.avatarUrl || '', description: p.description || '' })); if (!parsed.chatModels || parsed.chatModels.length === 0) { parsed.chatModels = CHAT_MODELS_LIST; } if (!parsed.apiKeys) { parsed.apiKeys = []; } finalSettings = { ...DEFAULT_SETTINGS, ...parsed }; } if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) { finalSettings.isFacebookApp = true; } setSettings(finalSettings); const savedConversations = safeLocalStorageGet('ai_chat_conversations'); const parsedConvs = savedConversations ? JSON.parse(savedConversations) : []; setConversations(parsedConvs); if (finalSettings.startWithNewChat || parsedConvs.length === 0) { createNewConversation(finalSettings.currentPromptId, true); } else { const firstConv = parsedConvs[0]; setCurrentConversationId(firstConv.id); } }, []);
    
    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    
    const activePromptInfo = useMemo(() => {
        if (!currentConversation) return null;
        return (settings.prompts || []).find(p => p.id === currentConversation.promptId);
    }, [currentConversation, settings.prompts]);
    const displayAiAvatar = activePromptInfo?.avatarUrl || settings.aiAvatarUrl;

    useEffect(() => { if (!isMounted) return; const timer = setTimeout(() => { safeLocalStorageSet('ai_chat_settings', JSON.stringify(settings)); safeLocalStorageSet('ai_chat_conversations', JSON.stringify(conversations)); }, 1000); return () => clearTimeout(timer); }, [settings, conversations, isMounted]);
    const scrollToBottom = useCallback((behavior = 'smooth') => { messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' }); }, []);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('auto'), 100); return () => clearTimeout(timeout); }, [currentConversationId, scrollToBottom]);
    useEffect(() => { const timeout = setTimeout(() => scrollToBottom('smooth'), 100); return () => clearTimeout(timeout); }, [currentConversation?.messages?.length]);
    
    const adjustTextareaHeight = useCallback(() => { if (textareaRef.current) { textareaRef.current.style.height = 'auto'; textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; } }, []);
    useEffect(() => { adjustTextareaHeight(); }, [userInput, adjustTextareaHeight]);
    const createNewConversation = (promptId, isInitial = false) => { const newId = generateSimpleId('conv'); const currentPrompt = (settings.prompts || []).find(p => p.id === (promptId || settings.currentPromptId)) || DEFAULT_PROMPTS[0]; const newConv = { id: newId, title: '新的对话', messages: [{ role: 'ai', content: currentPrompt.openingLine || '你好！有什么可以帮助你的吗？', timestamp: Date.now() }], promptId: currentPrompt.id }; setConversations(prev => [newConv, ...prev]); setCurrentConversationId(newId); };
    const handleSelectConversation = (id) => { setCurrentConversationId(id); };
    const handleDeleteConversation = (id) => { const remaining = conversations.filter(c => c.id !== id); setConversations(remaining); if (currentConversationId === id) { if (remaining.length > 0) { handleSelectConversation(remaining[0].id); } else { createNewConversation(); } } };
    const handleRenameConversation = (id, newTitle) => { setConversations(prev => prev.map(c => c.id === id ? { ...c, title: newTitle } : c)); };
    const handleSaveSettings = (newSettings) => { setSettings(newSettings); setShowSettings(false); };
    
    const handleAssistantSelect = (promptId) => { 
        const selectedPrompt = settings.prompts.find(p => p.id === promptId); 
        if (!selectedPrompt) return; 
        setSettings(s => ({ ...s, currentPromptId: promptId, selectedModel: selectedPrompt.model || s.selectedModel, ttsVoice: selectedPrompt.ttsVoice || s.ttsVoice })); 
        setConversations(prevConvs => prevConvs.map(c => c.id === currentConversationId ? { ...c, promptId: promptId } : c)); 
        setShowAssistantSelector(false); 
    };

    const startListening = useCallback(() => { 
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; 
        if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } 
        if (recognitionRef.current) { recognitionRef.current.abort(); } 
        const recognition = new SpeechRecognition(); 
        recognition.lang = settings.speechLanguage; 
        recognition.interimResults = true; 
        recognition.continuous = false; 
        recognitionRef.current = recognition; 
        recognition.onstart = () => { setIsListening(true); setUserInput(''); }; 
        recognition.onresult = (event) => { 
            const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join(''); 
            setUserInput(transcript); 
            if (event.results[0].isFinal && transcript.trim()) { 
                recognition.stop(); 
                if (settings.voiceAutoSend && handleSubmitRef.current) { 
                    handleSubmitRef.current(false, transcript); 
                } 
            } 
        }; 
        recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); if (event.error !== 'no-speech') { setError(`语音识别错误: ${event.error}`); } if (event.error === 'aborted') return; }; 
        recognition.onend = () => { setIsListening(false); recognitionRef.current = null; }; 
        recognition.start(); 
    }, [settings.speechLanguage, settings.voiceAutoSend, setError]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); } }, []);

    const handleImageSelection = async (event) => {
        const files = Array.from(event.target.files);
        if (files.length === 0) return;
        const imagePromises = files.slice(0, 4 - selectedImages.length).map(async file => {
            try {
                const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true, };
                const compressedFile = await imageCompression(file, options);
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const base64Data = e.target.result.split(',')[1];
                        const fullDataUrl = `data:${compressedFile.type};base64,${base64Data}`;
                        const newImage = { previewUrl: URL.createObjectURL(compressedFile), src: fullDataUrl, data: base64Data, type: compressedFile.type, name: compressedFile.name };
                        resolve(newImage);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(compressedFile);
                });
            } catch (error) { console.error(error); return null; }
        });
        const newImages = (await Promise.all(imagePromises)).filter(Boolean);
        setSelectedImages(prev => [...prev, ...newImages]);
        event.target.value = null;
    };

    const triggerImageInput = () => { if (imageInputRef.current) { imageInputRef.current.removeAttribute('capture'); imageInputRef.current.click(); } };
    const triggerCameraInput = () => { if (imageInputRef.current) { imageInputRef.current.setAttribute('capture', 'environment'); imageInputRef.current.click(); } };
    const removeSelectedImage = (index) => { const imageToRemove = selectedImages[index]; if (imageToRemove) { URL.revokeObjectURL(imageToRemove.previewUrl); } setSelectedImages(prev => prev.filter((_, i) => i !== index)); };
    const handleCorrectionRequest = (correctionPrompt) => { if (!currentConversation || isLoading) return; const userMessage = { role: 'user', content: correctionPrompt, timestamp: Date.now() }; const updatedMessages = [...currentConversation.messages, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages } : c)); fetchAiResponse(updatedMessages); };
    
    // 修复：兼容 OpenAI 第三方接口 URL
    const fetchAiResponse = async (messagesForApi) => {
        setIsLoading(true);
        setError('');
        abortControllerRef.current = new AbortController();
        const activeKey = (settings.apiKeys || []).find(k => k.id === settings.activeApiKeyId);
        try {
            if (!activeKey || !activeKey.key) { throw new Error('请在设置中配置并激活一个有效的 API 密钥。'); }
            
            const promptIdToUse = currentConversation.promptId || settings.currentPromptId;
            const currentPrompt = (settings.prompts || []).find(p => p.id === promptIdToUse) || DEFAULT_PROMPTS[0];
            const modelInfo = (settings.chatModels || []).find(m => m.value === settings.selectedModel) || (settings.chatModels || [])[0];
            const modelToUse = modelInfo.value;
            const contextLimit = modelInfo.maxContextTokens || 1048576; 
            const contextMessages = messagesForApi.slice(-contextLimit);
            
            let response;
            if (activeKey.provider === 'gemini') { 
                const history = contextMessages.filter(msg => msg.content || (msg.images && msg.images.length > 0)).map(msg => { const parts = []; if (msg.content) parts.push({ text: msg.content }); if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } })); return { role: msg.role === 'user' ? 'user' : 'model', parts }; }); 
                const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ]; 
                const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens }; 
                if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) { generationConfig.thinkingConfig = { thinkingBudget: 0 }; } 
                const url = `${activeKey.url || 'https://generativelanguage.googleapis.com/v1beta/models/'}${modelToUse}:generateContent?key=${activeKey.key}`; 
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: abortControllerRef.current.signal }); 
            } else if (activeKey.provider === 'openai') { 
                const messages = [ { role: 'system', content: currentPrompt.content }, ...contextMessages.filter(msg => msg.content).map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })) ]; 
                // 关键修复：强制使用用户设置的 URL，如果未设置则使用默认推荐的 Deno 代理
                let baseUrl = activeKey.url || 'https://open-gemini-api.deno.dev/v1/chat/completions';
                baseUrl = baseUrl.trim().replace(/\/+$/, '');
                // 智能检测是否需要追加 /chat/completions
                const url = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` }, body: JSON.stringify({ model: modelToUse, messages, temperature: settings.temperature, max_tokens: settings.maxOutputTokens, stream: false }), signal: abortControllerRef.current.signal }); 
            }
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (状态码: ${response.status})`); }
            const data = await response.json();
            let aiResponseContent;
            if (activeKey.provider === 'gemini') { aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text; } else { aiResponseContent = data.choices?.[0]?.message?.content; }
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            let aiMessage;
            try { const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/); let parsed = null; if (jsonMatch) { try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {} } if (parsed && parsed.component && parsed.props && componentMap[parsed.component]) { const sanitizedProps = sanitizeQuizData(parsed.props); aiMessage = { role: 'ai', content: null, timestamp: Date.now(), isComponent: true, componentName: parsed.component, props: sanitizedProps, isTyping: false }; } else { throw new Error("Not a component JSON"); } } catch(e) { aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), isTyping: true }; }
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
    
    const handleSubmit = async (isRegenerate = false, textToSend = null) => { if (!currentConversation) return; let messagesForApi = [...currentConversation.messages]; if (isRegenerate) { if (messagesForApi.length > 0 && messagesForApi[messagesForApi.length - 1].role === 'ai') { messagesForApi.pop(); } } else { const textToProcess = (textToSend !== null ? textToSend : userInput).trim(); if (!textToProcess && selectedImages.length === 0) { setError('请输入文字或添加图片后再发送！'); return; } const userMessage = { role: 'user', content: textToProcess, images: selectedImages, timestamp: Date.now() }; messagesForApi = [...messagesForApi, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: messagesForApi } : c)); setUserInput(''); setSelectedImages([]); } await fetchAiResponse(messagesForApi); };
    handleSubmitRef.current = handleSubmit;
    const handleTypingComplete = useCallback(() => { setConversations(prev => prev.map(c => { if (c.id === currentConversationId) { const updatedMessages = c.messages.map((msg, index) => index === c.messages.length - 1 ? { ...msg, isTyping: false } : msg); return { ...c, messages: updatedMessages }; } return c; })); }, [currentConversationId]);

    if (!isMounted) { return <div className="w-full h-full flex items-center justify-center bg-white dark:bg-gray-800"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><p className="ml-3 text-gray-500 dark:text-gray-400">正在加载...</p></div>; }
    const showSendButton = userInput.trim().length > 0 || selectedImages.length > 0;
    
    return (
        <div ref={assistantContainerRef} className="w-full h-full flex flex-col bg-transparent text-gray-800 dark:text-gray-200 relative">
             {/* 划词工具栏 (全局) */}
            <TextActionMenu containerRef={assistantContainerRef} />
            
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100, zIndex: -1 }}></div>
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20" style={{ zIndex: -1 }}></div>
            <div className="relative flex flex-1 min-h-0">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onNew={() => createNewConversation()} prompts={settings.prompts} settings={settings} />
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-20 lg:hidden"></div> )}
                <div className="flex-1 flex flex-col h-full min-w-0">
                    <header className="flex items-center justify-between py-2 px-2 shrink-0 bg-white/40 dark:bg-black/20 backdrop-blur-lg shadow-sm border-b border-gray-200/50 dark:border-gray-800/50">
                        <div className="flex items-center gap-2">
                            <button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95" title="切换对话列表"><i className="fas fa-bars text-xl"></i></button>
                        </div>
                        <div className="text-center flex-grow overflow-hidden px-2"> 
                            <h2 className="text-lg font-bold truncate">{currentConversation?.title || 'AI 聊天'}</h2>
                        </div>
                        <div className="w-10 flex justify-end"> <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95" title="设置"><i className="fas fa-cog text-xl"></i></button> </div>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} onTypingUpdate={scrollToBottom} onCorrectionRequest={handleCorrectionRequest} explicitAiAvatar={displayAiAvatar} /> </div> ))}
                            {isLoading && !currentConversation?.messages.some(m => m.isTyping) && <ThinkingIndicator settings={settings} aiAvatar={displayAiAvatar} />}
                        </div>
                        <div ref={messagesEndRef} />
                    </main>
                    <footer className="flex-shrink-0 p-3 pb-safe bg-gradient-to-t from-white/95 via-white/80 to-transparent dark:from-gray-900/95 dark:via-gray-900/80 z-10">
                        {error && <div className="mb-2 p-3 bg-red-100 text-red-800 dark:bg-red-900/80 dark:text-red-200 rounded-xl text-center text-sm shadow-sm" onClick={()=>setError('')}>{error} <span className='ml-2 text-xs opacity-70'>(点击关闭)</span></div>}
                        {selectedImages.length > 0 && (<div className="max-w-3xl mx-auto mb-3"> <div className="flex items-center gap-3 overflow-x-auto p-2 bg-gray-100/80 dark:bg-gray-800/80 rounded-2xl backdrop-blur-sm border border-white/20"> {selectedImages.map((img, index) => ( <div key={index} className="relative shrink-0 group"> <img src={img.previewUrl} alt={`preview ${index}`} className="w-16 h-16 object-cover rounded-xl shadow-sm" /> <button onClick={() => removeSelectedImage(index)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-md scale-90 hover:scale-100 transition-transform">&times;</button> </div> ))} </div> </div>)}
                        <div className="flex items-center justify-center gap-3 mb-3 max-w-3xl mx-auto overflow-x-auto py-1">
                           <button onClick={() => createNewConversation()} className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 transition-all whitespace-nowrap"> <i className="fas fa-plus mr-1.5 text-blue-500"></i>新对话 </button>
                           <button type="button" onClick={() => setShowModelSelector(true)} className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 transition-all whitespace-nowrap"> <i className="fas fa-brain mr-1.5 text-purple-500"></i>模型 </button>
                           <button type="button" onClick={() => setShowAssistantSelector(true)} className="px-4 py-2 bg-white/90 dark:bg-gray-800/90 rounded-full text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm border border-gray-200 dark:border-gray-700 active:scale-95 transition-all whitespace-nowrap"> <i className="fas fa-user-astronaut mr-1.5 text-indigo-500"></i>助理 </button>
                        </div>
                        <form onSubmit={(e)=>{e.preventDefault();handleSubmit(false)}} className="flex items-end w-full max-w-3xl mx-auto p-2 bg-white dark:bg-gray-800 rounded-[28px] border border-gray-200 dark:border-gray-700 shadow-lg focus-within:ring-2 focus-within:ring-blue-500/50 transition-all">
                            <input type="file" ref={imageInputRef} onChange={handleImageSelection} accept="image/*" multiple className="hidden" />
                             <div className="flex items-center flex-shrink-0 pl-1 mb-1">
                                <button type="button" onClick={triggerImageInput} className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="图片"><i className="fas fa-image text-xl"></i></button>
                            </div>
                            <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } }} placeholder={isListening ? "正在聆听..." : "发送消息..."} className="flex-1 bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 text-[16px] resize-none overflow-hidden px-2 py-3 leading-relaxed max-h-32 placeholder-gray-400" rows="1" style={{minHeight:'48px'}} readOnly={isListening} />
                            <div className="flex items-center flex-shrink-0 pr-1 mb-1 gap-1">
                                {!showSendButton ? ( <button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`} title="语音"> <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} text-xl`}></i> </button> ) : ( <button type="submit" className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 active:scale-90 transition-all" disabled={isLoading}> <i className="fas fa-arrow-up text-lg font-bold"></i> </button> )}
                            </div>
                        </form>
                    </footer>
                </div>
                {showSettings && <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />}
                {showAssistantSelector && <AssistantSelector prompts={settings.prompts} settings={settings} onSelect={handleAssistantSelect} onClose={() => setShowAssistantSelector(false)} />}
                {showModelSelector && <ModelSelector settings={settings} onSelect={(modelValue) => { setSettings(s => ({...s, selectedModel: modelValue})); setShowModelSelector(false); }} onClose={() => setShowModelSelector(false)} />}
            </div>
        </div>
    );
};

const AIChatDrawer = ({ isOpen, onClose }) => {
  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <div className='fixed inset-0 z-50'>
        <Transition.Child as={Fragment} enter='ease-in-out duration-300' enterFrom='opacity-0' enterTo='opacity-100' leave='ease-in-out duration-200' leaveFrom='opacity-100' leaveTo='opacity-0'>
          <div className='absolute inset-0 bg-black bg-opacity-40 backdrop-blur-sm' />
        </Transition.Child>
        <Transition.Child as={Fragment} enter='transform transition ease-in-out duration-300' enterFrom='translate-y-full' enterTo='translate-y-0' leave='transform transition ease-in-out duration-200' leaveFrom='translate-y-0' leaveTo='translate-y-full'>
          <div className='fixed inset-0 flex flex-col bg-white dark:bg-[#18171d]'>
            <AiChatAssistant onClose={onClose} />
          </div>
        </Transition.Child>
      </div>
    </Transition.Root>
  )
}

export default AIChatDrawer;

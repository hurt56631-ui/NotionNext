// AIChatDrawer.js (完整版 - 集成选择题与排序题)

import { Transition } from '@headlessui/react'
import React, { useState, useEffect, useRef, useCallback, useMemo, Fragment } from 'react';
import imageCompression from 'browser-image-compression';
import { pinyin } from 'pinyin-pro'; 
import { v4 as uuidv4 } from 'uuid'; 
import AiTtsButton from './AiTtsButton';

// 1. 导入你的题型组件 (新增 XuanZeTi)
import PaiXuTi from './Tixing/PaiXuTi';
import XuanZeTi from './Tixing/XuanZeTi'; // <--- 假设你的选择题组件在这里

// 2. 组件映射表 (新增 XuanZeTi)
const componentMap = {
  PaiXuTi: PaiXuTi,
  XuanZeTi: XuanZeTi // <--- 注册组件
};

// --- [核心工具类] 增强版音频播放队列 ---
class AudioQueue {
    constructor() {
        this.queue = [];
        this.isPlaying = false;
        this.currentAudio = null;
    }
    add(audioBlobUrl) { this.queue.push(audioBlobUrl); this.process(); }
    process() {
        if (this.isPlaying || this.queue.length === 0) return;
        this.isPlaying = true;
        const audioUrl = this.queue.shift();
        this.currentAudio = new Audio(audioUrl);
        this.currentAudio.onended = () => { this.isPlaying = false; URL.revokeObjectURL(audioUrl); this.currentAudio = null; this.process(); };
        this.currentAudio.onerror = () => { this.isPlaying = false; URL.revokeObjectURL(audioUrl); this.currentAudio = null; this.process(); };
        this.currentAudio.play().catch(() => { this.isPlaying = false; this.process(); });
    }
    clear() {
        if (this.currentAudio) { this.currentAudio.pause(); this.currentAudio.src = ''; this.currentAudio = null; }
        this.queue.forEach(url => URL.revokeObjectURL(url)); 
        this.queue = [];
        this.isPlaying = false;
    }
}
const globalAudioQueue = new AudioQueue();


// --- [核心工具函数] 微软 Edge TTS 接口调用 ---
const fetchEdgeTTS = async (text, voice, rate, pitch) => {
    try {
        const rateStr = rate >= 0 ? `+${rate}%` : `${rate}%`;
        const pitchStr = pitch >= 0 ? `+${pitch}Hz` : `${pitch}Hz`;
        const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'><voice name='${voice}'><prosody pitch='${pitchStr}' rate='${rateStr}'>${text}</prosody></voice></speak>`;
        const url = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;
        const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/ssml+xml', 'X-Edge-TTS-Client': 'Microsoft Edge' }, body: ssml });
        if (!response.ok) throw new Error(`TTS Error: ${response.status}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error) { console.error("Edge TTS Fetch Error:", error); return null; }
};


// --- 数据清洗与工具函数 ---
const sanitizeQuizData = (props) => {
    // 如果不是排序题 (没有 correctOrder)，直接返回原 props (针对选择题)
    if (!props || !props.correctOrder) return props;
    
    // 下面是针对排序题 (PaiXuTi) 的清洗逻辑
    let items = [...(props.items || [])];
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

// --- [Prompt 更新] 增加了选择题的指令 ---
const DEFAULT_PROMPTS = [
    { 
        id: 'mm-cn-teacher-default', 
        name: '中文老师 (缅甸语教学)', 
        description: '用缅甸语解释中文，会自动出排序题或选择题。', 
        // 核心修改：增加了 Choice Question (XuanZeTi) 的模版说明
        content: `你是一位专业的中文老师，专门教缅甸学生学习中文。

**1. 聊天与教学规则：**
- **语言：** 请主要使用**缅甸语**来解释中文概念，但中文例句保持中文。
- **格式（富文本）：** 
  - 解释重点词汇时，请使用 **加粗** (Bold)。
  - 列举要点时，请使用列表 (List)。
  - 展示例句时，请使用 > 引用块。
- **拼音：** 只要提到中文生词，**必须**标注拼音。

**2. 互动出题规则（非常重要）：**
当用户说“练习”、“做题”、“测试”时，你可以随机选择出**排序题 (PaiXuTi)** 或 **选择题 (XuanZeTi)**。
**不要**直接输出文本题目，**务必**输出以下 JSON 格式（不要包裹markdown代码块）：

**格式 A：选择题 (XuanZeTi) 模版**
{
  "component": "XuanZeTi",
  "props": {
    "question": "ပုံမှန် သူငယ်ချင်းချင်း တွေ့တဲ့အခါ ဘယ်လို နှုတ်ဆက်လေ့ရှိလဲ။",
    "choices": [
      { "id": "A", "text": "你好" },
      { "id": "B", "text": "您好" },
      { "id": "C", "text": "谢谢" }
    ],
    "correctId": "A",
    "explanation": "သူငယ်ချင်းချင်းဆိုရင် ပေါ့ပေါ့ပါးပါး “你好”  လို့ပဲ သုံးပါတယ်။"
  }
}

**格式 B：排序题 (PaiXuTi) 模版**
{
  "component": "PaiXuTi",
  "props": {
    "question": "请将下面的词语连成一句话 (Sentense Ordering)：",
    "items": [
      { "id": "w1", "content": "我" },
      { "id": "w2", "content": "爱" },
      { "id": "w3", "content": "中国" }
    ],
    "correctOrder": ["w1", "w2", "w3"],
    "explanation": "中文的主谓宾结构：我(Subject) + 爱(Verb) + 中国(Object)。"
  }
}`, 
        openingLine: 'မင်္ဂလာပါ! (你好！) 我是你的中文老师。我们可以练习对话，或者你可以对我说 "做个练习" 来测试一下。', 
        model: 'gemini-2.5-flash', 
        ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', 
        avatarUrl: '' 
    },
    { 
        id: 'translate-myanmar', 
        name: '中缅互译助手', 
        description: '精确的中缅互译。', 
        content: '你是一位翻译助手。请将用户发送的内容在中文和缅甸语之间互译。请直接输出翻译结果，不需要过多解释。', 
        openingLine: '你好！请发送内容，我来翻译。', 
        model: 'gemini-2.5-flash', 
        ttsVoice: 'my-MM-NilarNeural', 
        avatarUrl: '' 
    },
    { 
        id: 'grammar-check', 
        name: '语法纠正', 
        description: '纠正中文语法错误。', 
        content: '你是一位严厉的中文老师。请纠正用户发送的中文句子中的语法错误。\n\n**要求**：\n- 使用 **Markdown** 格式。\n- 错误的地方用 `代码块` 标记。\n- 使用缅甸语解释错误原因。', 
        openingLine: '请发送你的中文句子，我来帮你检查语法。', 
        model: 'gemini-2.5-flash', 
        ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', 
        avatarUrl: '' 
    }
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


// --- [核心功能] 预合成+缓存的流式朗读打字机 ---
const TypingEffect = ({ text, settings, onComplete, onUpdate }) => {
    const [displayedText, setDisplayedText] = useState('');
    const sentences = useMemo(() => text?.match(/[^。！？\n]+[。！？\n]?/g) || [], [text]);
    const audioCache = useRef(new Map());

    // 1. 预合成音频
    useEffect(() => {
        if (!settings.autoRead || sentences.length === 0) return;
        
        // 清理旧缓存和队列
        audioCache.current.clear();
        globalAudioQueue.clear();

        const prefetchAudio = async () => {
            const promises = sentences.map(async (sentence, index) => {
                const cleanText = sentence.replace(/[*#`>]/g, '').trim();
                if (cleanText) {
                    let audioUrl;
                    if (settings.ttsEngine === TTS_ENGINE.THIRD_PARTY) {
                        audioUrl = await fetchEdgeTTS(cleanText, settings.ttsVoice, settings.ttsRate, settings.ttsPitch);
                    } else {
                        // 系统语音无需预合成，创建一个标记
                        audioUrl = `system:${cleanText}`;
                    }
                    if (audioUrl) audioCache.current.set(index, audioUrl);
                }
            });
            await Promise.all(promises);
        };
        prefetchAudio();

    }, [sentences, settings]);

    // 2. 打字并播放缓存的音频
    useEffect(() => {
        if (sentences.length === 0) {
             if (onComplete) onComplete();
             return;
        };

        let charIndex = 0;
        let sentenceIndex = 0;
        
        const intervalId = setInterval(() => {
            setDisplayedText(text.substring(0, charIndex + 1));
            
            // 检查是否打完一句
            const currentTypedLength = charIndex + 1;
            const endOfCurrentSentence = sentences.slice(0, sentenceIndex + 1).join('').length;

            if (currentTypedLength >= endOfCurrentSentence) {
                if (settings.autoRead) {
                    const audioUrl = audioCache.current.get(sentenceIndex);
                    if (audioUrl) {
                        if (audioUrl.startsWith('blob:')) {
                            globalAudioQueue.add(audioUrl);
                        } else if (audioUrl.startsWith('system:')) {
                            const u = new SpeechSynthesisUtterance(audioUrl.replace('system:', ''));
                            u.lang = settings.speechLanguage;
                            window.speechSynthesis.speak(u);
                        }
                    }
                }
                sentenceIndex++;
            }
            
            charIndex++;
            if (onUpdate) onUpdate();

            if (charIndex >= text.length) {
                clearInterval(intervalId);
                if (onComplete) onComplete();
            }
        }, 30); // 打字速度

        return () => clearInterval(intervalId);
    }, [sentences, text, settings, onComplete, onUpdate]);

    return <RichMarkdown text={displayedText} />;
};


// --- [UI组件] 增强版富文本渲染 ---
const RichMarkdown = ({ text }) => {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```)/g);
    return (
        <div className="markdown-body space-y-3 font-sans">
            {parts.map((part, i) => {
                if (part.startsWith('```') && part.endsWith('```')) {
                    const content = part.replace(/^```\w*\n?/, '').replace(/```$/, '');
                    const lang = part.match(/^```(\w+)/)?.[1] || 'Code';
                    return (
                        <div key={i} className="my-3 rounded-xl overflow-hidden border border-gray-700 bg-[#1e1e1e] shadow-xl">
                            <div className="flex justify-between items-center px-4 py-2 bg-[#2d2d2d] border-b border-gray-700">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{lang}</span>
                                <button onClick={() => navigator.clipboard.writeText(content)} className="text-gray-400 hover:text-white transition-colors"><i className="fas fa-copy"></i></button>
                            </div>
                            <pre className="p-4 overflow-x-auto text-sm font-mono text-gray-300 leading-relaxed"><code>{content}</code></pre>
                        </div>
                    );
                }
                return <FormatText key={i} text={part} />;
            })}
        </div>
    );
};
const FormatText = ({ text }) => (
    <>
        {text.split('\n').map((line, idx) => {
            if (line.trim() === '') return <div key={idx} className="h-2"></div>;
            if (line.startsWith('### ')) return <h4 key={idx} className="text-lg font-bold text-blue-600 dark:text-blue-400 mt-4 mb-2">{parseInline(line.slice(4))}</h4>;
            if (line.startsWith('## ')) return <h3 key={idx} className="text-xl font-black text-gray-800 dark:text-gray-100 border-b-2 border-gray-100 dark:border-gray-700 pb-2 mt-6 mb-3">{parseInline(line.slice(3))}</h3>;
            if (line.startsWith('# ')) return <h2 key={idx} className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mt-6 mb-4">{parseInline(line.slice(2))}</h2>;
            if (line.match(/^[-*]\s/)) return <div key={idx} className="flex gap-3 ml-2 my-2"><span className="text-blue-500 mt-1.5 text-xs">●</span><span className="flex-1 leading-relaxed">{parseInline(line.replace(/^[-*]\s/, ''))}</span></div>;
            if (line.match(/^\d+\.\s/)) return <div key={idx} className="flex gap-3 ml-2 my-2"><span className="font-mono font-bold text-blue-600 shrink-0">{line.match(/^\d+\./)}</span><span className="flex-1 leading-relaxed">{parseInline(line.replace(/^\d+\.\s/, ''))}</span></div>;
            if (line.startsWith('> ')) return <blockquote key={idx} className="border-l-4 border-blue-500 bg-blue-50 dark:bg-blue-900/20 pl-4 py-3 my-3 rounded-r-lg text-gray-600 dark:text-gray-300 italic shadow-sm">{parseInline(line.slice(2))}</blockquote>;
            return <p key={idx} className="leading-7 my-1 text-[15px]">{parseInline(line)}</p>;
        })}
    </>
);
const parseInline = (text) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} className="font-extrabold text-indigo-700 dark:text-indigo-300 mx-0.5">{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded text-xs font-mono border border-red-100 dark:border-red-900/50 mx-1">{part.slice(1, -1)}</code>;
        return part;
    });
};


// --- [UI组件] 划词工具菜单 ---
const TextActionMenu = ({ containerRef }) => {
    const [menuStyle, setMenuStyle] = useState({ display: 'none' });
    const [selectedText, setSelectedText] = useState('');
    const [pinyinResult, setPinyinResult] = useState('');

    const handleSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection.toString().trim();

        if (text && text.length > 0) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setMenuStyle({ 
                display: 'flex', 
                top: `${window.scrollY + rect.top - 60}px`, 
                left: `${window.scrollX + rect.left + rect.width / 2 - 100}px` 
            });
            setSelectedText(text);
            setPinyinResult('');
        } else {
            setMenuStyle({ display: 'none' });
        }
    }, []);

    useEffect(() => {
        document.addEventListener('mouseup', handleSelection);
        return () => document.removeEventListener('mouseup', handleSelection);
    }, [handleSelection]);
    
    const handleSpeak = (e) => { e.stopPropagation(); const u = new SpeechSynthesisUtterance(selectedText); u.lang = 'zh-CN'; window.speechSynthesis.speak(u); };
    const handleTranslate = (e) => { e.stopPropagation(); window.open(`https://glosbe.com/zh/en/${encodeURIComponent(selectedText)}`, '_blank'); setMenuStyle({ display: 'none' }); };
    const handlePinyin = (e) => { e.stopPropagation(); setPinyinResult(pinyin(selectedText, { toneType: 'symbol' })); };

    if (menuStyle.display === 'none') return null;

    return (
        <div className="fixed z- bg-gray-900/90 backdrop-blur-md text-white rounded-xl shadow-2xl flex flex-col items-center p-1 animate-fade-in border border-gray-700" style={menuStyle} onMouseDown={(e) => e.preventDefault()}>
            <div className="flex gap-1">
                <MenuBtn icon="fa-volume-up" label="朗读" onClick={handleSpeak} />
                <MenuBtn icon="fa-font" label="拼音" onClick={handlePinyin} />
                <MenuBtn icon="fa-language" label="翻译" onClick={handleTranslate} />
            </div>
            {pinyinResult && <div className="border-t border-gray-600 mt-1 pt-1 px-2 pb-1 text-sm font-mono text-yellow-400 text-center max-w-[200px] break-words">{pinyinResult}</div>}
            <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-gray-900/90"></div>
        </div>
    );
};
const MenuBtn = ({ icon, label, onClick }) => ( <button onClick={onClick} className="flex flex-col items-center justify-center w-12 h-12 hover:bg-white/10 rounded-lg transition-colors group"><i className={`fas ${icon} text-lg mb-1 group-hover:scale-110 transition-transform`}></i><span className="text-[10px] opacity-80">{label}</span></button> );


// --- [UI组件] MessageBubble & ThinkingIndicator ---
const MessageBubble = ({ msg, settings, isLastAiMessage, onRegenerate, onTypingComplete, onTypingUpdate, onCorrectionRequest, explicitAiAvatar, onTranslate }) => {
    const isUser = msg.role === 'user';
    const avatarToShow = isUser ? settings.userAvatarUrl : (explicitAiAvatar || settings.aiAvatarUrl);
    return (
        <div className={`flex items-end gap-3 my-5 ${isUser ? 'justify-end' : 'justify-start'}`}>
            {!isUser && <img src={convertGitHubUrl(avatarToShow)} alt="AI" className="w-9 h-9 rounded-full shadow-sm bg-white object-cover border border-gray-100" />}
            <div className={`p-4 text-left flex flex-col transition-all duration-300 ${isUser ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm shadow-lg' : 'bg-white dark:bg-gray-700 rounded-2xl rounded-tl-sm border border-gray-100 dark:border-gray-600 shadow-md'}`} style={{ maxWidth: '88%' }}>
                {msg.images && msg.images.length > 0 && <div className="flex flex-wrap gap-2 mb-3">{msg.images.map((img, i) => <img key={i} src={img.src || img.previewUrl} className="w-32 h-32 object-cover rounded-lg border-2 border-white/20" />)}</div>}
                
                {/* 如果 AI 输出被识别为组件，则渲染组件；否则渲染富文本 */}
                {msg.isComponent ? React.createElement(componentMap[msg.componentName], { ...msg.props, onCorrectionRequest }) : (
                    <div className={`text-[15px] ${isUser ? 'text-white' : 'text-gray-800 dark:text-gray-100'}`}>
                        {isLastAiMessage && msg.isTyping ? <TypingEffect text={msg.content || ''} settings={settings} onComplete={onTypingComplete} onUpdate={onTypingUpdate} /> : <RichMarkdown text={msg.content || ''} />}
                    </div>
                )}
                
                {!isUser && !msg.isTyping && msg.content && (
                    <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-gray-600/50 text-gray-400">
                        {!settings.isFacebookApp && <AiTtsButton text={msg.content} ttsSettings={settings} />}
                        <IconButton icon="fa-copy" onClick={() => navigator.clipboard.writeText(msg.content)} title="复制" />
                        <IconButton icon="fa-language" onClick={() => onTranslate(msg.content)} title="翻译" />
                        {isLastAiMessage && <IconButton icon="fa-sync-alt" onClick={onRegenerate} title="重试" />}
                    </div>
                )}
            </div>
            {isUser && <img src={convertGitHubUrl(avatarToShow)} alt="User" className="w-9 h-9 rounded-full shadow-sm bg-gray-200 object-cover border border-gray-100" />}
        </div>
    );
};
const IconButton = ({ icon, onClick, title }) => <button onClick={(e) => { e.stopPropagation(); onClick(); }} className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-full transition-colors" title={title}><i className={`fas ${icon} text-xs`}></i></button>;
const ThinkingIndicator = ({ settings, aiAvatar }) => (
    <div className="flex items-end gap-3 my-5 justify-start">
        <img src={convertGitHubUrl(aiAvatar || settings.aiAvatarUrl)} className="w-9 h-9 rounded-full shadow-sm" />
        <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-white dark:bg-gray-700 border border-gray-100 shadow-sm flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
        </div>
    </div>
);

// --- [UI组件] 侧边栏及设置页面 ---
const ChatSidebar = ({ isOpen, conversations, currentId, onSelect, onNew, onDelete, onRename, prompts }) => {
    const [editingId, setEditingId] = useState(null); const [newName, setNewName] = useState('');
    const handleRename = (id, oldName) => { setEditingId(id); setNewName(oldName); };
    const handleSaveRename = (id) => { if (newName.trim()) onRename(id, newName.trim()); setEditingId(null); };
    const grouped = useMemo(() => {
        const groups = new Map(); const uncategorized = [];
        (conversations || []).forEach(conv => {
            const prompt = (prompts || []).find(p => p.id === conv.promptId);
            if (prompt) { if (!groups.has(prompt.id)) groups.set(prompt.id, { prompt, conversations: [] }); groups.get(prompt.id).conversations.push(conv); } else uncategorized.push(conv);
        });
        return { sortedGroups: Array.from(groups.values()), uncategorized };
    }, [conversations, prompts]);
    const renderItem = (conv) => (
        <div key={conv.id} className={`flex items-center p-2.5 rounded-lg cursor-pointer transition-colors mb-1 ${currentId === conv.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`} onClick={() => onSelect(conv.id)}>
            <div className="flex-grow truncate text-sm font-medium" onDoubleClick={(e) => {e.stopPropagation(); handleRename(conv.id, conv.title)}}>
                {editingId === conv.id ? <input autoFocus className="bg-transparent border-b border-blue-500 w-full outline-none" value={newName} onChange={e=>setNewName(e.target.value)} onBlur={()=>handleSaveRename(conv.id)} onKeyDown={e=>e.key==='Enter'&&handleSaveRename(conv.id)}/> : conv.title}
            </div>
            {currentId === conv.id && <div className="flex gap-1 ml-2"><button onClick={(e)=>{e.stopPropagation(); handleRename(conv.id, conv.title)}} className="p-1 hover:text-blue-600"><i className="fas fa-pen text-xs"></i></button><button onClick={(e)=>{e.stopPropagation(); if(window.confirm('删除?')) onDelete(conv.id)}} className="p-1 hover:text-red-500"><i className="fas fa-trash text-xs"></i></button></div>}
        </div>
    );
    return (
        <div className={`absolute lg:relative h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur flex flex-col transition-all duration-300 z-30 ${isOpen ? 'w-64 border-r border-gray-200 dark:border-gray-800' : 'w-0 overflow-hidden'}`}>
            <div className="p-4"><button onClick={onNew} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"><i className="fas fa-plus"></i> 新对话</button></div>
            <div className="flex-1 overflow-y-auto px-3 pb-4">
                {grouped.sortedGroups.map(({ prompt, conversations }) => (
                    <details key={prompt.id} open className="group mb-2">
                        <summary className="flex items-center gap-2 px-2 py-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 list-none"><i className="fas fa-chevron-right text-[10px] transition-transform group-open:rotate-90"></i> {prompt.name}</summary>
                        <div className="pl-2 mt-1">{conversations.map(renderItem)}</div>
                    </details>
                ))}
                {grouped.uncategorized.length > 0 && <details open className="group"><summary className="px-2 py-1.5 text-xs font-bold text-gray-400 uppercase cursor-pointer list-none">未分类</summary><div className="pl-2 mt-1">{grouped.uncategorized.map(renderItem)}</div></details>}
            </div>
        </div>
    );
};
const SubPageWrapper = ({ title, onBack, onSave, children }) => (
    <div className="flex flex-col h-full bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h3>
            <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"><i className="fas fa-times"></i></button>
        </div>
        <div className="flex-grow overflow-y-auto p-4 space-y-4 pb-20">{children}</div>
        <div className="p-4 border-t border-gray-100 dark:border-gray-700 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md sticky bottom-0 z-10 flex justify-end gap-3 pb-safe">
            <button onClick={onBack} className="px-5 py-2.5 rounded-xl font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200">返回</button>
            <button onClick={onSave} className="px-5 py-2.5 rounded-xl font-bold text-white bg-blue-600 shadow-lg shadow-blue-500/30 hover:bg-blue-700">保存设置</button>
        </div>
    </div>
);
const PromptManager = ({ prompts, onChange, onAdd, onDelete, settings }) => {
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
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files && handleAvatarUpload(e.target.files, p.id)} />
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
            <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">选择 "OpenAI 兼容" 可使用第三方中转 (如 open-gemini-api.deno.dev)，无需 VPN。</p>
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
                    {k.provider === 'openai' && (<input type="text" value={k.url || ''} onChange={(e) => onChange(k.id, 'url', e.target.value)} placeholder="默认: https://open-gemini-api.deno.dev/v1" className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-xs text-gray-500 focus:ring-2 focus:ring-blue-500 outline-none" />)}
                </div>
            </div>
        ))}
        <button onClick={onAdd} className="w-full py-4 font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border-2 border-dashed border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"><i className="fas fa-plus mr-2"></i> 添加新密钥</button>
    </>
);
const SettingsModal = ({ settings, onSave, onClose }) => {
    const [tempSettings, setTempSettings] = useState(settings); const [systemVoices, setSystemVoices] = useState([]); const [view, setView] = useState('main'); const fileInputRef = useRef(null); const userAvatarInputRef = useRef(null); useEffect(() => { const fetchSystemVoices = () => { if (!window.speechSynthesis) return; const voices = window.speechSynthesis.getVoices(); if (voices.length > 0) { setSystemVoices(voices.filter(v => v.lang.startsWith('zh') || v.lang.startsWith('en') || v.lang.startsWith('fr') || v.lang.startsWith('es') || v.lang.startsWith('ja') || v.lang.startsWith('ko') || v.lang.startsWith('vi'))); } }; if (window.speechSynthesis) { if (window.speechSynthesis.onvoiceschanged !== undefined) { window.speechSynthesis.onvoiceschanged = fetchSystemVoices; } fetchSystemVoices(); } }, []); const handleChange = (key, value) => setTempSettings(prev => ({ ...prev, [key]: value })); 
    const handleBgImageSelect = (event) => { const file = event.target.files; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { e.target && handleChange('chatBackgroundUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; }; 
    const handleUserAvatarSelect = (event) => { const file = event.target.files; if (file && file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = (e) => { e.target && handleChange('userAvatarUrl', e.target.result); }; reader.readAsDataURL(file); } event.target.value = null; };
    const handleAddPrompt = () => { const newPrompt = { id: generateSimpleId('prompt'), name: '新助理', description: '新助理', content: '你是一个...', openingLine: '你好', model: settings.selectedModel, ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', avatarUrl: '' }; const newPrompts = [...(tempSettings.prompts || []), newPrompt]; handleChange('prompts', newPrompts); }; 
    const handleDeletePrompt = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newPrompts = (tempSettings.prompts || []).filter(p => p.id !== idToDelete); handleChange('prompts', newPrompts); if (tempSettings.currentPromptId === idToDelete) handleChange('currentPromptId', newPrompts[0]?.id || ''); }; 
    const handlePromptSettingChange = (promptId, field, value) => { const newPrompts = (tempSettings.prompts || []).map(p => p.id === promptId ? { ...p, [field]: value } : p); handleChange('prompts', newPrompts); }; const speechLanguageOptions = [ { name: '中文 (普通话)', value: 'zh-CN' }, { name: '缅甸语 (မြန်မာ)', value: 'my-MM' }, { name: 'English (US)', value: 'en-US' }, { name: 'Español (España)', value: 'es-ES' }, { name: 'Français (France)', value: 'fr-FR' }, { name: '日本語', value: 'ja-JP' }, { name: '한국어', value: 'ko-KR' }, { name: 'Tiếng Việt', value: 'vi-VN' }, ]; const handleAddModel = () => { const newModel = { id: generateSimpleId('model'), name: '新模型', value: '', maxContextTokens: 8192 }; const newModels = [...(tempSettings.chatModels || []), newModel]; handleChange('chatModels', newModels); }; const handleDeleteModel = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newModels = (tempSettings.chatModels || []).filter(m => m.id !== idToDelete); handleChange('chatModels', newModels); }; const handleModelSettingChange = (modelId, field, value) => { const newModels = (tempSettings.chatModels || []).map(m => m.id === modelId ? { ...m, [field]: value } : m); handleChange('chatModels', newModels); }; 
    const handleAddApiKey = () => { const newKey = { id: generateSimpleId('key'), provider: 'openai', key: '', url: 'https://open-gemini-api.deno.dev/v1' }; const newKeys = [...(tempSettings.apiKeys || []), newKey]; handleChange('apiKeys', newKeys); if (newKeys.length === 1) { handleChange('activeApiKeyId', newKey.id); } }; 
    const handleDeleteApiKey = (idToDelete) => { if (!window.confirm('确定删除吗？')) return; const newKeys = (tempSettings.apiKeys || []).filter(k => k.id !== idToDelete); handleChange('apiKeys', newKeys); if (tempSettings.activeApiKeyId === idToDelete) handleChange('activeApiKeyId', newKeys[0]?.id || ''); }; 
    const handleApiKeySettingChange = (keyId, field, value) => { const newKeys = (tempSettings.apiKeys || []).map(k => k.id === keyId ? { ...k, [field]: value } : k); handleChange('apiKeys', newKeys); }; const handleSetActiveApiKey = (keyId) => { handleChange('activeApiKeyId', keyId); }; const handleSubPageSave = () => { onSave(tempSettings); }; 
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
                                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-600 pt-3"><label className="text-sm font-bold">自动朗读回复</label><div className="relative inline-block w-12 mr-2 align-middle select-none"><input type="checkbox" checked={tempSettings.autoRead} onChange={(e) => handleChange('autoRead', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-green-500"/><div className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${tempSettings.autoRead ? 'bg-green-500' : 'bg-gray-300'}`}></div></div></div>
                                    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-600 pt-3"><label className="text-sm font-bold">语音识别后自动发送</label><div className="relative inline-block w-12 mr-2 align-middle select-none"><input type="checkbox" checked={tempSettings.voiceAutoSend} onChange={(e) => handleChange('voiceAutoSend', e.target.checked)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out checked:translate-x-full checked:border-green-500"/><div className={`block overflow-hidden h-6 rounded-full cursor-pointer transition-colors ${tempSettings.voiceAutoSend ? 'bg-green-500' : 'bg-gray-300'}`}></div></div></div>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">个性化</h4>
                                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl space-y-4">
                                    <div><label className="block text-sm font-bold mb-2">用户头像</label><div className="flex gap-2 items-center"><img src={convertGitHubUrl(tempSettings.userAvatarUrl)} alt="User" className="w-10 h-10 rounded-full object-cover border border-gray-200"/><input type="text" value={tempSettings.userAvatarUrl} onChange={(e) => handleChange('userAvatarUrl', e.target.value)} placeholder="头像 URL..." className="flex-1 px-3 py-2 bg-white dark:bg-gray-600 rounded-lg text-sm border-0 shadow-sm outline-none" /><button onClick={() => userAvatarInputRef.current?.click()} className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-lg font-bold text-sm"><i className="fas fa-upload"></i></button><input type="file" ref={userAvatarInputRef} onChange={handleUserAvatarSelect} accept="image/*" className="hidden" /></div></div>
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


// --- 主组件 AiChatAssistant ---
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
    const assistantContainerRef = useRef(null);

    // --- [核心修复] 组件卸载时清理音频 ---
    useEffect(() => {
        return () => {
            if(window.speechSynthesis) window.speechSynthesis.cancel();
            globalAudioQueue.clear();
        }
    }, []);

    useEffect(() => { 
        setIsMounted(true); 
        let finalSettings = { ...DEFAULT_SETTINGS }; 
        const savedSettings = safeLocalStorageGet('ai_chat_settings'); 
        if (savedSettings) { 
            const parsed = JSON.parse(savedSettings); 
            if (parsed.thirdPartyTtsConfig) { 
                parsed.ttsVoice = parsed.thirdPartyTtsConfig.microsoftVoice || DEFAULT_SETTINGS.ttsVoice; 
                delete parsed.thirdPartyTtsConfig; 
            } 
            parsed.prompts = (parsed.prompts || []).map(p => ({ ...p, model: p.model || DEFAULT_SETTINGS.selectedModel, ttsVoice: p.ttsVoice || DEFAULT_SETTINGS.ttsVoice, avatarUrl: p.avatarUrl || '', description: p.description || '' })); 
            if (!parsed.chatModels || parsed.chatModels.length === 0) parsed.chatModels = CHAT_MODELS_LIST; 
            if (!parsed.apiKeys) parsed.apiKeys = []; 
            finalSettings = { ...DEFAULT_SETTINGS, ...parsed }; 
        } 
        if (typeof navigator !== 'undefined' && /FBAN|FBAV/i.test(navigator.userAgent)) { 
            finalSettings.isFacebookApp = true; 
        } 
        setSettings(finalSettings); 
        const savedConversations = safeLocalStorageGet('ai_chat_conversations'); 
        const parsedConvs = savedConversations ? JSON.parse(savedConversations) : []; 
        setConversations(parsedConvs); 
        if (finalSettings.startWithNewChat || parsedConvs.length === 0) { 
            createNewConversation(finalSettings.currentPromptId, true); 
        } else { 
            const firstConv = parsedConvs[0]; 
            if(firstConv) setCurrentConversationId(firstConv.id);
            else createNewConversation(finalSettings.currentPromptId, true);
        } 
    }, []);
    
    const currentConversation = useMemo(() => conversations.find(c => c.id === currentConversationId), [conversations, currentConversationId]);
    const activePromptInfo = useMemo(() => { if (!currentConversation) return null; return (settings.prompts || []).find(p => p.id === currentConversation.promptId); }, [currentConversation, settings.prompts]);
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
    const handleAssistantSelect = (promptId) => { const selectedPrompt = settings.prompts.find(p => p.id === promptId); if (!selectedPrompt) return; setSettings(s => ({ ...s, currentPromptId: promptId, selectedModel: selectedPrompt.model || s.selectedModel, ttsVoice: selectedPrompt.ttsVoice || s.ttsVoice })); setConversations(prevConvs => prevConvs.map(c => c.id === currentConversationId ? { ...c, promptId: promptId } : c)); setShowAssistantSelector(false); };
    const startListening = useCallback(() => { const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SpeechRecognition) { alert('您的浏览器不支持语音输入。'); return; } if (recognitionRef.current) { recognitionRef.current.abort(); } const recognition = new SpeechRecognition(); recognition.lang = settings.speechLanguage; recognition.interimResults = true; recognition.continuous = false; recognitionRef.current = recognition; recognition.onstart = () => { setIsListening(true); setUserInput(''); }; recognition.onresult = (event) => { const transcript = Array.from(event.results).map(result => result).map(result => result.transcript).join(''); setUserInput(transcript); if (event.results[0].isFinal && transcript.trim()) { recognition.stop(); if (settings.voiceAutoSend && handleSubmitRef.current) { handleSubmitRef.current(false, transcript); } } }; recognition.onerror = (event) => { console.error("Speech recognition error:", event.error); if (event.error !== 'no-speech') { setError(`语音识别错误: ${event.error}`); } if (event.error === 'aborted') return; }; recognition.onend = () => { setIsListening(false); recognitionRef.current = null; }; recognition.start(); }, [settings.speechLanguage, settings.voiceAutoSend, setError]);
    const stopListening = useCallback(() => { if (recognitionRef.current) { recognitionRef.current.stop(); } }, []);
    const handleImageSelection = async (event) => { const files = Array.from(event.target.files); if (files.length === 0) return; const imagePromises = files.slice(0, 4 - selectedImages.length).map(async file => { try { const options = { maxSizeMB: 1, maxWidthOrHeight: 1024, useWebWorker: true, }; const compressedFile = await imageCompression(file, options); return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = (e) => { const base64Data = e.target.result.split(',')[1]; const fullDataUrl = `data:${compressedFile.type};base64,${base64Data}`; const newImage = { previewUrl: URL.createObjectURL(compressedFile), src: fullDataUrl, data: base64Data, type: compressedFile.type, name: compressedFile.name }; resolve(newImage); }; reader.onerror = reject; reader.readAsDataURL(compressedFile); }); } catch (error) { console.error(error); return null; } }); const newImages = (await Promise.all(imagePromises)).filter(Boolean); setSelectedImages(prev => [...prev, ...newImages]); event.target.value = null; };
    const triggerImageInput = () => { if (imageInputRef.current) { imageInputRef.current.removeAttribute('capture'); imageInputRef.current.click(); } };
    const removeSelectedImage = (index) => { const imageToRemove = selectedImages[index]; if (imageToRemove) { URL.revokeObjectURL(imageToRemove.previewUrl); } setSelectedImages(prev => prev.filter((_, i) => i !== index)); };
    const handleCorrectionRequest = (correctionPrompt) => { if (!currentConversation || isLoading) return; const userMessage = { role: 'user', content: correctionPrompt, timestamp: Date.now() }; const updatedMessages = [...currentConversation.messages, userMessage]; setConversations(prev => prev.map(c => c.id === currentConversationId ? { ...c, messages: updatedMessages } : c)); fetchAiResponse(updatedMessages); };
    const handleTranslate = (text) => { const prompt = `请将以下内容翻译成中文（如果是中文则翻译成英文）：\n\n${text}`; handleSubmit(false, prompt); };

    // --- API 请求逻辑 ---
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
            if (activeKey.provider === 'openai') { 
                const messages = [ { role: 'system', content: currentPrompt.content }, ...contextMessages.filter(msg => msg.content).map(msg => ({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content })) ]; 
                let baseUrl = activeKey.url || 'https://open-gemini-api.deno.dev/v1';
                baseUrl = baseUrl.trim().replace(/\/+$/, '');
                // 智能检测是否需要追加 /chat/completions
                const url = baseUrl.includes('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${activeKey.key}` }, body: JSON.stringify({ model: modelToUse, messages, temperature: settings.temperature, max_tokens: settings.maxOutputTokens, stream: false }), signal: abortControllerRef.current.signal }); 
            } else { // Gemini (Google Official)
                 const history = contextMessages.filter(msg => msg.content || (msg.images && msg.images.length > 0)).map(msg => { const parts = []; if (msg.content) parts.push({ text: msg.content }); if (msg.images) msg.images.forEach(img => parts.push({ inlineData: { mimeType: img.type, data: img.data } })); return { role: msg.role === 'user' ? 'user' : 'model', parts }; }); 
                const contents = [ { role: 'user', parts: [{ text: currentPrompt.content }] }, { role: 'model', parts: [{ text: "好的，我明白了。" }] }, ...history ]; 
                const generationConfig = { temperature: settings.temperature, maxOutputTokens: settings.maxOutputTokens }; 
                if (settings.disableThinkingMode && modelToUse.includes('gemini-2.5')) { generationConfig.thinkingConfig = { thinkingBudget: 0 }; } 
                const url = `${activeKey.url || 'https://generativelanguage.googleapis.com/v1beta/models/'}${modelToUse}:generateContent?key=${activeKey.key}`; 
                response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents, generationConfig }), signal: abortControllerRef.current.signal }); 
            }
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error?.message || `请求失败 (状态码: ${response.status})`); }
            const data = await response.json();
            let aiResponseContent;
            if (activeKey.provider === 'gemini') { aiResponseContent = data.candidates?.[0]?.content?.parts?.[0]?.text; } else { aiResponseContent = data.choices?.[0]?.message?.content; }
            if (!aiResponseContent) throw new Error('AI未能返回有效内容。');
            
            let aiMessage;
            try { 
                // 1. 尝试匹配 JSON 对象
                const jsonMatch = aiResponseContent.match(/\{[\s\S]*\}/); 
                let parsed = null; 
                if (jsonMatch) { 
                    try { parsed = JSON.parse(jsonMatch[0]); } catch (e) {} 
                } 
                // 2. 如果成功解析出 JSON，且包含 component 字段，则判定为组件消息
                if (parsed && parsed.component && parsed.props && componentMap[parsed.component]) { 
                    const sanitizedProps = sanitizeQuizData(parsed.props); 
                    aiMessage = { role: 'ai', content: null, timestamp: Date.now(), isComponent: true, componentName: parsed.component, props: sanitizedProps, isTyping: false }; 
                } else { 
                    throw new Error("Not a component JSON"); 
                } 
            } catch(e) { 
                // 3. 否则判定为普通文本消息
                aiMessage = { role: 'ai', content: aiResponseContent, timestamp: Date.now(), isTyping: true }; 
            }
            
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
            <TextActionMenu containerRef={assistantContainerRef} />
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url('${convertGitHubUrl(settings.chatBackgroundUrl)}')`, opacity: (settings.backgroundOpacity || 70) / 100, zIndex: -1 }}></div>
            <div className="absolute inset-0 bg-black/10 dark:bg-black/20" style={{ zIndex: -1 }}></div>
            <div className="relative flex flex-1 min-h-0">
                <ChatSidebar isOpen={isSidebarOpen} conversations={conversations} currentId={currentConversationId} onSelect={handleSelectConversation} onDelete={handleDeleteConversation} onRename={handleRenameConversation} onNew={() => createNewConversation()} prompts={settings.prompts} />
                {isSidebarOpen && ( <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/20 z-20 lg:hidden"></div> )}
                <div className="flex-1 flex flex-col h-full min-w-0">
                    <header className="flex items-center justify-between py-2 px-2 shrink-0 bg-white/40 dark:bg-black/20 backdrop-blur-lg shadow-sm border-b border-gray-200/50 dark:border-gray-800/50">
                        <div className="flex items-center gap-2"><button onClick={() => setIsSidebarOpen(s => !s)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95" title="切换对话列表"><i className="fas fa-bars text-xl"></i></button></div>
                        <div className="text-center flex-grow overflow-hidden px-2"><h2 className="text-lg font-bold truncate">{currentConversation?.title || 'AI 聊天'}</h2></div>
                        <div className="w-10 flex justify-end"><button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-black/10 dark:hover:bg-white/10 active:scale-95" title="设置"><i className="fas fa-cog text-xl"></i></button></div>
                    </header>
                    <main className="flex-grow p-4 overflow-y-auto">
                        <div className="space-y-1">
                            {currentConversation?.messages.map((msg, index) => ( <div id={`msg-${currentConversation.id}-${index}`} key={`${currentConversation.id}-${index}`}> <MessageBubble msg={msg} settings={settings} isLastAiMessage={index === currentConversation.messages.length - 1 && msg.role === 'ai'} onRegenerate={() => handleSubmit(true)} onTypingComplete={handleTypingComplete} onTypingUpdate={scrollToBottom} onCorrectionRequest={handleCorrectionRequest} explicitAiAvatar={displayAiAvatar} onTranslate={handleTranslate} /> </div> ))}
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
                             <div className="flex items-center flex-shrink-0 pl-1 mb-1"><button type="button" onClick={triggerImageInput} className="w-10 h-10 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors" title="图片"><i className="fas fa-image text-xl"></i></button></div>
                            <textarea ref={textareaRef} value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(false); } }} placeholder={isListening ? "正在聆听..." : "发送消息..."} className="flex-1 bg-transparent focus:outline-none text-gray-800 dark:text-gray-100 text-[16px] resize-none overflow-hidden px-2 py-3 leading-relaxed max-h-32 placeholder-gray-400" rows="1" style={{minHeight:'48px'}} readOnly={isListening} />
                            <div className="flex items-center flex-shrink-0 pr-1 mb-1 gap-1">{!showSendButton ? ( <button type="button" onClick={isListening ? stopListening : startListening} className={`w-10 h-10 flex items-center justify-center rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-md' : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}`} title="语音"> <i className={`fas ${isListening ? 'fa-stop' : 'fa-microphone'} text-xl`}></i> </button> ) : ( <button type="submit" className="w-10 h-10 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 active:scale-90 transition-all" disabled={isLoading}> <i className="fas fa-arrow-up text-lg font-bold"></i> </button> )}</div>
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

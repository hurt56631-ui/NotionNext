// chatConstants.js

// --- 1. 枚举常量 ---
export const TTS_ENGINE = { 
    SYSTEM: 'system', 
    THIRD_PARTY: 'third_party' 
};

// --- 2. 聊天模型列表 ---
export const CHAT_MODELS_LIST = [
    { id: 'model-1', name: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash', maxContextTokens: 1048576 },
    { id: 'model-2', name: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro', maxContextTokens: 1048576 },
    { id: 'model-3', name: 'Gemini 2.0 Flash', value: 'gemini-2.0-flash', maxContextTokens: 1048576 },
    { id: 'model-4', name: 'Gemini 2.5 lite', value: 'gemini-2.5-flash-lite', maxContextTokens: 1048576 },
    { id: 'model-5', name: 'Gemini 2.0 Pro', value: 'gemini-2.0-pro-exp', maxContextTokens: 1048576 },
];

// --- 3. 默认提示词列表 ---
export const DEFAULT_PROMPTS = [
    { 
        id: 'default-grammar-correction', 
        name: '纠正中文语法', 
        description: '纠正语法、优化用词。', 
        content: '你是一位专业的中文老师。请纠正用户发送的中文句子中的语法错误。\n\n**重要要求**：\n1. 请务必使用 **Markdown** 格式。\n2. 错误的地方请用 `代码块` 或 **加粗** 标记。\n3. 使用列表展示修改建议。', 
        openingLine: '你好，请发送你需要我纠正的中文句子。', 
        model: 'gemini-2.5-flash', 
        ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', 
        avatarUrl: 'https://pub-bcded118f6fe4849a98b640daf5fabe1.r2.dev/%E5%9B%BE%E7%89%87/1765026380162.jpg' 
    },
    { 
        id: 'explain-word', 
        name: '解释中文词语', 
        description: '解释词语并造句。', 
        content: '你是一位中文老师。请解释用户发送的中文词语。\n\n**格式要求**：\n- 使用 ### 标题 分隔含义和例句。\n- 关键解释请 **加粗**。', 
        openingLine: '你好，想了解哪个词？', 
        model: 'gemini-1.5-pro-latest', 
        ttsVoice: 'zh-CN-YunxiNeural', 
        avatarUrl: '' 
    },
    { 
        id: 'translate-myanmar', 
        name: '中缅互译', 
        description: '擅长中缅互译。', 
        content: '你是一位翻译助手。请将用户发送的内容在中文和缅甸语之间互译。请直接输出翻译结果。要求自然直译，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。', 
        openingLine: '你好！请发送内容进行翻译。', 
        model: 'gemini-2.5-flash', 
        ttsVoice: 'my-MM-NilarNeural', 
        avatarUrl: 'https://pub-bcded118f6fe4849a98b640daf5fabe1.r2.dev/%E5%9B%BE%E7%89%87/1765025114570.jpg' 
    }
];

// --- 4. 微软 TTS 语音列表 ---
export const MICROSOFT_TTS_VOICES = [
    { name: '晓晓 (女, 多语言)', value: 'zh-CN-XiaoxiaoMultilingualNeural' },
    { name: '晓辰 (女, 多语言)', value: 'zh-CN-XiaochenMultilingualNeural' },
    { name: '云希 (男, 温和)', value: 'zh-CN-YunxiNeural' },
    { name: '云泽 (男, 叙事)', value: 'zh-CN-YunzeNeural' },
    { name: '晓梦 (女, 播音)', value: 'zh-CN-XiaomengNeural' },
    { name: '云扬 (男, 阳光)', value: 'zh-CN-YunyangNeural' },
    { name: '晓伊 (女, 动漫)', value: 'zh-CN-XiaoyiNeural' },
    { name: '晓臻 (女, 台湾)', value: 'zh-TW-HsiaoChenNeural' },
    { name: '允喆 (男, 台湾)', value: 'zh-TW-YunJheNeural' },
    { name: 'Ava (女, 美国, 多语言)', value: 'en-US-AvaMultilingualNeural' },
    { name: 'Andrew (男, 美国, 多语言)', value: 'en-US-AndrewMultilingualNeural' },
    { name: '七海 (女, 日本)', value: 'ja-JP-NanamiNeural' },
    { name: '圭太 (男, 日本)', value: 'ja-JP-KeitaNeural' },
    { name: '妮拉 (女, 缅甸)', value: 'my-MM-NilarNeural' },
    { name: '蒂哈 (男, 缅甸)', value: 'my-MM-ThihaNeural' },
];

// --- 5. 默认应用设置 ---
// 注意：此对象依赖于上述定义的常量，必须放在它们之后
export const DEFAULT_SETTINGS = {
    apiKey: '', 
    apiKeys: [], 
    activeApiKeyId: '', 
    chatModels: CHAT_MODELS_LIST, 
    selectedModel: 'gemini-2.5-flash',
    temperature: 0.8, 
    maxOutputTokens: 8192, 
    disableThinkingMode: true, 
    startWithNewChat: false, 
    prompts: DEFAULT_PROMPTS,
    currentPromptId: DEFAULT_PROMPTS[0]?.id || '',
    autoRead: true, 
    voiceAutoSend: false,
    ttsEngine: TTS_ENGINE.THIRD_PARTY, 
    ttsVoice: 'zh-CN-XiaoxiaoMultilingualNeural', 
    ttsRate: 0, 
    ttsPitch: 0, 
    systemTtsVoiceURI: '', 
    speechLanguage: 'zh-CN',
    chatBackgroundUrl: '/images/chat-bg-light.jpg', 
    backgroundOpacity: 70,
    userAvatarUrl: 'https://raw.githubusercontent.com/Flipped-Development/images/main/user-avatar-default.png',
    aiAvatarUrl: 'https://raw.githubusercontent.com/Flipped-Development/images/main/gemini-sparkle-animated.gif',
    isFacebookApp: false,
};

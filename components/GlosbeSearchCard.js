import { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Settings, X, Loader2, Bot, Copy, Volume2, Repeat, Zap, PlayCircle } from 'lucide-react';

// 🟢 1. 定义微软语音列表常量
const MS_VOICES = {
    zh: [
        { name: 'zh-CN-XiaoxiaoNeural', label: '晓晓 (女声 - 温暖/最常用)' },
        { name: 'zh-CN-XiaoyuMultilingualNeural', label: '晓宇 (多语言 - 沉稳)' },
        { name: 'zh-CN-YunzeNeural', label: '云哲 (男声 - 体育/生动)' },
        { name: 'zh-CN-XiaoyiNeural', label: '晓伊 (女声 - 活泼)' },
        { name: 'zh-CN-XiaochenMultilingualNeural', label: '晓辰 (多语言 - 默认)' },
        { name: 'en-US-AvaMultilingualNeural', label: 'Ava (多语言 - 逼真)' },
        { name: 'fr-FR-VivienneMultilingualNeural', label: 'Vivienne (vivie多语言 - 标准)' }
    ],
    my: [
        { name: 'my-MM-NilarNeural', label: 'Nilar (女声 - 标准)' },
        { name: 'my-MM-ThihaNeural', label: 'Thiha (男声 - 标准)' }
    ]
};

// Prompt 保持不变
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}： "${word}"
请严格按照下面的格式提供多种风格的翻译结果，不要有任何多余的解释或标题：

**自然直译版**，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**口语版**，采用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常生活中常说的自然表达方式，语气轻松但仍保持原意准确。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**自然意译版**，遵循${toLang}母语者的思维方式和表达习惯进行意译，使句子听起来自然真实，但绝不偏离原意。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**通顺意译**，将句子翻译成符合${toLang === '缅甸语' ? '缅甸人' : '中国人'}日常表达习惯的、流畅自然的${toLang}。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]
`;

const parseAIResponse = (responseText) => {
    if (!responseText) return [];
    const results = [];
    const regex = /\*\*(.*?)\*\*([\s\S]*?)(?=\n\*\*|$)/g;
    let match;
    while ((match = regex.exec(responseText)) !== null) {
        const title = match[1].trim();
        const content = match[2].trim();
        const lines = content.split('\n');
        let translationLine = lines.find(line => (line.trim().startsWith('*') || line.includes('**')) && !line.includes('回译'));
        const meaningLine = lines.find(line => line.includes('回译:'));
        if (translationLine && meaningLine) {
            let cleanTranslation = translationLine.replace(/^\s*[\*\-]\s*/, '').replace(/\*\*/g, '').trim();
            if (cleanTranslation.startsWith('[') && cleanTranslation.endsWith(']')) cleanTranslation = cleanTranslation.slice(1, -1);
            const meaning = meaningLine.replace(/回译:\s*/, '').replace(/\]$/, '').trim();
            if (cleanTranslation) {
                results.push({
                    title: title.replace(/\*/g, ''),
                    translation: cleanTranslation,
                    meaning: `回译: ${meaning}`
                });
            }
        }
    }
    return results;
};

const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

const GlosbeSearchCard = () => {
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('my2zh');
    const [isListening, setIsListening] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [isAISearching, setIsAISearching] = useState(false);
    
    const [streamingText, setStreamingText] = useState(''); 
    const [aiResults, setAiResults] = useState([]); 
    const [aiError, setAiError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);

    // 🟢 2. 在设置状态中增加语音配置
    const [apiSettings, setApiSettings] = useState({
        url: 'https://open-gemini-api.deno.dev/v1/chat/completions',
        model: 'gemini-pro-flash',
        key: '',
        useThirdParty: false,
        thirdPartyUrl: 'https://gy.zenscaleai.com/v1',
        disableThinking: true,
        // 语音设置默认值
        voiceZh: 'zh-CN-XiaoxiaoNeural',
        voiceMy: 'my-MM-NilarNeural',
        voiceSpeed: 0 // 范围 -50 到 +50
    });

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);

    useEffect(() => {
        if (!word || word.trim() === '') return;
        const targetDirection = containsChinese(word) ? 'zh2my' : 'my2zh';
        if (targetDirection !== searchDirection) {
            setSearchDirection(targetDirection);
        }
    }, [word]);

    useEffect(() => {
        const savedSettings = localStorage.getItem('aiApiSettings_v10'); // 升级版本号以重置旧设置
        if (savedSettings) {
            // 合并新旧设置，防止新加的语音字段丢失
            setApiSettings(prev => ({ ...prev, ...JSON.parse(savedSettings) }));
        }
    }, []);

    const handleSaveSettings = () => {
        localStorage.setItem('aiApiSettings_v10', JSON.stringify(apiSettings));
        setSettingsOpen(false);
        // alert('设置已保存！'); // 去掉烦人的弹窗，用UI反馈更好，或者静默保存
    };

    const handleSwapLanguages = () => {
        setSearchDirection(prev => prev === 'my2zh' ? 'zh2my' : 'my2zh');
        setAiResults([]);
        setStreamingText('');
    };

    const handleLegacySearch = (searchText) => {
        const textToSearch = (searchText || word).trim();
        if (!textToSearch) return;
        const direction = containsChinese(textToSearch) ? 'zh2my' : 'my2zh';
        const glosbeUrl = direction === 'my2zh'
            ? `https://glosbe.com/my/zh/${encodeURIComponent(textToSearch)}`
            : `https://glosbe.com/zh/my/${encodeURIComponent(textToSearch)}`;
        window.open(glosbeUrl, '_blank');
    };

    const handleAiTranslate = async (text) => {
        const trimmedWord = (text || word).trim();
        if (!trimmedWord) return;
        if (!apiSettings.key) {
            setAiError('请点击设置图标，填写API密钥。');
            setSettingsOpen(true);
            return;
        }

        let apiUrl = apiSettings.url;
        let apiModel = apiSettings.model;
        if (apiSettings.useThirdParty) {
            if (!apiSettings.thirdPartyUrl) {
                setAiError('请在设置中填写第三方 OpenAI 兼容地址。');
                return;
            }
            apiUrl = `${apiSettings.thirdPartyUrl.replace(/\/$/, '')}/chat/completions`;
            apiModel = apiSettings.model;
        }

        setIsAISearching(true);
        setStreamingText(''); 
        setAiResults([]);
        setAiError('');

        const fromLang = searchDirection === 'my2zh' ? '缅甸语' : '中文';
        const toLang = searchDirection === 'my2zh' ? '中文' : '缅甸语';
        const prompt = getAIPrompt(trimmedWord, fromLang, toLang);

        const requestBody = {
            model: apiModel,
            messages: [{ role: 'user', content: prompt }],
            stream: true,
            generation_config: {
                thinking_budget_tokens: apiSettings.disableThinking ? 0 : 1024
            }
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiSettings.key}` },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API请求失败: ${response.status} - ${errorBody}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                const lines = buffer.split('\n');
                buffer = lines.pop(); 

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine.startsWith('data: ')) continue;
                    const jsonStr = trimmedLine.replace(/^data: /, '');
                    if (jsonStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            accumulatedText += delta;
                            setStreamingText(accumulatedText);
                        }
                    } catch (e) { console.warn(e); }
                }
            }
            
            const validResults = parseAIResponse(accumulatedText);
            if (validResults.length === 0) {
                 if (accumulatedText.length > 0) console.warn("显示原始内容");
                 else throw new Error("AI 未返回有效内容");
            } else {
                setStreamingText('');
                setAiResults(validResults);
            }

        } catch (error) {
            console.error('AI翻译错误:', error);
            setAiError(`翻译失败: ${error.message}`);
        } finally {
            setIsAISearching(false);
        }
    };
    
    const handleSearch = () => {
        if (useAI) handleAiTranslate();
        else handleLegacySearch();
    };

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognitionRef.current = recognition;
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event) => console.error('语音识别错误:', event.error);
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setWord(transcript);
                if (useAI) handleAiTranslate(transcript);
                else handleLegacySearch(transcript);
            };
        }
    }, []);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('抱歉，您的浏览器不支持语音识别。');
            return;
        }
        if (isListening) {
            recognitionRef.current.stop();
        } else {
            const lang = searchDirection === 'my2zh' ? 'my-MM' : 'zh-CN';
            recognitionRef.current.lang = lang;
            recognitionRef.current.start();
        }
    };
    
    const handleCopy = (text) => navigator.clipboard.writeText(text);
    
    // 🟢 3. 升级朗读功能：支持自定义发音人和语速
    const handleSpeak = (textToSpeak) => {
        // 判断当前结果是中文还是缅甸语
        // searchDirection 是 'my2zh' 时，结果是中文 -> 用 voiceZh
        // searchDirection 是 'zh2my' 时，结果是缅语 -> 用 voiceMy
        const isTargetChinese = searchDirection === 'my2zh';
        const voice = isTargetChinese ? (apiSettings.voiceZh || 'zh-CN-XiaoxiaoNeural') : (apiSettings.voiceMy || 'my-MM-NilarNeural');
        const speed = apiSettings.voiceSpeed || 0;
        
        // 这里的 r 参数控制语速 (rate)，范围通常 -100 到 100
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=${voice}&r=${speed}`; 
        new Audio(url).play().catch(e => alert("朗读服务连接失败，请检查网络"));
    };

    const handleBackTranslate = (text) => { 
        setWord(text); 
        if (useAI) setTimeout(() => handleAiTranslate(text), 50);
    };

    const fromLangText = searchDirection === 'my2zh' ? '缅甸语' : '中文';
    const toLangText = searchDirection === 'my2zh' ? '中文' : '缅甸语';

    return (
        <div className="w-full max-w-lg mx-auto bg-white/90 dark:bg-gray-800/80 backdrop-blur-xl border border-gray-200/80 dark:border-gray-700/50 shadow-lg rounded-2xl p-4 sm:p-6 transition-all duration-300">
            <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Glosbe</span>
                    <label htmlFor="ai-toggle" className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" id="ai-toggle" className="sr-only peer" checked={useAI} onChange={() => setUseAI(!useAI)} />
                        <div className="w-11 h-6 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-cyan-300 dark:peer-focus:ring-cyan-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-cyan-500"></div>
                    </label>
                    <span className="text-sm font-medium text-gray-500 dark:text-gray-400">AI</span>
                </div>
                <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="设置">
                    <Settings size={20} />
                </button>
            </div>

            {/* 🟢 4. 设置面板优化：加入语音选择 */}
            {settingsOpen && (
                <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 border dark:border-gray-700 rounded-lg max-h-[80vh] overflow-y-auto">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-white">全局设置</h3>
                        <button onClick={() => setSettingsOpen(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={18}/></button>
                    </div>
                    
                    <div className="space-y-4">
                        {/* 语音设置区域 */}
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700">
                            <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <Volume2 size={16}/> 语音朗读设置 (Microsoft)
                            </h4>
                            
                            <div className="mb-3">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">中文发音人 (zh-CN)</label>
                                <select 
                                    value={apiSettings.voiceZh} 
                                    onChange={(e) => setApiSettings({...apiSettings, voiceZh: e.target.value})}
                                    className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                    {MS_VOICES.zh.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                </select>
                            </div>

                            <div className="mb-3">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">缅甸语发音人 (my-MM)</label>
                                <select 
                                    value={apiSettings.voiceMy} 
                                    onChange={(e) => setApiSettings({...apiSettings, voiceMy: e.target.value})}
                                    className="w-full px-2 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border rounded focus:outline-none focus:ring-1 focus:ring-cyan-500"
                                >
                                    {MS_VOICES.my.map(v => <option key={v.name} value={v.name}>{v.label}</option>)}
                                </select>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">语速调节: {apiSettings.voiceSpeed > 0 ? '+' : ''}{apiSettings.voiceSpeed}%</label>
                                    <span className="text-xs text-gray-400">正常: 0</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="-50" 
                                    max="50" 
                                    step="5"
                                    value={apiSettings.voiceSpeed} 
                                    onChange={(e) => setApiSettings({...apiSettings, voiceSpeed: parseInt(e.target.value)})}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-cyan-500"
                                />
                            </div>
                        </div>

                        {/* API 设置区域 (折叠或保持展开) */}
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-md border dark:border-gray-700">
                             <h4 className="text-sm font-bold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <Zap size={16}/> API 连接设置
                            </h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="thinking-toggle" className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <Bot size={14} /> 关闭思考模式 (加速)
                                    </label>
                                    <label htmlFor="thinking-toggle" className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="thinking-toggle" className="sr-only peer" checked={apiSettings.disableThinking} onChange={(e) => setApiSettings({...apiSettings, disableThinking: e.target.checked})} />
                                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-cyan-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between">
                                    <label htmlFor="third-party-toggle" className="text-xs font-medium text-gray-600 dark:text-gray-300">使用第三方兼容地址</label>
                                    <label htmlFor="third-party-toggle" className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" id="third-party-toggle" className="sr-only peer" checked={apiSettings.useThirdParty} onChange={(e) => setApiSettings({...apiSettings, useThirdParty: e.target.checked})} />
                                        <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:bg-cyan-500 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                                    </label>
                                </div>
                                {apiSettings.useThirdParty ? (
                                     <div>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">第三方地址</label>
                                        <input type="text" value={apiSettings.thirdPartyUrl} onChange={(e) => setApiSettings({...apiSettings, thirdPartyUrl: e.target.value})} className="w-full mt-1 px-2 py-1.5 text-sm border rounded"/>
                                     </div>
                                ) : (
                                    <div>
                                        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Gemini 地址</label>
                                        <input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full mt-1 px-2 py-1.5 text-sm border rounded"/>
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">模型 (Model)</label>
                                    <input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-2 py-1.5 text-sm border rounded"/>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-gray-600 dark:text-gray-300">密钥 (Key)</label>
                                    <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-2 py-1.5 text-sm border rounded"/>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSaveSettings} className="w-full mt-4 px-4 py-2 text-sm bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600 transition-colors">
                        保存设置
                    </button>
                </div>
            )}

            <div className="relative">
                 <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                    <Search className="w-5 h-5 text-gray-400" />
                </div>
                <textarea
                    ref={textareaRef}
                    rows="1"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSearch();
                        }
                    }}
                    placeholder={isListening ? "正在聆听..." : "输入要翻译的内容..."}
                    className="w-full pl-12 pr-14 py-3 text-base text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none overflow-hidden"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-colors ${
                            isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title="语音输入"
                    >
                        <Mic size={20} />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-3 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    <span>{fromLangText}</span>
                    <button 
                        onClick={handleSwapLanguages} 
                        className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title="切换翻译方向"
                    >
                        <ArrowLeftRight size={16} />
                    </button>
                    <span>{toLangText}</span>
                </div>
                <button
                    onClick={handleSearch}
                    disabled={isAISearching || !word.trim()}
                    className="px-8 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-lg shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                >
                    {isAISearching ? <Loader2 className="animate-spin" /> : "查询"}
                </button>
            </div>
            
            {useAI && (
                 <div className="mt-6 min-h-[50px]">
                    {isAISearching && streamingText && (
                        <div className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50 whitespace-pre-wrap font-semibold text-gray-800 dark:text-white mb-4">
                            {streamingText}
                            <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-cyan-500" />
                        </div>
                    )}

                    {aiError && (
                        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-800/20 text-red-700 dark:text-red-300 text-sm">
                            {aiError}
                        </div>
                    )}

                    {!isAISearching && aiResults.length > 0 && (
                        <div className="space-y-3">
                        {aiResults.map((result, index) => (
                          <div key={index}  className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50">
                            <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400 mb-1">{result.title}</h4>
                            <p className="text-base font-semibold text-gray-800 dark:text-white">
                              {result.translation}
                            </p>
                            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.meaning}</p>
                            <div className="flex items-center gap-1 mt-2 pt-2 border-t border-violet-200 dark:border-gray-700/50 -mx-4 px-3">
                              <button onClick={() => handleCopy(result.translation)} title="复制" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Copy size={14}/></button>
                              <button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Volume2 size={14}/></button>
                              <button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700 transition-colors"><Repeat size={14}/></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlosbeSearchCard;

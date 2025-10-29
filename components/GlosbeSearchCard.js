import { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Settings, X, Loader2, Bot, Copy, Volume2, Repeat, Zap, ChevronDown, ChevronUp } from 'lucide-react';

// 语言配置文件
const LANGUAGES = [
    { name: '中文', code: 'zh-CN', speechCode: 'zh-CN', ttsCode: 'zh-CN-XiaochenMultilingualNeural' },
    { name: '缅甸语', code: 'my-MM', speechCode: 'my-MM', ttsCode: 'my-MM-NilarNeural' },
    { name: 'English', code: 'en-US', speechCode: 'en-US', ttsCode: 'en-US-JennyNeural' },
    { name: 'Tiếng Việt', code: 'vi-VN', speechCode: 'vi-VN', ttsCode: 'vi-VN-HoaiMyNeural' },
    { name: 'ไทย', code: 'th-TH', speechCode: 'th-TH', ttsCode: 'th-TH-NiwatNeural' },
    { name: '한국어', code: 'ko-KR', speechCode: 'ko-KR', ttsCode: 'ko-KR-SunHiNeural' },
    { name: '日本語', code: 'ja-JP', speechCode: 'ja-JP', ttsCode: 'ja-JP-NanamiNeural' },
    { name: 'Español', code: 'es-ES', speechCode: 'es-ES', ttsCode: 'es-ES-ElviraNeural' },
    { name: 'Français', code: 'fr-FR', speechCode: 'fr-FR', ttsCode: 'fr-FR-DeniseNeural' },
    { name: 'Deutsch', code: 'de-DE', speechCode: 'de-DE', ttsCode: 'de-DE-KatjaNeural' },
];

// 高准确率提示词
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}：
“${word}”

请严格按照以下格式输出多个风格版本。
所有翻译必须 首先准确表达原文的核心意思，在任何情况下都不得添加、删减或改变语义。
不要输出任何额外解释、备注或说明。

---

**自然直译版**:
在完全忠实保留原文结构和语义的前提下，使译文符合${toLang}的语法习惯，读起来自然但不改动意思。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**自然流畅版**:
在意思不变的情况下，稍作调整，使译文更贴近${toLang}日常表达，语气顺畅自然。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**口语版**:
使用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常生活中常说的自然表达方式，语气轻松但仍保持原意准确。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**地道表达版**:
遵循${toLang}母语者的思维方式和表达习惯进行意译，使句子听起来自然真实，但绝不偏离原意。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]

---

**文学润色版**:
在精准传达原意的基础上，运用更丰富、更具表现力的词汇和句式进行优化，使表达更显文采和感染力，适合书面语或正式场合。
*   **[${toLang}翻译]**
*   回译: [对上方翻译的${fromLang}回译]
`;

// 高容错解析函数
const parseAIResponse = (responseText) => {
    if (!responseText) return [];
    const sections = responseText.split('---').filter(s => s.trim());
    const results = [];
    sections.forEach(section => {
        const titleMatch = section.match(/\*\*(.*?)\*\*:/);
        const translationMatch = section.match(/\*\s+\*\*(.*?)\*\*/);
        const meaningMatch = section.match(/回译:\s*\[(.*?)\]/);
        if (titleMatch && translationMatch && meaningMatch) {
            results.push({
                title: titleMatch[1].trim(),
                translation: translationMatch[1].trim(),
                meaning: `回译: ${meaningMatch[1].trim()}`,
            });
        }
    });
    return results;
};

const GlosbeSearchCard = () => {
    const [word, setWord] = useState('');
    const [fromLang, setFromLang] = useState(LANGUAGES[0]);
    const [toLang, setToLang] = useState(LANGUAGES[1]);
    const [isListening, setIsListening] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [isAISearching, setIsAISearching] = useState(false);
    const [aiResults, setAiResults] = useState([]);
    const [aiError, setAiError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showFromLangMenu, setShowFromLangMenu] = useState(false);
    const [showToLangMenu, setShowToLangMenu] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    const [apiSettings, setApiSettings] = useState({
        model: 'gemini-pro-flash',
        key: '',
        useThirdParty: false,
        thirdPartyUrl: 'https://gy.zenscaleai.com/v1',
        disableThinking: true,
    });

    const recognitionRef = useRef(null);
    const textareaRef = useRef(null);
    const fromMenuRef = useRef(null);
    const toMenuRef = useRef(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [word]);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (fromMenuRef.current && !fromMenuRef.current.contains(event.target)) setShowFromLangMenu(false);
            if (toMenuRef.current && !toMenuRef.current.contains(event.target)) setShowToLangMenu(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    useEffect(() => {
        const savedSettings = localStorage.getItem('aiApiSettings_v12');
        if (savedSettings) {
            setApiSettings(prevSettings => ({ ...prevSettings, ...JSON.parse(savedSettings) }));
        }
    }, []);

    const handleSaveSettings = () => {
        localStorage.setItem('aiApiSettings_v12', JSON.stringify(apiSettings));
        setSettingsOpen(false);
        alert('设置已保存！');
    };

    const handleLegacySearch = (searchText) => {
        const textToSearch = (searchText || word).trim();
        if (!textToSearch) return;
        const glosbeUrl = `https://glosbe.com/${fromLang.code.split('-')[0]}/${toLang.code.split('-')[0]}/${encodeURIComponent(textToSearch)}`;
        window.open(glosbeUrl, '_blank');
    };

    const handleAiTranslate = async (text) => {
        const trimmedWord = (text || word).trim();
        if (!trimmedWord) return;
        if (!apiSettings.key) {
            setAiError('请点击设置图标，填写API密钥。');
            return;
        }

        let apiUrl;
        let requestBody;
        const prompt = getAIPrompt(trimmedWord, fromLang.name, toLang.name);

        setIsAISearching(true);
        setAiResults('');
        setAiError('');
        setIsExpanded(false);

        // ✅ 关键修复：为不同接口构建不同的请求体
        if (apiSettings.useThirdParty) {
            apiUrl = `${apiSettings.thirdPartyUrl.replace(/\/$/, '')}/chat/completions`;
            requestBody = {
                model: apiSettings.model,
                messages: [{ role: 'user', content: prompt }],
                stream: true,
            };
            // 只有第三方兼容接口才尝试发送 generation_config
            if (apiSettings.disableThinking) {
                 requestBody.generation_config = {
                     thinking_budget_tokens: 0
                 };
            }
        } else {
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${apiSettings.model}:streamGenerateContent?key=${apiSettings.key}`;
            // 官方 Gemini 接口不支持 thinking_budget_tokens，使用正确的 body 结构
            requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
            };
        }
        
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                throw new Error(`API请求失败: ${response.status} - ${errorBody}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                const jsonChunks = chunk.replace(/^data: /gm, '').split('\n').filter(Boolean);
                for (const jsonStr of jsonChunks) {
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.candidates?.[0]?.content?.parts?.[0]?.text || parsed.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            fullResponse += delta;
                            setAiResults(fullResponse);
                        }
                    } catch (e) { /* Ignore */ }
                }
            }
            
            const validResults = parseAIResponse(fullResponse);
            if (validResults.length === 0) {
                console.error("解析失败，原始输出: ", fullResponse);
                throw new Error("AI未能按预期格式返回翻译和回译。");
            }

            setAiResults(validResults);
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
            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event) => console.error('语音识别错误:', event.error);
            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setWord(transcript);
                if (useAI) handleAiTranslate(transcript);
                else handleLegacySearch(transcript);
            };
            recognitionRef.current = recognition;
        }
    }, [useAI, apiSettings, fromLang]);

    const toggleListening = () => {
        if (!recognitionRef.current) return alert('抱歉，您的浏览器不支持语音识别。');
        if (isListening) recognitionRef.current.stop();
        else {
            recognitionRef.current.lang = fromLang.speechCode;
            recognitionRef.current.start();
        }
    };
    
    const handleCopy = (text) => navigator.clipboard.writeText(text);
    const handleSpeak = (textToSpeak) => { 
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=${toLang.ttsCode}&r=-20`; 
        new Audio(url).play(); 
    };
    const handleBackTranslate = (text) => { 
        setWord(text); 
        handleSwapLanguages();
        setTimeout(() => handleAiTranslate(text), 50);
    };

    const handleSwapLanguages = () => {
        setFromLang(toLang);
        setToLang(fromLang);
        setAiResults([]);
        setAiError('');
    };

    const displayedResults = isExpanded ? aiResults : (Array.isArray(aiResults) ? aiResults.slice(0, 1) : aiResults);

    // ... The rest of the JSX remains exactly the same as the previous correct version ...
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
                <button onClick={() => setSettingsOpen(!settingsOpen)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors" title="API设置">
                    <Settings size={20} />
                </button>
            </div>

            {settingsOpen && (
                 <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/50 border dark:border-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-md font-semibold text-gray-800 dark:text-white">API 设置</h3>
                        <button onClick={() => setSettingsOpen(false)} className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><X size={18}/></button>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <label htmlFor="thinking-toggle" className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
                                <Bot size={14} /> 关闭思考模式 (第三方)
                            </label>
                            <label htmlFor="thinking-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="thinking-toggle" className="sr-only peer" checked={apiSettings.disableThinking} onChange={(e) => setApiSettings({...apiSettings, disableThinking: e.target.checked})} />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="third-party-toggle" className="text-xs font-medium text-gray-600 dark:text-gray-300">使用第三方兼容地址</label>
                            <label htmlFor="third-party-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="third-party-toggle" className="sr-only peer" checked={apiSettings.useThirdParty} onChange={(e) => setApiSettings({...apiSettings, useThirdParty: e.target.checked})} />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        {apiSettings.useThirdParty ? (
                             <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">第三方地址</label>
                                <input type="text" value={apiSettings.thirdPartyUrl} onChange={(e) => setApiSettings({...apiSettings, thirdPartyUrl: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md"/>
                             </div>
                        ) : (
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Gemini 接口地址 (官方)</label>
                                <input disabled type="text" value={`https://generativelanguage.googleapis.com/...`} className="w-full mt-1 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 border rounded-md"/>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">模型</label>
                            <input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">密钥 (API Key)</label>
                            <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md"/>
                        </div>
                    </div>
                    <button onClick={handleSaveSettings} className="w-full mt-4 px-4 py-2 text-sm bg-cyan-500 text-white font-semibold rounded-md hover:bg-cyan-600">保存设置</button>
                </div>
            )}
            
            <div className="flex items-center justify-between mb-4">
                <div ref={fromMenuRef} className="relative w-2/5">
                    <button onClick={() => setShowFromLangMenu(!showFromLangMenu)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span className="truncate">{fromLang.name}</span>
                        <ChevronDown size={16} className={`transition-transform ${showFromLangMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showFromLangMenu && (
                        <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                            {LANGUAGES.map(lang => (<button key={lang.code} onClick={() => { setFromLang(lang); setShowFromLangMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">{lang.name}</button>))}
                        </div>
                    )}
                </div>
                <button onClick={handleSwapLanguages} title="切换语言" className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"><ArrowLeftRight size={20} /></button>
                <div ref={toMenuRef} className="relative w-2/5">
                     <button onClick={() => setShowToLangMenu(!showToLangMenu)} className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md">
                        <span className="truncate">{toLang.name}</span>
                        <ChevronDown size={16} className={`transition-transform ${showToLangMenu ? 'rotate-180' : ''}`} />
                    </button>
                    {showToLangMenu && (
                        <div className="absolute top-full left-0 mt-1 w-full max-h-48 overflow-y-auto bg-white dark:bg-gray-800 rounded-md shadow-lg z-10">
                            {LANGUAGES.map(lang => (<button key={lang.code} onClick={() => { setToLang(lang); setShowToLangMenu(false); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">{lang.name}</button>))}
                        </div>
                    )}
                </div>
            </div>

            <div className="relative">
                <div className="absolute top-3 left-4 pointer-events-none"><Search className="w-5 h-5 text-gray-400" /></div>
                <textarea
                    ref={textareaRef}
                    rows="1"
                    value={word}
                    onChange={(e) => setWord(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSearch(); }}}
                    placeholder="输入要翻译的内容..."
                    className="w-full pl-12 pr-24 py-3 text-base text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none overflow-hidden"
                />
                <div className="absolute top-2 right-3 flex items-center gap-1">
                    <button onClick={toggleListening} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'}`} title="语音输入"><Mic size={20} /></button>
                    <button onClick={handleSearch} disabled={isAISearching || !word.trim()} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-md shadow-lg hover:shadow-cyan-500/50 transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isAISearching ? <Loader2 className="animate-spin h-5 w-5" /> : <Search size={20}/>}
                    </button>
                </div>
            </div>

            {useAI && (
                 <div className="mt-6 min-h-[50px]">
                    {isAISearching && (
                        <div className="text-center p-4">
                            <Loader2 className="w-6 h-6 mx-auto animate-spin text-cyan-500" />
                            <p className="mt-2 text-xs text-gray-500">AI 正在翻译...</p>
                        </div>
                    )}
                    {aiError && (<div className="p-3 rounded-lg bg-red-100 dark:bg-red-800/20 text-red-700 dark:text-red-300 text-sm">{aiError}</div>)}
                    
                    {Array.isArray(aiResults) && aiResults.length > 0 && (
                        <>
                            <div className="space-y-3">
                                {displayedResults.map((result, index) => (
                                <div key={index} className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50">
                                    <h4 className="text-sm font-bold text-violet-600 dark:text-violet-400 mb-1">{result.title}</h4>
                                    <p className="text-base font-semibold text-gray-800 dark:text-white">{result.translation}</p>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{result.meaning}</p>
                                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-violet-200 dark:border-gray-700/50 -mx-4 px-3">
                                        <button onClick={() => handleCopy(result.translation)} title="复制" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700"><Copy size={14}/></button>
                                        <button onClick={() => handleSpeak(result.translation)} title="朗读" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700"><Volume2 size={14}/></button>
                                        <button onClick={() => handleBackTranslate(result.translation)} title="回译" className="p-1.5 rounded-full text-gray-500 hover:bg-violet-100 dark:hover:bg-gray-700"><Repeat size={14}/></button>
                                    </div>
                                </div>
                                ))}
                            </div>
                            {aiResults.length > 1 && (
                                <div className="flex justify-center mt-3">
                                    <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1 text-xs font-semibold text-violet-500 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300">
                                        {isExpanded ? '收起' : '展开全部分析'}
                                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default GlosbeSearchCard;

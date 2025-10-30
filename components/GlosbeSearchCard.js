import { useState, useEffect, useRef } from 'react';
import { Search, Mic, ArrowLeftRight, Settings, X, Loader2, Bot, Copy, Volume2, Repeat, Zap } from 'lucide-react';

// ✅ 恢复您最初的中文 Prompt，并移除表情符号
const getAIPrompt = (word, fromLang, toLang) => `
请将以下 ${fromLang} 内容翻译成 ${toLang}： "${word}"
请严格按照下面的格式提供多种风格的翻译结果，不要有任何多余的解释或标题：

**自然直译版**，在保留原文结构和含义的基础上，让译文符合目标语言的表达习惯，读起来流畅自然，不生硬。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**口语版**，采用${toLang === '缅甸语' ? '缅甸' : '中国'}年轻人日常社交中的常用语和流行说法，风格自然亲切，避免书面语和机器翻译痕跡。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**自然意译版**，遵循${toLang}母语者的思维方式和表达习惯进行意译，使句子听起来自然真实，但绝不偏离原意。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]

**通顺意译**，将句子翻译成符合${toLang === '缅甸语' ? '缅甸人' : '中国人'}日常表达习惯的、流畅自然的${toLang}。
*   **[此处为加粗的${toLang}翻译]**
*   回译: [此处为对上方翻译的回译结果]，精准地回译成 ${fromLang}，严禁使用英语或任何其他语言]
`;

// ✅ 增强版、高容错的解析函数
const parseAIResponse = (responseText) => {
    if (!responseText) return [];
    
    // 使用更灵活的正则表达式匹配每个翻译块（无论有无表情符号）
    const translationBlocks = responseText.split(/\*\*.*?\*\*.*?\n/g).slice(1);
    const titles = responseText.match(/\*\*(.*?)\*\*/g);

    if (!translationBlocks || !titles || translationBlocks.length === 0) return [];
    
    const results = [];
    translationBlocks.forEach((block, index) => {
        const lines = block.trim().split('\n');
        const translationLine = lines.find(line => line.includes('*') && !line.includes('回译'));
        const meaningLine = lines.find(line => line.includes('回译:'));

        if (translationLine && meaningLine) {
            results.push({
                // 提取标题，去除**
                title: titles[index]?.replace(/\*/g, '').trim(),
                translation: translationLine.replace(/\*|\[|\]|-/g, '').trim(),
                meaning: meaningLine.trim(),
            });
        }
    });

    // 如果上述解析失败，尝试备用方案
    if (results.length === 0) {
        const sections = responseText.split(/\n\s*\n/);
        sections.forEach(section => {
             const titleMatch = section.match(/\*\*(.*?)\*\*/);
             const translationMatch = section.match(/\*\s+\*\*(.*?)\*\*/);
             const meaningMatch = section.match(/回译:\s*(.*)/);
             if(titleMatch && translationMatch && meaningMatch) {
                 results.push({
                     title: titleMatch[1].trim(),
                     translation: translationMatch[1].trim(),
                     meaning: `回译: ${meaningMatch[1].trim()}`
                 })
             }
        });
    }

    return results;
};

// 语言检测辅助函数
const containsChinese = (text) => /[\u4e00-\u9fa5]/.test(text);

const GlosbeSearchCard = () => {
    const [word, setWord] = useState('');
    const [searchDirection, setSearchDirection] = useState('my2zh');
    const [isListening, setIsListening] = useState(false);
    const [useAI, setUseAI] = useState(true);
    const [isAISearching, setIsAISearching] = useState(false);
    const [aiResults, setAiResults] = useState([]);
    const [aiError, setAiError] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);

    const [apiSettings, setApiSettings] = useState({
        url: 'https://open-gemini-api.deno.dev/v1/chat/completions',
        model: 'gemini-pro-flash',
        key: '',
        useThirdParty: false,
        thirdPartyUrl: 'https://gy.zenscaleai.com/v1',
        disableThinking: true,
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
        const detectedDirection = containsChinese(word) ? 'zh2my' : 'my2zh';
        if (detectedDirection !== searchDirection) {
            setSearchDirection(detectedDirection);
        }
    }, [word]);

    useEffect(() => {
        const savedSettings = localStorage.getItem('aiApiSettings_v9');
        if (savedSettings) {
            setApiSettings(prevSettings => ({ ...prevSettings, ...JSON.parse(savedSettings) }));
        }
    }, []);

    const handleSaveSettings = () => {
        localStorage.setItem('aiApiSettings_v9', JSON.stringify(apiSettings));
        setSettingsOpen(false);
        alert('设置已保存！');
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
        setAiResults('');
        setAiError('');

        const currentDirection = containsChinese(trimmedWord) ? 'zh2my' : 'my2zh';
        const fromLang = currentDirection === 'my2zh' ? '缅甸语' : '中文';
        const toLang = currentDirection === 'my2zh' ? '中文' : '缅甸语';
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
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
                for (const line of lines) {
                    const jsonStr = line.replace(/^data: /, '');
                    if (jsonStr.includes('[DONE]')) continue;
                    try {
                        const parsed = JSON.parse(jsonStr);
                        const delta = parsed.choices?.[0]?.delta?.content || '';
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
    }, [useAI, apiSettings]);

    const toggleListening = () => {
        if (!recognitionRef.current) {
            alert('抱歉，您的浏览器不支持语音识别。');
            return;
        }
        if (isListening) recognitionRef.current.stop();
        else {
            const lang = containsChinese(word) ? 'zh-CN' : 'my-MM';
            recognitionRef.current.lang = lang;
            recognitionRef.current.start();
        }
    };
    
    const handleCopy = (text) => navigator.clipboard.writeText(text);
    const handleSpeak = (textToSpeak) => { 
        const lang = searchDirection === 'my2zh' ? 'zh-CN-XiaochenMultilingualNeural' : 'my-MM-NilarNeural'; 
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(textToSpeak)}&v=${lang}&r=-20`; 
        new Audio(url).play(); 
    };
    const handleBackTranslate = (text) => { 
        setWord(text); 
        if (useAI) {
            setTimeout(() => handleAiTranslate(text), 50);
        }
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
                                <Bot size={14} /> 关闭思考模式
                            </label>
                            <label htmlFor="thinking-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="thinking-toggle" className="sr-only peer" checked={apiSettings.disableThinking} onChange={(e) => setApiSettings({...apiSettings, disableThinking: e.target.checked})} />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        <div className="flex items-center justify-between">
                            <label htmlFor="third-party-toggle" className="text-xs font-medium text-gray-600 dark:text-gray-300">使用第三方 OpenAI 兼容地址</label>
                            <label htmlFor="third-party-toggle" className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" id="third-party-toggle" className="sr-only peer" checked={apiSettings.useThirdParty} onChange={(e) => setApiSettings({...apiSettings, useThirdParty: e.target.checked})} />
                                <div className="w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
                            </label>
                        </div>
                        {apiSettings.useThirdParty ? (
                             <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">第三方兼容地址</label>
                                <input type="text" value={apiSettings.thirdPartyUrl} onChange={(e) => setApiSettings({...apiSettings, thirdPartyUrl: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                             </div>
                        ) : (
                            <div>
                                <label className="text-xs font-medium text-gray-600 dark:text-gray-300">Gemini 接口地址</label>
                                <input type="text" value={apiSettings.url} onChange={(e) => setApiSettings({...apiSettings, url: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                            </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">模型</label>
                            <input type="text" value={apiSettings.model} onChange={(e) => setApiSettings({...apiSettings, model: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
                        </div>
                        <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-300">密钥 (API Key)</label>
                            <input type="password" value={apiSettings.key} onChange={(e) => setApiSettings({...apiSettings, key: e.target.value})} className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-gray-700 border rounded-md focus:outline-none focus:ring-1 focus:ring-cyan-500"/>
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
                    placeholder="输入要翻译的内容..."
                    className="w-full pl-12 pr-14 py-3 text-base text-gray-900 dark:text-gray-100 bg-gray-100/60 dark:bg-gray-900/60 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 transition-all duration-300 resize-none overflow-hidden"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                    <button
                        onClick={toggleListening}
                        className={`p-2 rounded-full transition-colors ${
                            isListening ? 'bg-red-500/20 text-red-500' : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                        title="语音输入"
                    >
                        <Mic size={20} />
                    </button>
                </div>
            </div>
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                    <span>{fromLangText}</span>
                    <ArrowLeftRight size={16} />
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
                    {isAISearching && typeof aiResults === 'string' && (
                        <div className="p-4 rounded-xl bg-violet-50 dark:bg-gray-900/50 border border-violet-200 dark:border-gray-700/50 whitespace-pre-wrap font-semibold text-gray-800 dark:text-white">
                            {aiResults}
                            <Loader2 className="inline-block w-4 h-4 ml-2 animate-spin text-cyan-500" />
                        </div>
                    )}
                    {aiError && (
                        <div className="p-3 rounded-lg bg-red-100 dark:bg-red-800/20 text-red-700 dark:text-red-300 text-sm">
                            {aiError}
                        </div>
                    )}
                    {Array.isArray(aiResults) && aiResults.length > 0 && (
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

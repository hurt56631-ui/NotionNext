
// components/kouyu.js

import { useState, useMemo, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Languages, Mic, Loader2, Volume2, X, PlayCircle } from 'lucide-react';
import { speakingCategories } from '@/data/speaking-structure';

// --- TTS 模块 (保持不变) ---
const ttsCache = new Map();
const getTTSAudio = async (text, voice, rate = 0) => {
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('TTS API Error');
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`获取TTS失败: "${text}"`, e); return null; }
};

// --- 全屏单句展示组件 (新) ---
const SinglePhraseView = ({ phrase, onClose, audioSettings }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { isReadingChinese, isReadingBurmese, chineseRate, burmeseRate } = audioSettings;

    // 播放逻辑
    const playAudio = async () => {
        if (isPlaying) return;
        setIsPlaying(true);
        try {
            if (isReadingChinese) {
                const audioZh = await getTTSAudio(phrase.chinese, 'zh-CN-XiaoyanNeural', chineseRate);
                if (audioZh) {
                    await new Promise(resolve => { audioZh.onended = resolve; audioZh.play(); });
                }
            }
            if (isReadingBurmese) {
                const audioMy = await getTTSAudio(phrase.burmese, 'my-MM-ThihaNeural', burmeseRate);
                if (audioMy) {
                    await new Promise(resolve => { audioMy.onended = resolve; audioMy.play(); });
                }
            }
        } finally {
            setIsPlaying(false);
        }
    };

    // 进入全屏自动播放一次
    useEffect(() => {
        playAudio();
    }, []);

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-fade-in">
            {/* 全屏顶部关闭栏 */}
            <div className="p-4 flex justify-between items-center">
                <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200">
                    <X size={28} className="text-gray-600 dark:text-gray-300" />
                </button>
                <span className="text-gray-400 text-sm">点击屏幕重播</span>
                <div className="w-10"></div> {/* 占位，保持平衡 */}
            </div>

            {/* 全屏内容区 - 居中显示 */}
            <div 
                className="flex-1 flex flex-col justify-center items-center px-6 text-center cursor-pointer pb-20"
                onClick={playAudio}
            >
                {/* 拼音在上方 (无数字声调) */}
                <p className="text-2xl text-gray-500 dark:text-gray-400 mb-4 font-light tracking-wide">
                    {phrase.pinyin}
                </p>

                {/* 汉字居中 */}
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-10 leading-relaxed">
                    {phrase.chinese}
                </h1>

                {/* 缅文在下方 */}
                <p className="text-2xl md:text-3xl text-blue-600 dark:text-blue-400 font-medium leading-relaxed">
                    {phrase.burmese}
                </p>

                {phrase.xieyin && (
                    <p className="mt-8 text-lg text-teal-600 dark:text-teal-400 italic bg-teal-50 dark:bg-teal-900/30 px-4 py-2 rounded-lg">
                        谐音: {phrase.xieyin}
                    </p>
                )}

                {/* 播放状态指示 */}
                <div className={`mt-12 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-30'}`}>
                    <Volume2 size={48} className="text-blue-500 animate-pulse" />
                </div>
            </div>
        </div>
    );
};

// --- 短句列表页面组件 ---
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    // 默认开启中文和缅文朗读
    const [isReadingChinese, setIsReadingChinese] = useState(true);
    const [isReadingBurmese, setIsReadingBurmese] = useState(true);
    // 语速状态
    const [chineseRate, setChineseRate] = useState(0);
    const [burmeseRate, setBurmeseRate] = useState(-0.3);
    
    // 全屏查看状态
    const [selectedPhrase, setSelectedPhrase] = useState(null);

    // 处理数据：生成不带数字的拼音
    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        // 修改：使用 symbol 模式显示声调符号 (ā)，而不是数字
        pinyin: pinyin(phrase.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    // 如果有选中的短句，渲染全屏组件
    if (selectedPhrase) {
        return (
            <SinglePhraseView 
                phrase={selectedPhrase} 
                onClose={() => setSelectedPhrase(null)}
                audioSettings={{ isReadingChinese, isReadingBurmese, chineseRate, burmeseRate }}
            />
        );
    }

    return (
        <div className="animate-fade-in pb-10">
            {/* 顶部导航 */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-20 shadow-sm">
                <div className="p-4 flex items-center justify-between">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <ChevronLeft size={24} />
                    </button>
                    <div className="text-center">
                        <h1 className="text-lg font-bold truncate max-w-[200px]">{subcategory.name}</h1>
                        <p className="text-xs text-gray-500">{category.category}</p>
                    </div>
                    <div className="w-8"></div>
                </div>

                {/* 顶部控制器：发音人开关 + 语速控制 */}
                <div className="px-4 pb-4 space-y-3">
                    {/* 发音人开关 */}
                    <div className="flex items-center gap-3">
                        <button 
                            onClick={() => setIsReadingChinese(!isReadingChinese)} 
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isReadingChinese ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100 border-blue-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                        >
                            <Languages size={16} /> 中文朗读
                        </button>
                        <button 
                            onClick={() => setIsReadingBurmese(!isReadingBurmese)} 
                            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-all ${isReadingBurmese ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100 border-green-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}
                        >
                            <Mic size={16} /> 缅文朗读
                        </button>
                    </div>

                    {/* 语速控制条 (紧接在发音人下方) */}
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-gray-500">中文语速</label>
                                <span className="text-xs text-blue-500">{chineseRate}</span>
                            </div>
                            <input type="range" min="-0.5" max="0.5" step="0.1" value={chineseRate} onChange={e => setChineseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                        </div>
                        <div>
                            <div className="flex justify-between mb-1">
                                <label className="text-xs text-gray-500">缅文语速</label>
                                <span className="text-xs text-green-500">{burmeseRate}</span>
                            </div>
                            <input type="range" min="-0.5" max="0.5" step="0.1" value={burmeseRate} onChange={e => setBurmeseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500" />
                        </div>
                    </div>
                </div>
            </div>

            {/* 短句列表 */}
            <div className="px-4 mt-4 space-y-4">
                {processedPhrases.map(phrase => (
                    <div 
                        key={phrase.id} 
                        onClick={() => setSelectedPhrase(phrase)} // 点击进入全屏
                        className="group bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-md active:scale-[0.99] transition-all cursor-pointer relative overflow-hidden"
                    >
                        {/* 列表项布局：拼音在汉字上方，整体居中 */}
                        <div className="flex flex-col items-center text-center">
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1 font-sans">{phrase.pinyin}</p>
                            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">{phrase.chinese}</h3>
                            <p className="text-md text-blue-600 dark:text-blue-400 font-medium">{phrase.burmese}</p>
                        </div>
                        
                        {/* 右下角小图标提示可点击 */}
                        <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <PlayCircle size={20} className="text-gray-300 dark:text-gray-600" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 主页/分类列表视图 (保持不变，略微美化) ---
const MainView = ({ onSubcategoryClick }) => {
    return (
        <div className="space-y-6">
            {speakingCategories.map(category => (
                <div key={category.category} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                        <span className="text-2xl filter drop-shadow-sm">{category.icon}</span>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {category.subcategories.map(subcategory => (
                            <button 
                                key={subcategory.name} 
                                onClick={() => onSubcategoryClick(category, subcategory)}
                                className="px-3 py-3 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 hover:shadow-md transition-all duration-200 text-center truncate"
                            >
                                {subcategory.name}
                            </button>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};

// --- 根组件 KouyuPage ---
export default function KouyuPage() {
    const [view, setView] = useState('main'); 
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [phrases, setPhrases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // 搜索功能状态
    const [searchTerm, setSearchTerm] = useState('');
    const [allPhrasesForSearch, setAllPhrasesForSearch] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const handleSubcategoryClick = async (category, subcategory) => {
        setIsLoading(true);
        setView('phrases');
        setSelectedCategory(category);
        setSelectedSubcategory(subcategory);
        try {
            const module = await import(`@/data/speaking/${subcategory.file}.js`);
            setPhrases(module.default);
        } catch (e) {
            console.error("加载短句文件失败:", e);
            setPhrases([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBackToMain = () => {
        setView('main');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPhrases([]);
    };

    // 搜索数据加载
    useEffect(() => {
        const loadAllDataForSearch = async () => {
            if (searchTerm && allPhrasesForSearch.length === 0) {
                setIsSearching(true);
                const allPromises = speakingCategories.flatMap(cat => 
                    cat.subcategories.map(sub => 
                        import(`@/data/speaking/${sub.file}.js`)
                            .then(module => module.default)
                            .catch(() => [])
                    )
                );
                const allLoadedPhrases = (await Promise.all(allPromises)).flat();
                setAllPhrasesForSearch(allLoadedPhrases);
                setIsSearching(false);
            }
        };
        if(searchTerm) loadAllDataForSearch();
    }, [searchTerm, allPhrasesForSearch]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lowerCaseTerm = searchTerm.toLowerCase();
        // 搜索时也使用 symbol 模式，以防万一，但主要匹配汉字
        return allPhrasesForSearch.filter(phrase => 
            phrase.chinese.toLowerCase().includes(lowerCaseTerm) || 
            phrase.burmese.toLowerCase().includes(lowerCaseTerm)
        );
    }, [searchTerm, allPhrasesForSearch]);


    const renderContent = () => {
        if (isLoading) {
            return <div className="flex flex-col justify-center items-center py-20 text-gray-400"><Loader2 className="animate-spin mb-2 text-blue-500" size={32} /> 加载中...</div>;
        }

        if (searchTerm) {
            return isSearching 
                ? <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                : <PhraseListPage 
                    phrases={searchResults} 
                    category={{ category: '搜索' }} 
                    subcategory={{ name: `"${searchTerm}" 的结果` }} 
                    onBack={() => setSearchTerm('')} 
                  />;
        }
        
        switch (view) {
            case 'phrases':
                return <PhraseListPage phrases={phrases} category={selectedCategory} subcategory={selectedSubcategory} onBack={handleBackToMain} />;
            case 'main':
            default:
                return <MainView onSubcategoryClick={handleSubcategoryClick} />;
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
            {/* 主标题区 - 仅在主页显示 */}
            {view === 'main' && !searchTerm && (
                <div className='text-center pt-8 pb-6 px-4'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight'>口语练习中心</h1>
                    <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>选择场景或搜索关键词开始学习</p>
                </div>
            )}
            
            {/* 搜索框 - 仅在主页显示 */}
            {view === 'main' && (
                <div className={`sticky top-0 z-10 px-4 pb-2 ${searchTerm ? 'pt-4 bg-white' : ''}`}>
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="全局搜索中文或缅文..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all shadow-sm group-hover:shadow-md"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search size={20} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                <X size={18} />
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            {/* 内容区域 */}
            <div className={`${view === 'main' ? 'px-4 pb-8' : ''}`}>
                {renderContent()}
            </div>
        </div>
    );
                            }

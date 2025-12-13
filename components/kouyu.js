// components/kouyu.js

import { useState, useMemo, useEffect, useRef } from 'react';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Languages, Mic, Loader2, Volume2, X, PlayCircle, Settings2, LayoutList, RectangleHorizontal } from 'lucide-react';
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

// --- 单个短句大卡片视图 (全屏轮播模式) ---
const FullScreenCard = ({ phrase, onNext, onPrev, onClose, audioSettings, hasNext, hasPrev }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const { isReadingChinese, isReadingBurmese, chineseRate, burmeseRate } = audioSettings;

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
                // 稍微停顿
                await new Promise(r => setTimeout(r, 300));
                const audioMy = await getTTSAudio(phrase.burmese, 'my-MM-ThihaNeural', burmeseRate);
                if (audioMy) {
                    await new Promise(resolve => { audioMy.onended = resolve; audioMy.play(); });
                }
            }
        } finally {
            setIsPlaying(false);
        }
    };

    // 自动播放
    useEffect(() => {
        playAudio();
    }, [phrase]); // 当短句切换时自动播放

    return (
        <div className="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col animate-fade-in">
            {/* 顶部栏 */}
            <div className="p-4 flex justify-between items-center border-b dark:border-gray-800">
                <button onClick={onClose} className="p-2 rounded-full bg-gray-100 dark:bg-gray-800">
                    <X size={24} />
                </button>
                <div className="flex gap-4">
                     <button disabled={!hasPrev} onClick={onPrev} className="disabled:opacity-30 p-2 font-bold text-lg">← 上一句</button>
                     <button disabled={!hasNext} onClick={onNext} className="disabled:opacity-30 p-2 font-bold text-lg">下一句 →</button>
                </div>
            </div>

            {/* 内容区 */}
            <div 
                className="flex-1 flex flex-col justify-center items-center px-6 text-center cursor-pointer overflow-y-auto"
                onClick={playAudio}
            >
                {/* 拼音 */}
                <p className="text-2xl text-gray-500 dark:text-gray-400 mb-6 font-light tracking-wider font-sans">
                    {phrase.pinyin}
                </p>

                {/* 中文 */}
                <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-8 leading-relaxed">
                    {phrase.chinese}
                </h1>

                {/* 缅文 */}
                <p className="text-2xl md:text-3xl text-blue-600 dark:text-blue-400 font-medium leading-relaxed mb-6">
                    {phrase.burmese}
                </p>

                {/* 缅文谐音 (模拟中文发音) */}
                {phrase.xieyin && (
                    <div className="mt-4 px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl border border-yellow-100 dark:border-yellow-800/30">
                        <p className="text-sm text-gray-400 mb-1">中文拟音 (缅文拼读)</p>
                        <p className="text-xl text-yellow-700 dark:text-yellow-500 font-bold">
                            {phrase.xieyin}
                        </p>
                    </div>
                )}

                <div className={`mt-12 transition-opacity duration-300 ${isPlaying ? 'opacity-100' : 'opacity-20'}`}>
                    <Volume2 size={48} className="text-blue-500 animate-pulse" />
                </div>
                <p className="mt-4 text-gray-300 text-sm">点击屏幕重播</p>
            </div>
        </div>
    );
};

// --- 短句列表页面组件 ---
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    // 状态管理
    const [viewMode, setViewMode] = useState('list'); // 'list' | 'focus'
    const [currentIndex, setCurrentIndex] = useState(0); // 当前在大卡片模式下显示的索引
    
    // 音频设置
    const [isReadingChinese, setIsReadingChinese] = useState(true);
    const [isReadingBurmese, setIsReadingBurmese] = useState(true);
    const [chineseRate, setChineseRate] = useState(0);
    const [burmeseRate, setBurmeseRate] = useState(-0.3);
    const [showSettings, setShowSettings] = useState(false); // 折叠设置面板

    // 处理数据：拼音无数字声调
    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        pinyin: pinyin(phrase.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    // 切换到大卡片模式
    const openFocusMode = (index) => {
        setCurrentIndex(index);
        setViewMode('focus');
    };

    // 列表模式下的点击播放逻辑
    const handleListCardClick = async (phrase) => {
        // 如果当前是列表模式，点击可能只是想播放，或者你想直接进入全屏？
        // 根据你的要求："点击细分类后能独立全屏打开短句"，这里设定点击直接进入全屏模式
        const index = processedPhrases.findIndex(p => p.id === phrase.id);
        openFocusMode(index);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 animate-fade-in flex flex-col">
            
            {/* 全屏大卡片视图层 */}
            {viewMode === 'focus' && (
                <FullScreenCard 
                    phrase={processedPhrases[currentIndex]}
                    onNext={() => setCurrentIndex(c => Math.min(c + 1, processedPhrases.length - 1))}
                    onPrev={() => setCurrentIndex(c => Math.max(c - 1, 0))}
                    onClose={() => setViewMode('list')}
                    audioSettings={{ isReadingChinese, isReadingBurmese, chineseRate, burmeseRate }}
                    hasNext={currentIndex < processedPhrases.length - 1}
                    hasPrev={currentIndex > 0}
                />
            )}

            {/* 顶部控制栏 (Sticky) */}
            <div className="sticky top-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md z-40 shadow-sm border-b dark:border-gray-800">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button onClick={onBack} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                        <ChevronLeft size={24} />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <span className="font-bold text-lg">{subcategory.name}</span>
                        <span className="text-xs text-gray-500">{processedPhrases.length} 个短句</span>
                    </div>

                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 -mr-2 rounded-full ${showSettings ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100'}`}
                    >
                        <Settings2 size={24} />
                    </button>
                </div>

                {/* 可折叠的设置面板 */}
                {showSettings && (
                    <div className="px-4 pb-4 animate-slide-down border-t dark:border-gray-800 pt-4">
                         {/* 朗读开关 */}
                        <div className="flex gap-2 mb-4">
                            <button 
                                onClick={() => setIsReadingChinese(!isReadingChinese)} 
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${isReadingChinese ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                            >
                                <Languages size={16}/> 中文朗读
                            </button>
                            <button 
                                onClick={() => setIsReadingBurmese(!isReadingBurmese)} 
                                className={`flex-1 py-2 rounded-lg text-sm font-medium border flex items-center justify-center gap-2 ${isReadingBurmese ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                            >
                                <Mic size={16}/> 缅文朗读
                            </button>
                        </div>
                        {/* 语速 */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">中文语速: {chineseRate}</label>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={chineseRate} onChange={e => setChineseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 mb-1 block">缅文语速: {burmeseRate}</label>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={burmeseRate} onChange={e => setBurmeseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 列表内容区 */}
            <div className="flex-1 px-4 py-4 space-y-3 pb-20">
                {processedPhrases.map((phrase, idx) => (
                    <div 
                        key={phrase.id} 
                        onClick={() => handleListCardClick(phrase)}
                        className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 active:scale-[0.98] transition-transform cursor-pointer"
                    >
                        <div className="flex flex-col items-start gap-1">
                            {/* 拼音在汉字上面 */}
                            <span className="text-sm text-gray-500 font-sans">{phrase.pinyin}</span>
                            
                            <div className="flex justify-between items-start w-full">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white leading-normal">
                                    {phrase.chinese}
                                </h3>
                                <PlayCircle size={20} className="text-gray-300 mt-1 shrink-0" />
                            </div>
                            
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mt-1">
                                {phrase.burmese}
                            </p>
                            
                            {/* 列表页也显示谐音，用不同颜色区分 */}
                            {phrase.xieyin && (
                                <p className="text-sm text-yellow-600 dark:text-yellow-500 mt-1 bg-yellow-50 dark:bg-yellow-900/10 px-2 py-1 rounded inline-block">
                                    {phrase.xieyin}
                                </p>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- 主页/分类列表视图 ---
const MainView = ({ onSubcategoryClick }) => {
    return (
        <div className="space-y-6 pb-10">
            {speakingCategories.map(category => (
                <div key={category.category} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                        <span className="text-2xl">{category.icon}</span>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {category.subcategories.map(subcategory => (
                            <button 
                                key={subcategory.name} 
                                onClick={() => onSubcategoryClick(category, subcategory)}
                                className="px-3 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all text-center border border-gray-100 dark:border-gray-700"
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
    
    // 搜索
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
            console.error("加载失败:", e);
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

    useEffect(() => {
        const loadSearchData = async () => {
            if (searchTerm && allPhrasesForSearch.length === 0) {
                setIsSearching(true);
                const allPromises = speakingCategories.flatMap(cat => 
                    cat.subcategories.map(sub => 
                        import(`@/data/speaking/${sub.file}.js`).then(m => m.default).catch(() => [])
                    )
                );
                const results = (await Promise.all(allPromises)).flat();
                setAllPhrasesForSearch(results);
                setIsSearching(false);
            }
        };
        if(searchTerm) loadSearchData();
    }, [searchTerm, allPhrasesForSearch]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const term = searchTerm.toLowerCase();
        return allPhrasesForSearch.filter(p => 
            p.chinese.includes(term) || p.burmese.includes(term)
        );
    }, [searchTerm, allPhrasesForSearch]);

    const renderContent = () => {
        if (isLoading) return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>;
        if (searchTerm) {
            return isSearching 
                ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                : <PhraseListPage phrases={searchResults} category={{category: '搜索'}} subcategory={{name: searchTerm}} onBack={() => setSearchTerm('')} />;
        }
        if (view === 'phrases') return <PhraseListPage phrases={phrases} category={selectedCategory} subcategory={selectedSubcategory} onBack={handleBackToMain} />;
        return <MainView onSubcategoryClick={handleSubcategoryClick} />;
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
             {view === 'main' && !searchTerm && (
                <div className='text-center pt-8 pb-4 px-4'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white'>口语练习</h1>
                    <p className='mt-2 text-sm text-gray-500'>点击卡片全屏学习</p>
                </div>
            )}
            
            {view === 'main' && (
                <div className="sticky top-0 z-10 px-4 pb-2 bg-gray-50/90 backdrop-blur-sm pt-2">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="搜索..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <Search className="absolute left-3 top-3.5 text-gray-400" size={20} />
                        {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-3 top-3.5 text-gray-400"><X size={20}/></button>}
                    </div>
                </div>
            )}
            
            <div className={view === 'main' ? 'px-4' : ''}>
                {renderContent()}
            </div>
        </div>
    );
                    }

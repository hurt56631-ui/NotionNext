
import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom'; // 引入 Portal
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Languages, Mic, Loader2, Volume2, Settings2, PlayCircle, StopCircle, X } from 'lucide-react';
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

// --- 全屏传送门组件 (关键修改：实现真全屏) ---
const FullScreenPortal = ({ children }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        // 锁定背景滚动
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);
    
    if (!mounted || typeof document === 'undefined') return null;
    
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-50 dark:bg-gray-900 flex flex-col animate-in fade-in duration-200">
            {children}
        </div>,
        document.body
    );
};

// --- 短句列表页面组件 ---
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    // 音频设置状态
    const [isReadingChinese, setIsReadingChinese] = useState(true);
    const [isReadingBurmese, setIsReadingBurmese] = useState(true);
    const [chineseRate, setChineseRate] = useState(0);
    const [burmeseRate, setBurmeseRate] = useState(-0.3);
    const [showSettings, setShowSettings] = useState(false);
    
    // 播放状态
    const [playingId, setPlayingId] = useState(null); // 当前正在播放的卡片ID

    // 处理数据：拼音符号化
    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        pinyin: pinyin(phrase.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    // 播放逻辑
    const handleCardClick = async (phrase) => {
        // 如果点击的是当前正在播放的，则停止（可选逻辑，这里简单处理为重播或忽略）
        if (playingId === phrase.id) return;

        setPlayingId(phrase.id);
        try {
            if (isReadingChinese) {
                const audioZh = await getTTSAudio(phrase.chinese, 'zh-CN-XiaoyanNeural', chineseRate);
                if (audioZh) {
                    await new Promise(resolve => { 
                        audioZh.onended = resolve; 
                        audioZh.play().catch(() => resolve()); // 捕获播放错误防止卡死
                    });
                }
            }
            if (isReadingBurmese) {
                // 中文读完稍微停顿
                if (isReadingChinese) await new Promise(r => setTimeout(r, 300));
                
                const audioMy = await getTTSAudio(phrase.burmese, 'my-MM-ThihaNeural', burmeseRate);
                if (audioMy) {
                    await new Promise(resolve => { 
                        audioMy.onended = resolve; 
                        audioMy.play().catch(() => resolve());
                    });
                }
            }
        } catch (error) {
            console.error("播放出错", error);
        } finally {
            setPlayingId(null); // 播放结束，重置状态
        }
    };

    return (
        <FullScreenPortal>
            {/* 顶部固定导航栏 */}
            <div className="flex-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10 shadow-sm">
                <div className="px-4 py-3 flex items-center justify-between">
                    <button 
                        onClick={onBack} 
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft size={28} />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <h1 className="font-bold text-lg text-gray-800 dark:text-white">{subcategory.name}</h1>
                        <span className="text-xs text-gray-500">{category.category} · {processedPhrases.length}句</span>
                    </div>

                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 -mr-2 rounded-full transition-colors ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                    >
                        <Settings2 size={24} />
                    </button>
                </div>

                {/* 设置面板 (可折叠) */}
                {showSettings && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                         <div className="flex gap-3 mb-4">
                            <button 
                                onClick={() => setIsReadingChinese(!isReadingChinese)} 
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${isReadingChinese ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                <Languages size={16}/> 中文朗读
                            </button>
                            <button 
                                onClick={() => setIsReadingBurmese(!isReadingBurmese)} 
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${isReadingBurmese ? 'bg-green-500 text-white border-green-500 shadow-md shadow-green-200' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                <Mic size={16}/> 缅文朗读
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-xs font-medium text-gray-500">中文语速</label>
                                    <span className="text-xs text-blue-500 font-bold">{chineseRate}</span>
                                </div>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={chineseRate} onChange={e => setChineseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-xs font-medium text-gray-500">缅文语速</label>
                                    <span className="text-xs text-green-500 font-bold">{burmeseRate}</span>
                                </div>
                                <input type="range" min="-0.5" max="0.5" step="0.1" value={burmeseRate} onChange={e => setBurmeseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 列表内容区 (可滚动) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 bg-gray-50 dark:bg-gray-900">
                {processedPhrases.map((phrase) => {
                    const isPlaying = playingId === phrase.id;
                    return (
                        <div 
                            key={phrase.id} 
                            onClick={() => handleCardClick(phrase)}
                            className={`
                                relative bg-white dark:bg-gray-800 rounded-2xl p-6 
                                shadow-sm transition-all duration-300 cursor-pointer border-2
                                flex flex-col items-center text-center
                                ${isPlaying 
                                    ? 'border-blue-400 dark:border-blue-500 shadow-lg scale-[1.01]' 
                                    : 'border-transparent hover:border-gray-100 dark:hover:border-gray-700 active:scale-[0.98]'
                                }
                            `}
                        >
                            {/* 播放状态图标 */}
                            <div className={`absolute top-4 right-4 transition-colors duration-300 ${isPlaying ? 'text-blue-500' : 'text-gray-200 dark:text-gray-700'}`}>
                                {isPlaying ? <Loader2 size={20} className="animate-spin" /> : <Volume2 size={20} />}
                            </div>

                            {/* 1. 拼音 (上方) */}
                            <div className="text-sm text-gray-400 dark:text-gray-500 font-sans mb-1 tracking-wider">
                                {phrase.pinyin}
                            </div>
                            
                            {/* 2. 中文 (居中, 加大) */}
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 leading-relaxed">
                                {phrase.chinese}
                            </h3>
                            
                            {/* 3. 缅文 (下方, 蓝色) */}
                            <p className="text-lg text-blue-600 dark:text-blue-400 font-medium mb-3 leading-relaxed">
                                {phrase.burmese}
                            </p>
                            
                            {/* 4. 谐音 (底部, 黄色背景高亮) */}
                            {phrase.xieyin && (
                                <div className="inline-block px-4 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30 rounded-full">
                                    <p className="text-sm font-medium text-amber-700 dark:text-amber-500">
                                        {phrase.xieyin}
                                    </p>
                                </div>
                            )}
                        </div>
                    );
                })}
                
                <div className="h-10"></div> {/* 底部占位 */}
            </div>
        </FullScreenPortal>
    );
};

// --- 主页/分类列表视图 ---
const MainView = ({ onSubcategoryClick }) => {
    return (
        <div className="space-y-6 pb-10">
            {speakingCategories.map(category => (
                <div key={category.category} className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
                        <span className="text-3xl filter drop-shadow-sm">{category.icon}</span>
                        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {category.subcategories.map(subcategory => (
                            <button 
                                key={subcategory.name} 
                                onClick={() => onSubcategoryClick(category, subcategory)}
                                className="px-3 py-4 text-sm font-bold text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 hover:shadow-md transition-all duration-200 text-center border border-gray-100 dark:border-gray-700 truncate"
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
        // 这里设置为 phrases 视图，但在 renderContent 中会通过 Portal 渲染覆盖全屏
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

    // 返回主界面：重置所有状态
    const handleBackToMain = () => {
        setView('main');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPhrases([]);
    };

    // 搜索逻辑
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
        if (isLoading) {
            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                    <Loader2 className="animate-spin text-blue-500" size={40} />
                </div>
            );
        }

        // 搜索结果页 (使用相同的 PhraseListPage，但参数略有不同)
        if (searchTerm) {
            return isSearching 
                ? <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-blue-500" /></div>
                : <PhraseListPage 
                    phrases={searchResults} 
                    category={{category: '搜索结果'}} 
                    subcategory={{name: `"${searchTerm}"`}} 
                    onBack={() => setSearchTerm('')} 
                  />;
        }
        
        // 短句列表页 (Portal 渲染)
        if (view === 'phrases') {
            return <PhraseListPage phrases={phrases} category={selectedCategory} subcategory={selectedSubcategory} onBack={handleBackToMain} />;
        }

        // 默认显示分类列表
        return <MainView onSubcategoryClick={handleSubcategoryClick} />;
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
             {/* 仅在主页显示标题 */}
             {view === 'main' && !searchTerm && (
                <div className='text-center pt-8 pb-4 px-4'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight'>口语练习</h1>
                    <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>地道中文口语 · 缅文谐音助记</p>
                </div>
            )}
            
            {/* 仅在主页显示搜索框 */}
            {view === 'main' && (
                <div className="sticky top-0 z-10 px-4 pb-2 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm pt-2">
                    <div className="relative group">
                        <input 
                            type="text" 
                            placeholder="搜索中文或缅文..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-11 pr-4 py-3.5 bg-white dark:bg-gray-800 border-2 border-gray-100 dark:border-gray-700 rounded-2xl shadow-sm focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                            <Search size={20} className="text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                                <X size={20}/>
                            </button>
                        )}
                    </div>
                </div>
            )}
            
            <div className={view === 'main' ? 'px-4' : ''}>
                {renderContent()}
            </div>
        </div>
    );
}

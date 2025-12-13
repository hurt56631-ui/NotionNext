import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, Languages, Mic, Loader2, Volume2, Settings2, X, PlayCircle } from 'lucide-react';
import { speakingCategories } from '@/data/speaking-structure';

// --- 全局音频控制器 (解决音频重叠与延迟题) ---
// 放在组件外部，确保全局唯一
const GlobalAudioController = {
    currentAudio: null, // 当前播放的 Audio 对象
    currentId: null,    // 当前播放的短句 ID

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            this.currentId = null;
        }
    },

    play(url, id, onEnded, onError) {
        // 1. 立即停止上一条
        this.stop();

        // 2. 创建新音频 (直接使用 URL 流式播放，减少等待)
        const audio = new Audio(url);
        this.currentAudio = audio;
        this.currentId = id;
        
        // 3. 预加载设置，提升响应速度
        audio.preload = 'auto';

        audio.onended = () => {
            if (this.currentId === id) { // 确保 ID 匹配
                this.currentAudio = null;
                this.currentId = null;
                if (onEnded) onEnded();
            }
        };

        audio.onerror = (e) => {
            console.error("音频播放错误:", e);
            this.currentAudio = null;
            this.currentId = null;
            if (onError) onError();
        };

        // 4. 播放
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log("播放被打断或失败:", error);
                if (onError) onError();
            });
        }
    }
};

// --- 全屏传送门组件 ---
const FullScreenPortal = ({ children }) => {
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        setMounted(true);
        document.body.style.overflow = 'hidden'; // 锁定背景滚动
        return () => { document.body.style.overflow = ''; };
    }, []);
    
    if (!mounted || typeof document === 'undefined') return null;
    
    return createPortal(
        <div className="fixed inset-0 z-[99999] bg-gray-50 dark:bg-gray-900 flex flex-col animate-in slide-in-from-right duration-200">
            {children}
        </div>,
        document.body
    );
};

// --- 短句列表页面组件 ---
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    // 语速设置：默认中文 -0.35
    const [isReadingChinese, setIsReadingChinese] = useState(true);
    const [isReadingBurmese, setIsReadingBurmese] = useState(true);
    const [chineseRate, setChineseRate] = useState(-0.35); 
    const [burmeseRate, setBurmeseRate] = useState(-0.3);
    const [showSettings, setShowSettings] = useState(false);
    
    // 播放状态
    const [playingId, setPlayingId] = useState(null);

    // --- 核心修复：手势返回支持 ---
    useEffect(() => {
        // 1. 组件挂载时，向浏览器历史压入一个状态
        // 这样按物理返回键或左滑时，不会直接关闭网页，而是触发 popstate
        const pushState = () => {
            window.history.pushState({ panel: 'phrase-list' }, '', window.location.pathname + '#list');
        };

        pushState();

        // 2. 监听返回事件
        const handlePopState = (event) => {
            // 拦截返回，执行关闭逻辑
            onBack(); 
        };

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            // 组件卸载时停止音频
            GlobalAudioController.stop();
        };
    }, [onBack]);

    // 处理数据
    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        pinyin: pinyin(phrase.chinese, { toneType: 'symbol', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    // 播放逻辑
    const handleCardClick = async (phrase) => {
        // 如果点击的是当前正在播放的，则停止
        if (playingId === phrase.id) {
            GlobalAudioController.stop();
            setPlayingId(null);
            return;
        }

        setPlayingId(phrase.id); // 设置 UI 状态为 Loading/Playing

        const playSequence = async () => {
            try {
                // 1. 播放中文
                if (isReadingChinese) {
                    await new Promise((resolve, reject) => {
                        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(phrase.chinese)}&v=zh-CN-XiaoyanNeural&r=${chineseRate}`;
                        // 使用全局控制器播放，它会自动停止之前的
                        GlobalAudioController.play(
                            url, 
                            phrase.id, 
                            resolve, // 播放结束
                            reject   // 播放出错
                        );
                    });
                }

                // 2. 如果还在播放状态（没被切歌），且需要读缅文
                if (isReadingBurmese && GlobalAudioController.currentId === phrase.id) {
                    if (isReadingChinese) {
                        // 稍微停顿一下，体验更好
                        await new Promise(r => setTimeout(r, 200)); 
                    }
                    
                    await new Promise((resolve, reject) => {
                         const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(phrase.burmese)}&v=my-MM-ThihaNeural&r=${burmeseRate}`;
                         GlobalAudioController.play(
                            url,
                            phrase.id,
                            resolve,
                            reject
                         );
                    });
                }
            } catch (e) {
                console.error("Play aborted or error", e);
            } finally {
                // 只有当 ID 还是当前 ID 时才重置状态（防止切歌后把新歌的状态重置了）
                if (GlobalAudioController.currentId === phrase.id) {
                    setPlayingId(null);
                }
            }
        };

        playSequence();
    };

    return (
        <FullScreenPortal>
            {/* 注入极细滚动条样式 */}
            <style jsx global>{`
                .thin-scrollbar::-webkit-scrollbar { width: 2px; }
                .thin-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .thin-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .thin-scrollbar { scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent; }
            `}</style>

            {/* 顶部固定导航栏 */}
            <div className="flex-none bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 z-10 shadow-sm safe-area-top">
                <div className="px-4 py-3 flex items-center justify-between">
                    {/* 返回按钮：手动点击也触发浏览器的 back，保持逻辑一致 */}
                    <button 
                        onClick={() => window.history.back()} 
                        className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-95 transition-all text-gray-600 dark:text-gray-300"
                    >
                        <ChevronLeft size={28} />
                    </button>
                    
                    <div className="flex flex-col items-center">
                        <h1 className="font-bold text-lg text-gray-800 dark:text-white truncate max-w-[200px]">{subcategory.name}</h1>
                        <span className="text-xs text-gray-500">{category.category}</span>
                    </div>

                    <button 
                        onClick={() => setShowSettings(!showSettings)} 
                        className={`p-2 -mr-2 rounded-full transition-colors ${showSettings ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}
                    >
                        <Settings2 size={24} />
                    </button>
                </div>

                {/* 设置面板 */}
                {showSettings && (
                    <div className="px-4 pb-4 pt-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 animate-in slide-in-from-top-2 duration-200">
                         <div className="flex gap-3 mb-4">
                            <button 
                                onClick={() => setIsReadingChinese(!isReadingChinese)} 
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${isReadingChinese ? 'bg-blue-500 text-white border-blue-500 shadow-md shadow-blue-200' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                <Languages size={16}/> 中文
                            </button>
                            <button 
                                onClick={() => setIsReadingBurmese(!isReadingBurmese)} 
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center justify-center gap-2 ${isReadingBurmese ? 'bg-green-500 text-white border-green-500 shadow-md shadow-green-200' : 'bg-white text-gray-600 border-gray-200'}`}
                            >
                                <Mic size={16}/> 缅文
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-xs font-medium text-gray-500">中文语速</label>
                                    <span className="text-xs text-blue-500 font-bold">{chineseRate}</span>
                                </div>
                                <input type="range" min="-0.5" max="0.5" step="0.05" value={chineseRate} onChange={e => setChineseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500" />
                            </div>
                            <div>
                                <div className="flex justify-between mb-1.5">
                                    <label className="text-xs font-medium text-gray-500">缅文语速</label>
                                    <span className="text-xs text-green-500 font-bold">{burmeseRate}</span>
                                </div>
                                <input type="range" min="-0.5" max="0.5" step="0.05" value={burmeseRate} onChange={e => setBurmeseRate(parseFloat(e.target.value))} className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-500" />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 列表内容区 (应用极细滚动条) */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 bg-gray-50 dark:bg-gray-900 thin-scrollbar">
                {processedPhrases.map((phrase) => {
                    const isPlaying = playingId === phrase.id;
                    return (
                        <div 
                            key={phrase.id} 
                            onClick={() => handleCardClick(phrase)}
                            className={`
                                relative bg-white dark:bg-gray-800 rounded-2xl p-6 
                                shadow-sm transition-all duration-200 cursor-pointer border-2
                                flex flex-col items-center text-center select-none
                                ${isPlaying 
                                    ? 'border-blue-400 dark:border-blue-500 shadow-lg scale-[1.01]' 
                                    : 'border-transparent hover:border-gray-100 dark:hover:border-gray-700 active:scale-[0.98]'
                                }
                            `}
                        >
                            {/* 播放状态图标 */}
                            <div className={`absolute top-4 right-4 transition-colors duration-300 ${isPlaying ? 'text-blue-500' : 'text-gray-200 dark:text-gray-700'}`}>
                                {isPlaying ? <Loader2 size={20} className="animate-spin" /> : <PlayCircle size={20} />}
                            </div>

                            {/* 1. 拼音 (上方) */}
                            <div className="text-sm text-gray-400 dark:text-gray-500 font-sans mb-1 tracking-wider">
                                {phrase.pinyin}
                            </div>
                            
                            {/* 2. 中文 (居中) */}
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
        // 这里只是设置数据状态，真正的渲染是 Portal 接管的
        // 关键：状态更新后，PhraseListPage 组件挂载，它的 useEffect 会写入 history
        setSelectedCategory(category);
        setSelectedSubcategory(subcategory);
        
        try {
            const module = await import(`@/data/speaking/${subcategory.file}.js`);
            setPhrases(module.default);
            setView('phrases'); // 确保数据加载完再切视图
        } catch (e) {
            console.error("加载失败:", e);
            setPhrases([]);
        } finally {
            setIsLoading(false);
        }
    };

    // 从子组件触发的返回（可能是手势触发的，也可能是点击按钮触发的）
    const handleBackToMain = () => {
        setView('main');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPhrases([]);
        // 停止音频
        GlobalAudioController.stop();
    };

    // 搜索数据预加载
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
        
        if (view === 'phrases') {
            return <PhraseListPage phrases={phrases} category={selectedCategory} subcategory={selectedSubcategory} onBack={handleBackToMain} />;
        }

        return <MainView onSubcategoryClick={handleSubcategoryClick} />;
    };

    return (
        <div className="w-full max-w-2xl mx-auto min-h-screen bg-gray-50/50 dark:bg-gray-900">
             {view === 'main' && !searchTerm && (
                <div className='text-center pt-8 pb-4 px-4'>
                    <h1 className='text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight'>口语练习</h1>
                    <p className='mt-2 text-sm text-gray-500 dark:text-gray-400'>地道中文口语 · 缅文谐音助记</p>
                </div>
            )}
            
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

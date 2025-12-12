// components/kouyu.js

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { pinyin } from 'pinyin-pro';
import { ChevronLeft, Search, SlidersHorizontal, Languages, Mic, Loader2, Volume2 } from 'lucide-react';
import { speakingCategories } from '@/data/speaking-structure';

// --- TTS 模块 (保持不变) ---
const ttsCache = new Map();
const getTTSAudio = async (text, voice, rate = 0) => {
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TTS API Error`);
        const blob = await response.blob();
        const audio = new Audio(URL.createObjectURL(blob));
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`获取TTS失败: "${text}"`, e); return null; }
};


// --- 短句列表页面组件 (新) ---
// 这个组件现在只在用户点击子分类后动态渲染
const PhraseListPage = ({ phrases, category, subcategory, onBack }) => {
    const [isReadingChinese, setIsReadingChinese] = useState(true);
    const [isReadingBurmese, setIsReadingBurmese] = useState(true);
    const [chineseRate, setChineseRate] = useState(0);
    const [burmeseRate, setBurmeseRate] = useState(-0.3);
    const [nowPlaying, setNowPlaying] = useState(null);

    const processedPhrases = useMemo(() => phrases.map(phrase => ({
        ...phrase,
        // 修复拼音：使用更健壮的配置
        pinyin: pinyin(phrase.chinese, { toneType: 'num', v: true, nonZh: 'consecutive' }),
    })), [phrases]);

    const handleCardClick = async (phrase) => {
        if (nowPlaying) return;
        setNowPlaying(phrase.id);
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
            setNowPlaying(null);
        }
    };

    return (
        <div className="animate-fade-in">
            {/* 顶部导航 */}
            <div className="sticky top-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg z-20 p-4 flex items-center justify-between shadow-sm">
                <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700">
                    <ChevronLeft size={24} />
                </button>
                <div className="text-center">
                    <h1 className="text-xl font-bold">{subcategory.name}</h1>
                    <p className="text-sm text-gray-500">{category.category}</p>
                </div>
                <div className="w-8"></div>
            </div>

             {/* 控制器 */}
            <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-800/50 mb-4">
                <div className="flex items-center gap-4">
                    <button onClick={() => setIsReadingChinese(!isReadingChinese)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isReadingChinese ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Languages size={16} /> 中文
                    </button>
                    <button onClick={() => setIsReadingBurmese(!isReadingBurmese)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${isReadingBurmese ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-700'}`}>
                        <Mic size={16} /> 缅甸语
                    </button>
                </div>
                 <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">中文语速</label>
                        <input type="range" min="-0.5" max="0.5" step="0.05" value={chineseRate} onChange={e => setChineseRate(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-blue-200 dark:bg-blue-800" />
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">缅甸语语速</label>
                        <input type="range" min="-0.5" max="0.5" step="0.05" value={burmeseRate} onChange={e => setBurmeseRate(parseFloat(e.target.value))} className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-green-200 dark:bg-green-800" />
                    </div>
                 </div>
            </div>

            {/* 短句列表 */}
            <div className="px-4">
                {processedPhrases.map(phrase => (
                    <div key={phrase.id} className="relative">
                        <div onClick={() => handleCardClick(phrase)} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-5 mb-4 cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]">
                            <p className="text-xl font-bold text-gray-900 dark:text-white">{phrase.chinese}</p>
                            <p className="text-md text-gray-500 dark:text-gray-400 mt-1">{phrase.pinyin}</p>
                            <p className="text-lg text-blue-600 dark:text-blue-400 mt-3 font-semibold">{phrase.burmese}</p>
                            {phrase.xieyin && <p className="text-md text-teal-600 dark:text-teal-400 mt-2 font-light italic">谐音: {phrase.xieyin}</p>}
                        </div>
                        {nowPlaying === phrase.id && <div className="absolute inset-0 bg-black/20 rounded-xl flex justify-center items-center pointer-events-none"><Volume2 className="text-white animate-pulse" size={48} /></div>}
                    </div>
                ))}
            </div>
        </div>
    );
};


// --- 主页/分类列表视图 ---
const MainView = ({ onSubcategoryClick }) => {
    return (
        <div>
            {speakingCategories.map(category => (
                <div key={category.category} className="mb-8 p-4 bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-3xl">{category.icon}</span>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{category.category}</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {category.subcategories.map(subcategory => (
                            <div key={subcategory.name} onClick={() => onSubcategoryClick(category, subcategory)}
                                className="p-4 text-center bg-gray-100 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600 transition-all">
                                <p className="font-semibold">{subcategory.name}</p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};


// --- 根组件 KouyuPage ---
export default function KouyuPage() {
    // 页面状态管理
    const [view, setView] = useState('main'); // 'main', 'phrases', 'search'
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedSubcategory, setSelectedSubcategory] = useState(null);
    const [phrases, setPhrases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // 搜索功能状态
    const [searchTerm, setSearchTerm] = useState('');
    const [allPhrasesForSearch, setAllPhrasesForSearch] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    // 点击子分类的处理逻辑
    const handleSubcategoryClick = async (category, subcategory) => {
        setIsLoading(true);
        setView('phrases');
        setSelectedCategory(category);
        setSelectedSubcategory(subcategory);
        try {
            // 动态导入对应的短句文件
            const module = await import(`@/data/speaking/${subcategory.file}.js`);
            setPhrases(module.default);
        } catch (e) {
            console.error("加载短句文件失败:", e);
            setPhrases([]); // 加载失败则显示空列表
        } finally {
            setIsLoading(false);
        }
    };

    // 返回主列表
    const handleBackToMain = () => {
        setView('main');
        setSelectedCategory(null);
        setSelectedSubcategory(null);
        setPhrases([]);
    };

    // 搜索逻辑
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
        loadAllDataForSearch();
    }, [searchTerm, allPhrasesForSearch]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lowerCaseTerm = searchTerm.toLowerCase();
        const pinyinTerm = pinyin(lowerCaseTerm, { toneType: 'num', v: true, nonZh: 'consecutive' });
        return allPhrasesForSearch.filter(phrase =>
            phrase.chinese.toLowerCase().includes(lowerCaseTerm) ||
            pinyin(phrase.chinese, { toneType: 'num', v: true, nonZh: 'consecutive' }).includes(pinyinTerm) ||
            phrase.burmese.toLowerCase().includes(lowerCaseTerm)
        );
    }, [searchTerm, allPhrasesForSearch]);
    

    // 渲染函数
    const renderContent = () => {
        if (isLoading) {
            return <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>;
        }

        if (searchTerm) {
            return isSearching 
                ? <div className="flex justify-center items-center py-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
                : <PhraseListPage phrases={searchResults} category={{ category: '搜索结果' }} subcategory={{ name: `'${searchTerm}'` }} onBack={() => setSearchTerm('')} />;
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
        <div className="w-full max-w-4xl mx-auto py-4">
            <div className='text-center mb-6'>
                <h1 className='text-3xl font-extrabold text-gray-800 dark:text-white'>口语练习中心</h1>
                <p className='mt-2 text-gray-500 dark:text-gray-400'>选择场景或搜索关键词开始学习</p>
            </div>
            
            {/* 仅在主页显示搜索框 */}
            {view === 'main' && !searchTerm && (
                <div className="sticky top-0 z-10 p-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-lg rounded-xl mb-6 shadow-sm">
                    <div className="relative">
                        <input type="text" placeholder="全局搜索中文、拼音或缅文..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"><Search size={20} className="text-gray-400" /></div>
                    </div>
                </div>
            )}
            
            {renderContent()}
        </div>
    );
    }

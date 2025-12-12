import { useState, useMemo, useEffect } from 'react';
import { pinyin } from 'pinyin-pro';
import { ChevronDown, Search, SlidersHorizontal, Languages, Mic, Loader2 } from 'lucide-react';
import { speakingCategories } from '@/data/speaking-structure'; // 导入主结构文件

// --- TTS 模块 ---
const ttsCache = new Map();
const getTTSAudio = async (text, voice, rate = 0) => {
    const cacheKey = `${text}|${voice}|${rate}`;
    if (ttsCache.has(cacheKey)) return ttsCache.get(cacheKey);
    try {
        const url = `https://t.leftsite.cn/tts?t=${encodeURIComponent(text)}&v=${voice}&r=${rate}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`TTS API Error: ${response.statusText}`);
        const blob = await response.blob();
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        ttsCache.set(cacheKey, audio);
        return audio;
    } catch (e) { console.error(`获取TTS失败: "${text}"`, e); return null; }
};

// --- UI 组件 ---
const PhraseCard = ({ phrase, onPlayAudio }) => {
    const [isLoadingChinese, setIsLoadingChinese] = useState(false);
    const [isLoadingBurmese, setIsLoadingBurmese] = useState(false);
    const handlePlay = async (lang) => {
        const stateSetter = lang === 'zh' ? setIsLoadingChinese : setIsLoadingBurmese;
        stateSetter(true);
        await onPlayAudio(phrase.chinese, phrase.burmese, lang);
        stateSetter(false);
    };
    return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-3">
            <div className="flex justify-between items-start">
                <div className="flex-1 pr-2">
                    <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{phrase.chinese}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{phrase.pinyin}</p>
                    <p className="text-md text-blue-600 dark:text-blue-400 mt-2 font-semibold">{phrase.burmese}</p>
                    {phrase.xieyin && <p className="text-sm text-teal-600 dark:text-teal-400 mt-2 font-light italic">谐音: {phrase.xieyin}</p>}
                </div>
                <div className="flex flex-col gap-2">
                    <button onClick={() => handlePlay('zh')} disabled={isLoadingChinese} className="flex items-center justify-center w-9 h-9 rounded-full text-blue-500 bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900 transition-all disabled:opacity-50" aria-label="播放中文">
                        {isLoadingChinese ? <Loader2 size={18} className="animate-spin" /> : <Languages size={18} />}
                    </button>
                    <button onClick={() => handlePlay('my')} disabled={isLoadingBurmese} className="flex items-center justify-center w-9 h-9 rounded-full text-green-500 bg-green-50 dark:bg-green-900/50 hover:bg-green-100 dark:hover:bg-green-900 transition-all disabled:opacity-50" aria-label="播放缅甸语">
                        {isLoadingBurmese ? <Loader2 size={18} className="animate-spin" /> : <Mic size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SpeedController = ({ title, value, onChange, colorClass }) => (
    <div className="w-full">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{title}: {Math.round(value * 100)}%</label>
        <input type="range" min="-0.5" max="0.5" step="0.05" value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
            className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${colorClass}`} />
    </div>
);

const CategoryAccordion = ({ category, phrases, isLoading, isOpen, onToggle, onPlayAudio }) => {
    const [activeTag, setActiveTag] = useState('全部');
    const filteredPhrases = activeTag === '全部' ? phrases : phrases.filter(p => p.tags && p.tags.includes(activeTag));

    useEffect(() => {
        if (isOpen) {
            setActiveTag('全部');
        }
    }, [isOpen]);

    return (
        <div className="mb-4 bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm overflow-hidden transition-all duration-500">
            <button onClick={onToggle} className="w-full flex justify-between items-center p-5 text-left font-bold text-lg text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800">
                <span>{category.icon} {category.category}</span>
                <ChevronDown className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} size={24} />
            </button>
            <div className={`transition-all duration-500 ease-in-out overflow-hidden ${isOpen ? 'max-h-[5000px]' : 'max-h-0'}`}>
                <div className="px-5 pb-5 pt-2 bg-gray-50 dark:bg-gray-800/50">
                    {isLoading ? (
                         <div className="flex justify-center items-center py-10"> <Loader2 className="animate-spin text-blue-500" size={32} /> </div>
                    ) : (
                        <>
                            <div className="flex flex-wrap gap-2 mb-4">
                                <button onClick={() => setActiveTag('全部')} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTag === '全部' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>全部</button>
                                {category.subcategories.map(tag => (
                                    <button key={tag.name} onClick={() => setActiveTag(tag.name)} className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTag === tag.name ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}>{tag.name}</button>
                                ))}
                            </div>
                            <div> {filteredPhrases.map(phrase => <PhraseCard key={phrase.id} phrase={phrase} onPlayAudio={onPlayAudio} />)} </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};


// --- 主组件 ---
export default function KouyuPage() {
    const [searchTerm, setSearchTerm] = useState('');
    const [openAccordion, setOpenAccordion] = useState(speakingCategories[0]?.category || null);
    const [categoryPhrases, setCategoryPhrases] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    const [allPhrasesForSearch, setAllPhrasesForSearch] = useState([]);
    const [isSearching, setIsSearching] = useState(false);

    const [chineseRate, setChineseRate] = useState(0);
    const [burmeseRate, setBurmeseRate] = useState(-0.3);

    // 动态加载展开分类的数据
    useEffect(() => {
        const loadCategoryData = async () => {
            if (!openAccordion) {
                setCategoryPhrases([]);
                return;
            }
            setIsLoading(true);
            const categoryData = speakingCategories.find(c => c.category === openAccordion);
            if (!categoryData) {
                setIsLoading(false);
                return;
            }
            const phrasePromises = categoryData.subcategories.map(sub =>
                import(`@/data/speaking/${sub.file}.js`)
                    .then(module => module.default.map(phrase => ({ ...phrase, tags: [sub.name] })))
                    .catch(() => []) // 如果文件不存在，返回空数组
            );
            const phraseArrays = await Promise.all(phrasePromises);
            const allPhrases = phraseArrays.flat().map(p => ({...p, pinyin: p.pinyin || pinyin(p.chinese, { toneType: 'num' })}));
            setCategoryPhrases(allPhrases);
            setIsLoading(false);
        };
        loadCategoryData();
    }, [openAccordion]);

    // 动态加载所有数据用于搜索
    useEffect(() => {
        const loadAllDataForSearch = async () => {
            if (searchTerm && allPhrasesForSearch.length === 0) {
                setIsSearching(true);
                const allPromises = speakingCategories.flatMap(cat =>
                    cat.subcategories.map(sub =>
                        import(`@/data/speaking/${sub.file}.js`)
                        .then(module => module.default.map(phrase => ({ ...phrase, tags: [sub.name] })))
                        .catch(() => [])
                    )
                );
                const allLoadedPhrases = (await Promise.all(allPromises)).flat().map(p => ({...p, pinyin: p.pinyin || pinyin(p.chinese, { toneType: 'num' })}));
                setAllPhrasesForSearch(allLoadedPhrases);
                setIsSearching(false);
            }
        };
        loadAllDataForSearch();
    }, [searchTerm, allPhrasesForSearch]);

    const searchResults = useMemo(() => {
        if (!searchTerm) return [];
        const lowerCaseTerm = searchTerm.toLowerCase();
        return allPhrasesForSearch.filter(phrase =>
            phrase.chinese.toLowerCase().includes(lowerCaseTerm) ||
            phrase.pinyin.toLowerCase().includes(lowerCaseTerm) ||
            phrase.burmese.toLowerCase().includes(lowerCaseTerm)
        );
    }, [searchTerm, allPhrasesForSearch]);

    const handlePlayAudio = async (chineseText, burmeseText, lang) => {
        const text = lang === 'zh' ? chineseText : burmeseText;
        const voice = lang === 'zh' ? 'zh-CN-XiaoyanNeural' : 'my-MM-ThihaNeural';
        const rate = lang === 'zh' ? chineseRate : burmeseRate;
        const audio = await getTTSAudio(text, voice, rate);
        if (audio) audio.play().catch(e => console.error("音频播放失败", e));
    };

    return (
        <div className="w-full max-w-4xl mx-auto py-4 animate-fade-in">
            <div className='text-center mb-6'>
                <h1 className='text-3xl font-extrabold text-gray-800 dark:text-white'>口语练习中心</h1>
                <p className='mt-2 text-gray-500 dark:text-gray-400'>选择场景或搜索关键词开始学习</p>
            </div>

            <div className="sticky top-0 z-20 p-4 bg-gray-50/80 dark:bg-gray-900/80 backdrop-blur-lg rounded-xl mb-6 shadow-sm">
                <div className="relative mb-4">
                    <input type="text" placeholder="搜索中文、拼音或缅文..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border-2 border-transparent rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2"><Search size={20} className="text-gray-400" /></div>
                </div>
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300 mb-2">
                    <SlidersHorizontal size={16} /><h3 className="font-semibold text-sm">发音语速设置</h3>
                </div>
                <div className="flex flex-col md:flex-row gap-4">
                    <SpeedController title="中文" value={chineseRate} onChange={setChineseRate} colorClass="bg-blue-200 dark:bg-blue-800" />
                    <SpeedController title="缅甸语" value={burmeseRate} onChange={setBurmeseRate} colorClass="bg-green-200 dark:bg-green-800" />
                </div>
            </div>

            {searchTerm ? (
                <div>
                    <h3 className="font-bold text-lg mb-4 px-4">搜索结果 ({isSearching ? '...' : searchResults.length})</h3>
                    <div className="px-4">
                        {isSearching ? <div className="flex justify-center items-center py-10"><Loader2 className="animate-spin text-blue-500" size={32} /></div>
                            : searchResults.length > 0 ? (
                                searchResults.map(phrase => <PhraseCard key={phrase.id} phrase={phrase} onPlayAudio={handlePlayAudio} />)
                            ) : <p className="text-center text-gray-500 py-8">未找到相关短句。</p>
                        }
                    </div>
                </div>
            ) : (
                <div>
                    {speakingCategories.map(item => (
                        <CategoryAccordion
                            key={item.category}
                            category={item}
                            phrases={openAccordion === item.category ? categoryPhrases : []}
                            isLoading={openAccordion === item.category && isLoading}
                            isOpen={openAccordion === item.category}
                            onToggle={() => setOpenAccordion(openAccordion === item.category ? null : item.category)}
                            onPlayAudio={handlePlayAudio}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

import { useState, Fragment } from 'react';
import { ChevronDown, Volume2, X } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';

// 模拟的口语数据结构
// 您可以将这里的 hardcoded 数据替换为从 API 获取的数据
const speakingData = [
  {
    category: '日常问候与寒暄',
    icon: '🤝',
    subcategories: [
      '初次见面', '日常问候', '介绍他人', '道别'
    ],
    phrases: [
      { id: 1, chinese: '你好！', pinyin: 'Nǐ hǎo!', burmese: 'မင်္ဂလာပါ!', audio: '/sounds/nihao.mp3', tags: ['日常问候', '初次见面'] },
      { id: 2, chinese: '很高兴认识你。', pinyin: 'Hěn gāoxìng rènshi nǐ.', burmese: 'တွေ့ရတာဝမ်းသာပါတယ်။', audio: '/sounds/hen-gaoxing.mp3', tags: ['初次见面'] },
      { id: 3, chinese: '你叫什么名字？', pinyin: 'Nǐ jiào shénme míngzi?', burmese: 'နာမည်ဘယ်လိုခေါ်လဲ?', audio: '/sounds/ni-jiao.mp3', tags: ['初次见面'] },
      { id: 4, chinese: '早上好。', pinyin: 'Zǎoshang hǎo.', burmese: 'မင်္ဂလာနံနက်ခင်းပါ', audio: '/sounds/zaoshang.mp3', tags: ['日常问候'] },
      { id: 5, chinese: '再见。', pinyin: 'Zàijiàn.', burmese: 'နောက်မှတွေ့မယ်။', audio: '/sounds/zaijian.mp3', tags: ['道别'] },
      { id: 6, chinese: '这是我的朋友，李华。', pinyin: 'Zhè shì wǒ de péngyǒu, Lǐ Huà.', burmese: 'ဒါက ကျွန်တော့်သူငယ်ချင်း လီဟွာပါ။', audio: '/sounds/zhe-shi.mp3', tags: ['介绍他人'] }
    ]
  },
  {
    category: '餐厅与点餐',
    icon: '🍜',
    subcategories: [
      '预订座位', '点餐', '结账', '特殊要求'
    ],
    phrases: [
        { id: 7, chinese: '服务员，点餐。', pinyin: 'Fúwùyuán, diǎn cài.', burmese: 'စားပွဲထိုး၊ အော်ဒါမှာမယ်။', audio: '/sounds/diancan.mp3', tags: ['点餐'] },
        { id: 8, chinese: '这个菜辣吗？', pinyin: 'Zhège cài là ma?', burmese: 'ဒီဟင်းက စပ်သလား?', audio: '/sounds/zhege-cai.mp3', tags: ['特殊要求'] },
        { id: 9, chinese: '买单，谢谢。', pinyin: 'Mǎidān, xièxiè.', burmese: 'ဘေလ်ရှင်းမယ်နော်၊ ကျေးဇူးပါ။', audio: '/sounds/maidan.mp3', tags: ['结账'] }
    ]
  },
  {
    category: '交通与问路',
    icon: '🗺️',
    subcategories: [
        '打车', '乘坐公交', '问路'
    ],
    phrases: [
        { id: 10, chinese: '请问，去这个地址怎么走？', pinyin: 'Qǐngwèn, qù zhège dìzhǐ zěnme zǒu?', burmese: 'ကျေးဇူးပြုပြီး ဒီလိပ်စာကို ဘယ်လိုသွားရမလဲ။', audio: '/sounds/qu-zhege.mp3', tags: ['问路'] },
        { id: 11, chinese: '师傅，请带我去机场。', pinyin: 'Shīfù, qǐng dài wǒ qù jīchǎng.', burmese: 'ဆရာ၊ လေဆိပ်ကို ပို့ပေးပါ။', audio: '/sounds/qu-jichang.mp3', tags: ['打车'] }
    ]
  }
];

// 单个短句卡片组件
const PhraseCard = ({ phrase, onCardClick }) => {
  const playAudio = (e) => {
    e.stopPropagation(); // 阻止事件冒泡，防止点击喇叭时触发卡片点击
    console.log('Playing audio:', phrase.audio);
    // 在这里添加您的音频播放逻辑
    const audio = new Audio(phrase.audio);
    audio.play().catch(error => console.error("Audio playback failed:", error));
  };

  return (
    <div 
        onClick={() => onCardClick(phrase)}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 mb-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-800 dark:text-gray-100">{phrase.chinese}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{phrase.pinyin}</p>
          <p className="text-md text-blue-600 dark:text-blue-400 mt-2 font-semibold">{phrase.burmese}</p>
        </div>
        <button onClick={playAudio} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          <Volume2 size={22} />
        </button>
      </div>
    </div>
  );
};

// 单个手风琴分类组件
const CategoryAccordion = ({ category, icon, subcategories, phrases, isOpen, onToggle, activeTag, onTagClick, onCardClick }) => {
  const filteredPhrases = activeTag === '全部' ? phrases : phrases.filter(p => p.tags.includes(activeTag));

  return (
    <div className="mb-4 bg-white dark:bg-gray-800/50 rounded-2xl shadow-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex justify-between items-center p-5 text-left font-bold text-lg text-gray-800 dark:text-gray-100 bg-white dark:bg-gray-800"
      >
        <span>{icon} {category}</span>
        <ChevronDown
          className={`transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          size={24}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-2 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => onTagClick('全部')}
              className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTag === '全部' ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
            >
              全部
            </button>
            {subcategories.map(tag => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className={`px-3 py-1 text-sm rounded-full transition-colors ${activeTag === tag ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              >
                {tag}
              </button>
            ))}
          </div>
          <div>
            {filteredPhrases.length > 0 ? (
                filteredPhrases.map(phrase => (
                    <PhraseCard key={phrase.id} phrase={phrase} onCardClick={onCardClick} />
                ))
            ) : (
                <p className="text-center text-gray-500 py-4">该分类下暂无内容。</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// 沉浸式学习弹窗组件
const LearningModal = ({ phrase, isOpen, onClose }) => {
    if (!phrase) return null;

    const playAudio = () => {
        console.log('Playing audio:', phrase.audio);
        const audio = new Audio(phrase.audio);
        audio.play().catch(error => console.error("Audio playback failed:", error));
    };

    return (
        <Transition show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-200" leaveFrom="opacity-100" leaveTo="opacity-0">
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4 text-center">
                        <Transition.Child as={Fragment} enter="ease-out duration-300" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-200" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
                            <Dialog.Panel className="w-full max-w-lg transform overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-8 text-left align-middle shadow-xl transition-all text-white flex flex-col items-center justify-center aspect-square">
                                <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors">
                                    <X size={28} />
                                </button>
                                
                                <div className='text-center'>
                                    <h1 className="text-4xl md:text-5xl font-bold" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.2)' }}>
                                        {phrase.chinese}
                                    </h1>
                                    <p className="mt-3 text-xl text-white/80">{phrase.pinyin}</p>
                                    <p className="mt-6 text-2xl text-cyan-200 font-semibold">{phrase.burmese}</p>
                                </div>

                                <div className="mt-8">
                                    <button 
                                        onClick={playAudio}
                                        className="bg-white/20 hover:bg-white/30 text-white rounded-full p-5 transition-all transform hover:scale-110 active:scale-95 shadow-lg">
                                        <Volume2 size={40} />
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
};


// 主组件
export default function SpeakingContentBlock() {
  const [openAccordion, setOpenAccordion] = useState(speakingData[0]?.category || null);
  const [activeTags, setActiveTags] = useState({});
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPhrase, setSelectedPhrase] = useState(null);

  const handleToggleAccordion = (category) => {
    setOpenAccordion(openAccordion === category ? null : category);
  };

  const handleTagClick = (category, tag) => {
    setActiveTags(prev => ({ ...prev, [category]: tag }));
  };
  
  const handleCardClick = (phrase) => {
    setSelectedPhrase(phrase);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4">
        <div className='text-center mb-8'>
            <h2 className='text-3xl font-extrabold text-gray-800 dark:text-white'>口语练习</h2>
            <p className='mt-2 text-gray-500 dark:text-gray-400'>选择一个场景，开始你的口语练习之旅。</p>
        </div>

      {speakingData.map(item => (
        <CategoryAccordion
          key={item.category}
          {...item}
          isOpen={openAccordion === item.category}
          onToggle={() => handleToggleAccordion(item.category)}
          activeTag={activeTags[item.category] || '全部'}
          onTagClick={(tag) => handleTagClick(item.category, tag)}
          onCardClick={handleCardClick}
        />
      ))}

      <LearningModal phrase={selectedPhrase} isOpen={isModalOpen} onClose={closeModal} />
    </div>
  );
}

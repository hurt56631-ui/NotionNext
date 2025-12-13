// data/speaking-structure.js

export const speakingCategories = [
  {
    category: '问候与寒暄',
    icon: '🤝',
    subcategories: [
      { name: '打招呼', file: 'dazhaohu' },
      { name: '初次见面', file: 'chucimian' },
      { name: '日常攀谈与久别重逢', file: 'jiubiechongfeng' },
      { name: '关心与回应', file: 'guanxinyuhuiying' },
      { name: '找人说话与插话', file: 'zhaorenshuohua' },
      { name: '电话与信息', file: 'dianhuayuxinxi' },
      { name: '结束与告别', file: 'jieshuyugaobie' }
    ]
  },
  {
    category: '餐厅与点餐',
    icon: '🍜',
    subcategories: [
      { name: '预订座位', file: 'yudingzuowei' },
      { name: '点餐', file: 'diancan' },
      { name: '结账', file: 'jiezhang' }
    ]
  },
  {
    category: '交通与问路',
    icon: '🗺️',
    subcategories: [
      { name: '打车', file: 'dache' },
      { name: '问路', file: 'wenlu' }
    ]
  }
];

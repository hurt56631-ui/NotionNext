// data/speaking-structure.js

export const speakingCategories = [
  {
    category: '日常问候与寒暄',
    icon: '🤝',
    subcategories: [
      // name: 是显示给用户的名称
      // file: 是对应的数据文件名 (建议用纯英文，无.js后缀)
      { name: '初次见面', file: 'chucimian' },
      { name: '日常问候', file: 'richangwenhou' },
      { name: '介绍他人', file: 'jieshaotaren' },
      { name: '道别', file: 'daobie' }
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

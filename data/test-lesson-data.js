export const hskLessonData = {
  id: "hsk1_01",
  title: "第1课：你是哪国人？",
  blocks: [
    // ==========================================
    // 1. 单词学习 (Word Study) - 已适配新版播放器字段
    // ==========================================
    {
      type: "word_study",
      content: {
        title: "核心生词",
        words: [
          {
            id: 1,
            hsk_level: 1, // 必须：用于 R2 音频
            word: "你好",
            pinyin: "nǐ hǎo",
            decomposition: ["你", "好"], // 必须：用于拆解显示
            similar_sound: "尼好",
            burmese: "မင်္ဂလာပါ",
            definition: "Hello / Hi", // 英文定义
            explanation: "用于打招呼，任何时间都可以说。", // 中文详解
            example: "你好！你是老师吗？",
            example_burmese: "မင်္ဂလာပါ၊ သင်က ဆရာလား။",
            example2: "老师，你好！",
            example2_burmese: "ဆရာ/မ မင်္ဂလာပါ။"
          },
          {
            id: 2,
            hsk_level: 1,
            word: "中国",
            pinyin: "Zhōng guó",
            decomposition: ["中", "国"],
            similar_sound: "钟国",
            burmese: "တရုတ်",
            definition: "China",
            explanation: "东亚国家。",
            example: "我是中国人。",
            example_burmese: "ကျွန်တော်က တရုတ်လူမျိုးပါ။",
            example2: "我爱中国。",
            example2_burmese: "ကျွန်တော် တရုတ်ပြည်ကို ချစ်တယ်။"
          },
          {
            id: 3,
            hsk_level: 1,
            word: "美国",
            pinyin: "Měi guó",
            decomposition: ["美", "国"],
            similar_sound: "美过",
            burmese: "အမေရိကန်",
            definition: "USA",
            explanation: "北美国家。",
            example: "他是美国人。",
            example_burmese: "သူက အမေရိကန်လူမျိုးပါ။",
            example2: "你要去美国吗？",
            example2_burmese: "မင်း အမေရိကန်ကို သွားမှာလား။"
          },
          {
            id: 4,
            hsk_level: 1,
            word: "人",
            pinyin: "rén",
            decomposition: ["人"],
            similar_sound: "忍",
            burmese: "လူ",
            definition: "Person / People",
            explanation: "人类，或者指某种身份的人。",
            example: "中国人 / 美国人",
            example_burmese: "တရုတ်လူမျိုး / အမေရိကန်လူမျိုး",
            example2: "你是哪国人？",
            example2_burmese: "မင်း ဘယ်နိုင်ငံသားလဲ။"
          },
          {
            id: 5,
            hsk_level: 1,
            word: "老师",
            pinyin: "lǎo shī",
            decomposition: ["老", "师"],
            similar_sound: "老狮",
            burmese: "ဆရာ/ဆရာမ",
            definition: "Teacher",
            explanation: "在学校教书的人。",
            example: "谢谢你，老师。",
            example_burmese: "ကျေးဇူးတင်ပါတယ် ဆရာ။",
            example2: "他是汉语老师。",
            example2_burmese: "သူက တရုတ်စာ ဆရာဖြစ်တယ်။"
          }
        ]
      }
    },

    // ==========================================
    // 2. 语法讲解 (Grammar Study)
    // ==========================================
    {
      type: "grammar_study",
      content: {
        grammarPoints: [
          {
            id: "gp_01",
            "语法标题": "动词「是」 (To be)",
            "句型结构": "Subject + {{是}} + Noun",
            "语法详解": "“是”相当于英语的 am/is/are。\n\n例如：\n1. 我是老师。\n2. 他是中国人。\n\n否定句在“是”前面加“不”：\n1. 我不是学生。",
            "讲解脚本": "是，就是 To be。我是中国人，他不是美国人。"
          },
          {
            id: "gp_02",
            "语法标题": "提问国籍 (Which country)",
            "句型结构": "你是 + {{哪}} + 国人？",
            "语法详解": "“哪” (nǎ) 表示疑问 'Which'。\n\n问句：你是哪国人？\n答句：我是缅甸人。",
            "讲解脚本": "问别人的国家，要用“哪”。注意是三声。"
          }
        ]
      }
    },

    // ==========================================
    // 3. 互动练习 (Interactive Exercises)
    // ==========================================
    
    // --- 练习 1：基础词汇 (纯文字) ---
    {
      type: "choice",
      content: {
        // 注意：question 变成了对象结构
        question: {
          text: "How do you say 'China' in Chinese?",
          imageUrl: null // 无图
        },
        options: [
          { id: "opt1", text: "美国 (Měi guó)" },
          { id: "opt2", text: "老师 (Lǎo shī)" },
          { id: "opt3", text: "中国 (Zhōng guó)" }, // 正确
          { id: "opt4", text: "你好 (Nǐ hǎo)" }
        ],
        // 注意：correctAnswer 是数组，对应 option 的 id
        correctAnswer: ["opt3"]
      }
    },

    // --- 练习 2：看图选词 (题干有图) ---
    {
      type: "choice",
      content: {
        question: {
          text: "这张图片是什么职业？(What is this person's job?)",
          // 这是一个老师的图片链接
          imageUrl: "https://cdn-icons-png.flaticon.com/512/1995/1995574.png"
        },
        options: [
          { id: "opt1", text: "学生 (Xué sheng)" },
          { id: "opt2", text: "老师 (Lǎo shī)" }, // 正确
          { id: "opt3", text: "医生 (Yī shēng)" },
          { id: "opt4", text: "人 (Rén)" }
        ],
        correctAnswer: ["opt2"]
      }
    },

    // --- 练习 3：语法填空 (文字) ---
    {
      type: "choice",
      content: {
        question: {
          text: "Complete the sentence: \n 他 ___ 美国人。 (He is NOT American.)",
          imageUrl: null
        },
        options: [
          { id: "opt1", text: "是 (shì)" },
          { id: "opt2", text: "不 (bù)" },
          { id: "opt3", text: "不是 (bú shì)" }, // 正确
          { id: "opt4", text: "哪 (nǎ)" }
        ],
        correctAnswer: ["opt3"]
      }
    },

    // --- 练习 4：听词选图/看词选图 (选项有图) ---
    {
      type: "choice",
      content: {
        question: {
          text: "哪个是“美国” (USA)？",
          imageUrl: null
        },
        options: [
          { 
            id: "opt1", 
            text: "China", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Flag_of_the_People%27s_Republic_of_China.svg/200px-Flag_of_the_People%27s_Republic_of_China.svg.png" 
          },
          { 
            id: "opt2", 
            text: "USA", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_the_United_States.svg/200px-Flag_of_the_United_States.svg.png" 
          }, // 正确
          { 
            id: "opt3", 
            text: "UK", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Flag_of_the_United_Kingdom_%281-2%29.svg/200px-Flag_of_the_United_Kingdom_%281-2%29.svg.png" 
          },
          { 
            id: "opt4", 
            text: "Myanmar", 
            imageUrl: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/Flag_of_Myanmar.svg/200px-Flag_of_Myanmar.svg.png" 
          }
        ],
        correctAnswer: ["opt2"]
      }
    }
  ]
};

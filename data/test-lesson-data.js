// components/Data/1.js

export default {
  id: "hsk1_01",
  level: 1,
  title: "第1课：你是哪国人？",
  blocks: [
    // ==========================================
    // 1. 课程封面
    // ==========================================
    {
      type: "cover",
      content: {
        title: "HSK 1 - 第1课",
        subtitle: "你是哪国人？",
        description: "学习中文最核心的疑问词：什么、谁、哪，以及如何用“是”和“吗”造句。",
        imageUrl: "https://images.pexels.com/photos/35267296/pexels-photo-35267296.jpeg"
      }
    },

    // ==========================================
    // 2. 单词学习 (无拼音字段，双例句)
    // ==========================================
    {
      type: "word_study",
      content: {
        title: "核心生词 (Core Vocabulary)",
        words: [
          // --- 核心疑问词 ---
          { 
            id: 1, 
            word: "什么", 
            burmese: "ဘာ / ဘာလဲ", 
            definition: "What", 
            examples: [
                { zh: "这是什么？", my: "ဒါဘာလဲ?" },
                { zh: "你吃什么？", my: "မင်း ဘာစားလဲ?" }
            ]
          },
          { 
            id: 2, 
            word: "谁", 
            burmese: "ဘယ်သူ", 
            definition: "Who", 
            examples: [
                { zh: "他是谁？", my: "သူ ဘယ်သူလဲ?" },
                { zh: "谁是老师？", my: "ဘယ်သူက ဆရာလဲ?" }
            ]
          },
          { 
            id: 3, 
            word: "哪", 
            burmese: "ဘယ်...", 
            definition: "Which", 
            examples: [
                { zh: "哪本书？", my: "ဘယ်စာအုပ်လဲ?" },
                { zh: "你是哪国人？", my: "မင်း ဘယ်နိုင်ငံသားလဲ?" }
            ]
          },
          
          // --- 代词 ---
          { 
            id: 4, 
            word: "我", 
            burmese: "ကျွန်တော် / ကျွန်မ", 
            definition: "I / Me", 
            examples: [
                { zh: "我是学生。", my: "ကျွန်တော် ကျောင်းသား ဖြစ်ပါတယ်။" },
                { zh: "我去中国。", my: "ငါ တရုတ်ပြည် သွားမယ်။" }
            ]
          },
          { 
            id: 5, 
            word: "你", 
            burmese: "မင်း / ခင်ဗျား", 
            definition: "You", 
            examples: [
                { zh: "你是中国人吗？", my: "မင်းက တရုတ်လူမျိုးလား?" },
                { zh: "你叫什么名字？", my: "မင်းနာမည် ဘယ်လိုခေါ်လဲ?" }
            ]
          },
          { 
            id: 6, 
            word: "他", 
            burmese: "သူ (ယောက်ျား)", 
            definition: "He / Him", 
            examples: [
                { zh: "他是我的朋友。", my: "သူက ငါ့သူငယ်ချင်းပါ။" },
                { zh: "他不是老师。", my: "သူက ဆရာမဟုတ်ဘူး။" }
            ]
          },
          { 
            id: 7, 
            word: "她", 
            burmese: "သူမ", 
            definition: "She / Her", 
            examples: [
                { zh: "她是漂亮的女孩。", my: "သူမက လှပတဲ့ မိန်းကလေးပါ။" },
                { zh: "她是我的姐姐。", my: "သူမက ငါ့အစ်မပါ။" }
            ]
          },

          // --- 动词 ---
          { 
            id: 8, 
            word: "是", 
            burmese: "ဖြစ်သည် / ဟုတ်သည်", 
            definition: "To be (is/am/are)", 
            examples: [
                { zh: "我是缅甸人。", my: "ငါက မြန်မာလူမျိုးပါ။" },
                { zh: "这是书。", my: "ဒါ စာအုပ်ပါ။" }
            ]
          },
          { 
            id: 9, 
            word: "叫", 
            burmese: "ခေါ်သည် / အမည်တွင်သည်", 
            definition: "To be called", 
            examples: [
                { zh: "我叫大卫。", my: "ငါ့နာမည် ဒေးဗစ်ပါ။" },
                { zh: "这只狗叫什么？", my: "ဒီခွေးနာမည် ဘယ်လိုခေါ်လဲ?" }
            ]
          },
          
          // --- 国家与名词 ---
          { 
            id: 10, 
            word: "国", 
            burmese: "နိုင်ငံ", 
            definition: "Country", 
            examples: [
                { zh: "你是哪国人？", my: "မင်း ဘယ်နိုင်ငံသားလဲ?" },
                { zh: "中国是大国。", my: "တရုတ်ပြည်က နိုင်ငံကြီးတစ်ခုပါ။" }
            ]
          },
          { 
            id: 11, 
            word: "人", 
            burmese: "လူ", 
            definition: "Person", 
            examples: [
                { zh: "他是好人。", my: "သူက လူကောင်းပါ။" },
                { zh: "这里有很多人。", my: "ဒီမှာ လူတွေအများကြီးရှိတယ်။" }
            ]
          },
          { 
            id: 12, 
            word: "中国", 
            burmese: "တရုတ်နိုင်ငံ", 
            definition: "China", 
            examples: [
                { zh: "我想去中国。", my: "ငါ တရုတ်ပြည် သွားချင်တယ်။" },
                { zh: "我喜欢中国。", my: "ငါ တရုတ်ပြည်ကို ကြိုက်တယ်။" }
            ]
          },
          { 
            id: 13, 
            word: "美国", 
            burmese: "အမေရိကန်နိုင်ငံ", 
            definition: "USA", 
            examples: [
                { zh: "他是美国人。", my: "သူက အမေရိကန်လူမျိုးပါ။" },
                { zh: "我也去美国。", my: "ငါလည်း အမေရိကန်သွားမယ်။" }
            ]
          },
          { 
            id: 14, 
            word: "缅甸", 
            burmese: "မြန်မာနိုင်ငံ", 
            definition: "Myanmar", 
            examples: [
                { zh: "我是缅甸人。", my: "ငါက မြန်မာလူမျိုးပါ။" },
                { zh: "缅甸很漂亮。", my: "မြန်မာပြည်က အရမ်းလှတယ်။" }
            ]
          },
          
          // --- 身份 ---
          { 
            id: 15, 
            word: "老师", 
            burmese: "ဆရာ / ဆရာမ", 
            definition: "Teacher", 
            examples: [
                { zh: "老师你好。", my: "မင်္ဂလာပါ ဆရာ။" },
                { zh: "老师很好。", my: "ဆရာက သဘောကောင်းတယ်။" }
            ]
          },
          { 
            id: 16, 
            word: "学生", 
            burmese: "ကျောင်းသား", 
            definition: "Student", 
            examples: [
                { zh: "我是学生。", my: "ကျွန်တော်က ကျောင်းသားပါ။" },
                { zh: "有很多学生。", my: "ကျောင်းသားတွေ အများကြီးရှိတယ်။" }
            ]
          },
          { 
            id: 17, 
            word: "名字", 
            burmese: "နာမည်", 
            definition: "Name", 
            examples: [
                { zh: "你叫什么名字？", my: "မင်းနာမည် ဘယ်လိုခေါ်လဲ?" },
                { zh: "写你的名字。", my: "မင်းနာမည် ရေးပါ။" }
            ]
          },

          // --- 虚词与副词 ---
          { 
            id: 18, 
            word: "吗", 
            burmese: "လား (မေးခွန်း)", 
            definition: "Question particle", 
            examples: [
                { zh: "你好吗？", my: "နေကောင်းလား?" },
                { zh: "这是水吗？", my: "ဒါ ရေလား?" }
            ]
          },
          { 
            id: 19, 
            word: "不", 
            burmese: "မ...ဘူး", 
            definition: "No / Not", 
            examples: [
                { zh: "我不去。", my: "ငါ မသွားဘူး။" },
                { zh: "我不吃。", my: "ငါ မစားဘူး။" }
            ]
          },
          { 
            id: 20, 
            word: "呢", 
            burmese: "ကော / ရော", 
            definition: "Particle (And you?)", 
            examples: [
                { zh: "我很好，你呢？", my: "ငါနေကောင်းတယ်၊ မင်းရော?" },
                { zh: "书在哪儿呢？", my: "စာအုပ် ဘယ်မှာလဲ?" }
            ]
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

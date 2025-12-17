export const hskLessonData = {
  id: "hsk1_01",
  title: "第1课：你是哪国人？",
  blocks: [
    // ==========================================
    // 1. 单词学习 (Word Study)
    // ==========================================
    {
      type: "word_study",
      content: {
        title: "核心生词",
        words: [
          {
            id: 1,
            word: "你好",
            pinyin: "nǐ hǎo",
            similar_sound: "尼好",
            burmese: "မင်္ဂလာပါ",
            definition: "Hello / Hi",
            example: "你好！你是老师吗？",
            example_burmese: "မင်္ဂလာပါ၊ သင်က ဆရာလား။"
          },
          {
            id: 2,
            word: "中国",
            pinyin: "Zhōng guó",
            similar_sound: "钟国",
            burmese: "တရုတ်",
            definition: "China",
            example: "我是中国人。",
            example_burmese: "ကျွန်တော်က တရုတ်လူမျိုးပါ။"
          },
          {
            id: 3,
            word: "美国",
            pinyin: "Měi guó",
            similar_sound: "美过",
            burmese: "အမေရိကန်",
            definition: "USA",
            example: "他是美国人。",
            example_burmese: "သူက အမေရိကန်လူမျိုးပါ။"
          },
          {
            id: 4,
            word: "人",
            pinyin: "rén",
            similar_sound: "忍",
            burmese: "လူ",
            definition: "Person / People",
            example: "中国人 / 美国人",
            example_burmese: "တရုတ်လူမျိုး / အမေရိကန်လူမျိုး"
          },
          {
            id: 5,
            word: "老师",
            pinyin: "lǎo shī",
            similar_sound: "老狮",
            burmese: "ဆရာ/ဆရာမ",
            definition: "Teacher",
            example: "谢谢你，老师。",
            example_burmese: "ကျေးဇူးတင်ပါတယ် ဆရာ။"
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
            "语法标题": "动词「是」的用法",
            "句型结构": "Subject + {{是}} + Noun",
            "语法详解": `
“是” (shì) 相当于英语中的 "to be" (am/is/are)，用来连接主语和名词。

## 1. 肯定句 (Positive)
| 主语 (Subject) | 动词 (Verb) | 名词 (Noun) |
| :--- | :--- | :--- |
| 我 (I) | 是 | 老师 |
| 他 (He) | 是 | 中国人 |
| 这 (This) | 是 | 书 |

· 汉语中，“是”不随人称变化。无论是“我”、“你”还是“他”，都用“是”。

## 2. 否定句 (Negative)
在“是”前面加“不”。
◆ 结构：主语 + 不是 + 名词
· 我不是老师。
· 他不是美国人。

## 3. 常见错误
❌ 我是很好。 (形容词前不用“是”)
✅ 我很好。

❌ 他是喝水。 (动词前不用“是”)
✅ 他喝水。

## 对话场景
A: 你是中国人吗？
B: 是，我是中国人。

A: 他是老师吗？
B: 他不是老师，他是学生。
`,
            "讲解脚本": "“是”就是英语里的 to be。比如：我是老师，他是学生。但是要注意，如果后面是形容词，比如“我很高兴”，中间不能加“是”。否定的时候说“不是”。"
          },
          {
            id: "gp_02",
            "语法标题": "疑问代词「哪」",
            "句型结构": "{{哪}} + Measure Word + Noun ?",
            "语法详解": `
“哪” (nǎ) 意思是 "which"。

## 1. 询问国籍
◆ 结构：你是 + 哪 + 国 + 人？
· 你是哪国人？ (Which country are you from?)
· 老师是哪国人？

## 2. 辨析：那 vs 哪
这两个字长得很像，发音和意思不同：
| 汉字 | 拼音 | 意思 |
| --- | --- | --- |
| **那** | nà | That (那个) |
| **哪** | nǎ | Which (哪个) |

⚠️ “哪”有口字旁 (口)，表示提问。

## 对话场景
A: 你是哪国人？
B: 我是美国人。你呢？
A: 我是中国人。
`,
            "讲解脚本": "“哪”用来提问，意思是 Which。最常用的句子是：你是哪国人？注意，“哪”是三声，而且左边有个口字旁，不要和“那”搞混了。"
          }
        ]
      }
    },

    // ==========================================
    // 3. 互动练习 (Interactive Exercises)
    // ==========================================
    
    // 练习 1：选择题 (考察单词)
    {
      type: "choice",
      content: {
        title: "词汇测试",
        question: "How do you say 'China' in Chinese?",
        options: [
          { id: "opt1", text: "美国 (Měi guó)" },
          { id: "opt2", text: "老师 (Lǎo shī)" },
          { id: "opt3", text: "中国 (Zhōng guó)" },
          { id: "opt4", text: "你好 (Nǐ hǎo)" }
        ],
        correctId: "opt3"
      }
    },

    // 练习 2：判断题 (考察语法 - 是)
    {
      type: "panduan", // 确保你有 PanDuanTi 组件
      content: {
        title: "语法判断",
        question: "Is this sentence correct? \n \"我是很好。\" (I am very good.)",
        isCorrect: false, // 答案是错的，因为形容词前不能加"是"
        explanation: "Adjectives (like 很好) do not use '是'. You should say '我很好'."
      }
    },

    // 练习 3：选择题 (考察语法 - 哪国人)
    {
      type: "choice",
      content: {
        title: "完成对话",
        question: "A: ______？\nB: 我是中国人。",
        options: [
          { id: "opt1", text: "你好吗？" },
          { id: "opt2", text: "你是哪国人？" },
          { id: "opt3", text: "你是老师吗？" },
          { id: "opt4", text: "他是谁？" }
        ],
        correctId: "opt2"
      }
    }
  ]
};

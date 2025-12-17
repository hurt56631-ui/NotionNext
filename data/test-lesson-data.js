export const testLessonData = {
  id: "lesson_101",
  title: "HSK Level 1 - Lesson 1",
  blocks: [
    // 1. 单词学习 Block
    {
      type: "word_study",
      content: {
        title: "核心词汇",
        words: [
          { id: 1, chinese: "你好", pinyin: "nǐ hǎo", translation: "Hello", word: "你好" },
          { id: 2, chinese: "谢谢", pinyin: "xiè xie", translation: "Thank you", word: "谢谢" },
          { id: 3, chinese: "老师", pinyin: "lǎo shī", translation: "Teacher", word: "老师" }
        ]
      }
    },
    
    // 2. 语法讲解 Block (使用我们之前写的富文本组件)
    {
      type: "grammar_study",
      content: {
        grammarPoints: [
          {
            id: "gp_1",
            "语法标题": "疑问词「吗」",
            "句型结构": "Statement + {{吗}} ?",
            "语法详解": `
“吗” 是一个助词，放在句子的最后，把陈述句变成是非问句（Yes/No Question）。

## 结构
◆ 句子 + 吗？
· 你好吗？ (How are you?)
· 你是老师吗？ (Are you a teacher?)

## 常见错误
❌ 你是吗老师？ (位置错了)
✅ 你是老师吗？

## 对话
A: 你是学生吗？
B: 是，我是学生。
`,
            "讲解脚本": "“吗”放在句子最后，用来提问。比如：你好吗？"
          },
          {
            id: "gp_2",
            "语法标题": "否定词「不」",
            "句型结构": "{{不}} + Verb/Adj",
            "语法详解": `
“不”用来否定动词或形容词。

## 结构
◆ 不 + 动词/形容词
· 我不是学生。
· 这个不好。

## 变调
⚠️ 当“不”后面的字是四声时，“不”读二声（bú）。
· 不看 (bú kàn)
· 不对 (bú duì)

## 对话
A: 你吃苹果吗？
B: 我不吃。
`,
            "讲解脚本": "“不”用来表示否定，放在动词前面。"
          }
        ]
      }
    },

    // 3. 选择题 Block (测试互动)
    {
      type: "choice",
      content: {
        question: "How do you say 'Thank you' in Chinese?",
        options: [
          { id: "opt1", text: "你好 (nǐ hǎo)" },
          { id: "opt2", text: "再见 (zài jiàn)" },
          { id: "opt3", text: "谢谢 (xiè xie)" }, // 正确
          { id: "opt4", text: "对不起 (duì bu qǐ)" }
        ],
        correctId: "opt3"
      }
    },

    // 4. 另一个选择题
    {
      type: "choice",
      content: {
        question: "Which sentence is correct?",
        options: [
          { id: "opt1", text: "你是吗老师？" },
          { id: "opt2", text: "你是老师吗？" }, // 正确
        ],
        correctId: "opt2"
      }
    }
  ]
};

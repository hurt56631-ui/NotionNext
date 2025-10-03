// /lib/openai.js (新文件)

export const translateText = async (text, settings) => {
    const { apiKey, apiUrl, model, targetLang } = settings;

    if (!apiKey) {
        throw new Error("尚未设置 OpenAI API 密钥。");
    }

    const prompt = `Translate the following text to ${targetLang}. Only return the translated content, without any introductory text or quotation marks:\n\n"${text}"`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`OpenAI API 错误: ${errorData.error.message}`);
        }

        const data = await response.json();
        return data.choices[0].message.content.trim();
    } catch (error) {
        console.error("翻译失败:", error);
        throw error;
    }
};

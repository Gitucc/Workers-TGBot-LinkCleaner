import { requestTelegramBotAPI } from "../utils/telegram";
import { LinkProcessor } from "../../core/LinkProcessor";

const URL_PATTERN = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./\[\]?%&=+#,;@~]*)?/g;

export async function handleInlineQuery(inlineQuery) {
    const query = inlineQuery.query;
    // Basic unique ID generation
    const generateUniqueId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Case 1: Empty Query or No Links
    // Show a "How to use" prompt
    const rawLinks = query.match(URL_PATTERN);
    if (!query || !rawLinks) {
         await requestTelegramBotAPI("answerInlineQuery", {
            inline_query_id: inlineQuery.id,
            cache_time: 0, // Disable caching for instant feedback
            results: [
                {
                    type: 'article',
                    id: generateUniqueId('help'),
                    title: '🔎 等待输入链接...',
                    description: "请粘贴或输入需要清理的链接",
                    input_message_content: {
                        message_text: "请直接在输入框粘贴或输入链接，例如：\n@Bot https://twitter.com/...",
                    },
                    thumb_url: "https://img.icons8.com/color/48/search--v1.png" // Optional visual aid
                },
            ]
        });
        return;
    }

    try {
        // Case 2: Links Detected
        // Process them
        const processedResults = await Promise.all(rawLinks.map(async (rawLink) => {
            const cleaned = await LinkProcessor.process(rawLink);
            return {
                raw: rawLink,
                cleaned: cleaned
            };
        }));

        let replyText = query;
        processedResults.forEach(result => {
            replyText = replyText.replace(result.raw, result.cleaned);
        });

        const isChanged = replyText !== query;
        const title = isChanged ? '🆗 点击发送清理后的结果' : '✅ 无需处理';
        const description = isChanged ? replyText : '暂无规则匹配或已是纯净链接';
        const thumb = isChanged ? "https://img.icons8.com/external-regular-kawalan-studio/48/external-double-check-social-media-regular-kawalan-studio.png" : "https://img.icons8.com/color/48/checked--v1.png";

        await requestTelegramBotAPI("answerInlineQuery", {
            inline_query_id: inlineQuery.id,
            cache_time: 0, 
            results: [
                {
                    type: 'article',
                    id: generateUniqueId('clean'),
                    title: title,
                    description: description, 
                    input_message_content: {
                        message_text: replyText,
                    },
                    thumb_url: thumb
                },
            ]
        });

    } catch (e) {
        console.error("Inline Query Error:", e);
        // Attempt to show error in UI
        await requestTelegramBotAPI("answerInlineQuery", {
            inline_query_id: inlineQuery.id,
            cache_time: 0,
            results: [{
                type: 'article',
                id: generateUniqueId('error'),
                title: '❌ 处理出错',
                description: "请稍后重试",
                input_message_content: { message_text: "处理链接时发生错误。" }
            }]
        });
    }
}

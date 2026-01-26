import { requestTelegramBotAPI } from "../utils/telegram";

const URL_PATTERN = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w-./\[\]?%&=+#,;@~]*)?/g;

export async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    // We expect format "keep:paramName"
    if (!data.startsWith("keep:")) return;

    const param = data.substring(5); // Remove "keep:" prefix
    
    // 1. Get current (cleaned) URL from the bot's message
    const parts = callbackQuery.message.text.split('\n\n');
    const currentUrlStr = parts[0];
    const textContext = parts.slice(1).join('\n\n');

    // 2. Get ORIGINAL URL from the user's message (via reply_to_message)
    const originalMessage = callbackQuery.message.reply_to_message;
    if (!originalMessage || !originalMessage.text) {
        await requestTelegramBotAPI("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: "无法找到原始消息，无法恢复参数值。",
            show_alert: true
        });
        return;
    }

    const originalLinks = originalMessage.text.match(URL_PATTERN);
    if (!originalLinks || originalLinks.length === 0) return;
    
    const originalUrlStr = originalLinks[0];

    try {
        let newUrl = new URL(currentUrlStr);
        let newUrlParams = new URLSearchParams(newUrl.search);
        
        if (newUrlParams.has(param)) {
            // Toggle OFF: Remove if already present
            newUrlParams.delete(param);
        } else {
            // Toggle ON: Restore from original
            const originalUrl = new URL(originalUrlStr);
            const originalVal = new URLSearchParams(originalUrl.search).get(param);
            
            // Only append if original had it
            if (originalVal !== null) {
                newUrlParams.append(param, originalVal);
            }
        }
        
        newUrlParams.sort();
        newUrl.search = newUrlParams.toString();

        await requestTelegramBotAPI("editMessageText", {
            chat_id: chatId,
            message_id: messageId,
            reply_markup: callbackQuery.message.reply_markup,
            text: newUrl.toString() + '\n\n' + textContext,
            disable_web_page_preview: false 
        });

        // Acknowledge the click
        await requestTelegramBotAPI("answerCallbackQuery", {
             callback_query_id: callbackQuery.id
        });

    } catch (error) {
        console.error("Callback Query Error:", error);
    }
}
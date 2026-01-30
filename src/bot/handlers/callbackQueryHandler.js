import { requestTelegramBotAPI, editMessageText } from "../utils/telegram";

const URL_PATTERN = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

export async function handleCallbackQuery(callbackQuery, env) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (!data.startsWith("keep:")) {
         await requestTelegramBotAPI("answerCallbackQuery", { callback_query_id: callbackQuery.id });
         return;
    }

    const param = data.substring(5);
    
    // 1. Get current (cleaned) URL
    const parts = callbackQuery.message.text.split('\n\n');
    const currentUrlStr = parts[0];
    const textContext = parts.slice(1).join('\n\n');

    // 2. Get ORIGINAL URL
    const originalMessage = callbackQuery.message.reply_to_message;
    if (!originalMessage || !originalMessage.text) {
        await requestTelegramBotAPI("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: "⚠️ 无法找到原始消息（可能已被删除），无法恢复参数。",
            show_alert: true
        });
        return;
    }

    const originalLinks = originalMessage.text.match(URL_PATTERN);
    if (!originalLinks || originalLinks.length === 0) {
        await requestTelegramBotAPI("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: "⚠️ 原始消息中未包含链接。",
            show_alert: true
        });
        return;
    }
    
    const originalUrlStr = originalLinks[0];

    try {
        let newUrl = new URL(currentUrlStr);
        let newUrlParams = new URLSearchParams(newUrl.search);
        
        if (newUrlParams.has(param)) {
            newUrlParams.delete(param);
        } else {
            const originalUrl = new URL(originalUrlStr);
            const originalVal = new URLSearchParams(originalUrl.search).get(param);
            
            if (originalVal !== null) {
                newUrlParams.append(param, originalVal);
            }
        }
        
        // Sorting params for consistency
        newUrlParams.sort();
        newUrl.search = newUrlParams.toString();

        await editMessageText(
            chatId, 
            messageId, 
            newUrl.toString() + '\n\n' + textContext, 
            callbackQuery.message.reply_markup,
            'HTML_ESCAPED'
        );

        await requestTelegramBotAPI("answerCallbackQuery", {
             callback_query_id: callbackQuery.id,
             text: `Parameter '${param}' toggled.`
        });

    } catch (error) {
        console.error("Callback Query Error:", error);
        await requestTelegramBotAPI("answerCallbackQuery", {
            callback_query_id: callbackQuery.id,
            text: "❌ 处理时发生错误。",
            show_alert: true
        });
    }
}

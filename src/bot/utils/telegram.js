
async function requestTelegramBotAPI(method, payload) {
    const token = globalThis.TG_BOT_TOKEN;
    if (!token) {
        console.error("CRITICAL: TG_BOT_TOKEN is missing!");
        throw new Error("TG_BOT_TOKEN missing");
    }
    
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json; charset=utf-8"
        },
        body: !payload ? undefined : JSON.stringify(payload)
    });
}

async function sendMessage(chatId, text, replyMarkup = null, replyToMessageId = null) {
    const params = {
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        reply_to_message_id: replyToMessageId,
    };
    if (replyMarkup) {
        params.reply_markup = replyMarkup;
    }
    await requestTelegramBotAPI("sendMessage", params);
}

export { requestTelegramBotAPI, sendMessage };

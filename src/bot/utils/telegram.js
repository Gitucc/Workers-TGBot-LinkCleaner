
function escapeHTML(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

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

async function sendMessage(chatId, text, replyMarkup = null, replyToMessageId = null, parseMode = 'HTML_ESCAPED') {
    let finalParams = {
        chat_id: chatId,
        reply_to_message_id: replyToMessageId,
    };

    if (parseMode === 'HTML_ESCAPED') {
        finalParams.text = escapeHTML(text);
        finalParams.parse_mode = 'HTML';
    } else if (parseMode === 'HTML') {
        finalParams.text = text;
        finalParams.parse_mode = 'HTML';
    } else if (parseMode === 'Markdown') {
        finalParams.text = text;
        finalParams.parse_mode = 'Markdown';
    } else {
        finalParams.text = text;
    }

    if (replyMarkup) {
        finalParams.reply_markup = replyMarkup;
    }
    
    await requestTelegramBotAPI("sendMessage", finalParams);
}

async function editMessageText(chatId, messageId, text, replyMarkup = null, parseMode = 'HTML_ESCAPED', disableWebPagePreview = false) {
    let finalParams = {
        chat_id: chatId,
        message_id: messageId,
        disable_web_page_preview: disableWebPagePreview
    };

    if (parseMode === 'HTML_ESCAPED') {
        finalParams.text = escapeHTML(text);
        finalParams.parse_mode = 'HTML';
    } else if (parseMode === 'HTML') {
        finalParams.text = text;
        finalParams.parse_mode = 'HTML';
    } else if (parseMode === 'Markdown') {
        finalParams.text = text;
        finalParams.parse_mode = 'Markdown';
    } else {
        finalParams.text = text;
    }

    if (replyMarkup) {
        finalParams.reply_markup = replyMarkup;
    }
    
    await requestTelegramBotAPI("editMessageText", finalParams);
}

export { requestTelegramBotAPI, sendMessage, editMessageText, escapeHTML };

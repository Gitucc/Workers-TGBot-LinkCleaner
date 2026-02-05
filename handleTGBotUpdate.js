import { handleMessage } from "./src/bot/handlers/messageHandler";
import { handleCallbackQuery } from "./src/bot/handlers/callbackQueryHandler";
import { handleInlineQuery } from "./src/bot/handlers/inlineQueryHandler";

async function handleTGBotUpdate(request, env) {
    try {
        const update = await request.json();
        if (update.message)
            await handleMessage(update.message, env);
        else if (update.callback_query)
            await handleCallbackQuery(update.callback_query, env);
        else if (update.inline_query)
            await handleInlineQuery(update.inline_query, env);
    } catch (err) {
        console.error('Update Handler Error:', err.stack);
    }
    return new Response(JSON.stringify({}), { headers: { "content-type": "application/json;charset=UTF-8" } });
}

export default handleTGBotUpdate;

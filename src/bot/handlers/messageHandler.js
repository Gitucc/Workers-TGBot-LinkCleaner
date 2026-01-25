import { requestTelegramBotAPI, sendMessage } from "../utils/telegram";
import { LinkProcessor } from "../../core/LinkProcessor";

const URL_PATTERN = /https?:\/\/[\w\-\.]+(?::\d+)?(?:\/[\w\-\.\/\[\]?%&=+#,;@~]*)?/g;

export async function handleMessage(message, env) {
    try {
        if (message.text) {
            if (message.text.startsWith("/")) {
                await handleCommand(message);
            } else {
                await handleText(message, env);
            }
        } else {
            if (message.chat.type === "private") {
                await sendMessage(message.chat.id, "人家看不懂啦！");
            }
        }
    } catch (e) {
        console.error("handleMessage Error:", e);
    }
}

async function handleCommand({ text, chat }) {
    const commandEndPos = text.indexOf(' ');
    let command = text.substring(1, commandEndPos == -1 ? undefined : commandEndPos).toLowerCase();
    
    if (command.includes('@')) {
        command = command.split('@')[0];
    }
    
    switch (command) {
        case 'start': {
            const startText = `
🛡️ *欢迎使用 Link Cleaner！*

我可以为您提供：
✅ *深度清理*：移除 B站、抖音、淘宝、京东等平台的追踪参数。
✅ *视频预览*：自动将 Twitter/X 链接转换为 fxtwitter 以支持 TG 预览。
✅ *直达原链*：通过重定向追踪，跳过中间页和短链接。

*使用方法：*
直接向我发送任何包含链接的文字，我会立即为您生成“纯净版”链接。
            `.trim();
            await sendMessage(chat.id, startText);
        } break;
        case 'help': {
            const helpText = `
📖 *功能指南与示例*

本机器人通过三级清理引擎，确保您的链接隐私且整洁。

✨ *主要功能：*
1. *基础清理*：移除 URL 中冗余的 \`utm_source\`, \`spm\` 等追踪标识。
2. *平台转换*：支持 Twitter/X -> fxtwitter，提升预览效果。
3. *手动微调*：清理后，您可以通过下方按钮手动保留或移除特定参数。
4. *内联模式*：在任何聊天中输入 \`@${env.BOT_NAME} [链接]\` 即可即时清理并发送。

📝 *支持示例：*
• *电商*：淘宝、天猫、京东、拼多多、闲鱼
• *短视频*：抖音、快手、小红书、TikTok
• *社交/视频*：B站 (b23.tv)、微博、YouTube、Twitter
• *其他*：酷安、高德地图等

💡 *提示*：如果一次发送多条链接，我会逐条处理并汇总返回。
            `.trim();
            await sendMessage(chat.id, helpText);
        } break;
        default: {
            if (chat.type === "private") {
                await sendMessage(chat.id, "无路赛无路赛无路赛!");
            }
        } break;
    }
}

async function handleText({ text, chat, message_id: messageId }, env) {
    const rawLinks = text.match(URL_PATTERN);
    if (!rawLinks) {
        if (chat.type === "private") {
            await sendMessage(chat.id, "略略略");
        }
        return;
    }

    const cleanedUrls = await Promise.all(rawLinks.map(async (link, i) => {
        try {
            const res = await LinkProcessor.process(link, env.DB);
            return res;
        } catch (err) {
            console.error(`[Error] Link ${i} failed:`, err);
            return link;
        }
    }));
    const CLEAN_NOT_NEEDED = "链接不需要清理跟踪参数哦，如果你认为这是个错误请向开发者反馈~";

    const isChanged = (original, cleaned) => {
        try {
            const u1 = new URL(original);
            const u2 = new URL(cleaned);
            // Normalize: remove trailing slash for comparison
            const s1 = u1.toString().replace(/\/+$/, '');
            const s2 = u2.toString().replace(/\/+$/, '');
            return s1 !== s2;
        } catch (e) {
            return original !== cleaned;
        }
    };

    if (rawLinks.length === 1) {
        const cleanedUrl = cleanedUrls[0];
        const rawLink = rawLinks[0];

        if (!isChanged(rawLink, cleanedUrl)) {
            if (chat.type === "private") {
                await sendMessage(chat.id, "这个" + CLEAN_NOT_NEEDED);
            }
        } else {
            const rawUrlObj = new URL(rawLink);
            const rawParams = Array.from(new URLSearchParams(rawUrlObj.search).keys());

            let isHostChanged = false;
            try { isHostChanged = new URL(cleanedUrl).hostname !== rawUrlObj.hostname; } catch(e){}

            if (rawParams.length === 0 || isHostChanged) {
                await sendMessage(chat.id, cleanedUrl, null, messageId);
            } else {
                const replyText = cleanedUrl + "\n\n如果你对处理的结果不满意，请在下面选择要保留（或再次移除）的参数吧：";
                const keyboardButtons = rawParams.map(param => [{
                    text: param, 
                    callback_data: "keep:" + param 
                }]);
                const replyMarkup = { inline_keyboard: keyboardButtons };
                await sendMessage(chat.id, replyText, replyMarkup, messageId);
            }
        }
    } else {
        let hasChanges = false;
        let outputLines = [];

        cleanedUrls.forEach((url, index) => {
            const rawLink = rawLinks[index];
            if (isChanged(rawLink, url)) {
                outputLines.push(url);
                hasChanges = true;
            } else {
                let hostname = "该域名";
                try { hostname = new URL(rawLink).hostname; } catch (e) {}
                outputLines.push(`[${hostname}] ${CLEAN_NOT_NEEDED}`);
            }
        });

        if (hasChanges) {
            let finalMsg = outputLines.join("\n");
            if (chat.type === "private") {
                 finalMsg += "\n\n🪢如果你对其中一些链接的处理结果不满意的话，还请你尝试将这些链接分开发送，每次只发送一条链接，以便更好地处理问题哦~\n";
            }
            await sendMessage(chat.id, finalMsg, null, messageId);
        } else if (chat.type === "private") {
            let finalMsg = outputLines.join("\n") + "\n\n🪢如果你对其中一些链接的处理结果不满意的话，还请你尝试将这些链接分开发送，每次只发送一条链接，以便更好地处理问题哦~\n";
            await sendMessage(chat.id, finalMsg, null, messageId);
        }
    }
}
import { sendMessage } from '../utils/telegram'
import { LinkProcessor } from '../../core/LinkProcessor'

// Robust URL pattern
const URL_PATTERN =
  /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g

export async function handleMessage(message, env) {
  try {
    if (message.text) {
      if (message.text.startsWith('/')) {
        await handleCommand(message, env)
      } else {
        await handleText(message, env)
      }
    } else {
      if (message.chat.type === 'private') {
        await sendMessage(message.chat.id, '人家看不懂啦！')
      }
    }
  } catch (e) {
    console.error('handleMessage Error:', e)
  }
}

async function handleCommand({ text, chat }, env) {
  const commandEndPos = text.indexOf(' ')
  let command = text
    .substring(1, commandEndPos == -1 ? undefined : commandEndPos)
    .toLowerCase()

  if (command.includes('@')) {
    command = command.split('@')[0]
  }

  const botName = env.BOT_NAME || 'YourBot'

  switch (command) {
    case 'start':
      {
        const startText = `
🛡️ <b>欢迎使用 Link Cleaner！</b>

我可以为您提供：
✅ <b>深度清理</b>：移除 B站、抖音、淘宝、京东等平台的追踪参数。
✅ <b>视频预览</b>：自动将 Twitter/X 链接转换为 fxtwitter 以支持 TG 预览。
✅ <b>直达原链</b>：通过重定向追踪，跳过中间页和短链接。

<b>使用方法：</b>
直接向我发送任何包含链接的文字，我会立即为您生成“纯净版”链接。
            `.trim()
        await sendMessage(chat.id, startText, null, null, 'HTML')
      }
      break
    case 'help':
      {
        const helpText = `
📖 <b>功能指南与示例</b>

本机器人通过三级清理引擎，确保您的链接隐私且整洁。

✨ <b>主要功能：</b>
1. <b>基础清理</b>：移除 URL 中冗余的 <code>utm_source</code>, <code>spm</code> 等追踪标识。
2. <b>平台转换</b>：支持 Twitter/X -> fxtwitter，提升预览效果。
3. <b>手动微调</b>：清理后，您可以通过下方按钮手动保留或移除特定参数。
4. <b>内联模式</b>：在任何聊天中输入 
                                <code>@${botName} [链接]</code> 即可即时清理并发送。

📝 <b>支持示例：</b>
• <b>电商</b>：淘宝、天猫、京东、拼多多、闲鱼
• <b>短视频</b>：抖音、快手、小红书、TikTok
• <b>社交/视频</b>：B站 (b23.tv)、微博、YouTube、Twitter
• <b>其他</b>：酷安、高德地图等

💡 <b>提示</b>：如果一次发送多条链接，我会逐条处理并汇总返回。
            `.trim()
        await sendMessage(chat.id, helpText, null, null, 'HTML')
      }
      break
    default:
      {
        if (chat.type === 'private') {
          await sendMessage(chat.id, '无路赛无路赛无路赛!')
        }
      }
      break
  }
}

async function handleText({ text, chat, message_id: messageId }, env) {
  const rawLinks = text.match(URL_PATTERN)
  if (!rawLinks) {
    if (chat.type === 'private') {
      await sendMessage(chat.id, '略略略')
    }
    return
  }

  const cleanedUrls = await Promise.all(
    rawLinks.map(async (link, i) => {
      try {
        return await LinkProcessor.process(link, env.DB)
      } catch (err) {
        console.error(`[Error] Link ${i} failed:`, err)
        return link
      }
    }),
  )

  const CLEAN_NOT_NEEDED =
    '链接不需要清理跟踪参数哦，如果你认为这是个错误请向开发者反馈~'

  const isChanged = (original, cleaned) => {
    try {
      const u1 = new URL(original)
      const u2 = new URL(cleaned)
      // Compare HREF equality to cover all components
      // But ignore trailing slash differences if they are the only difference
      const s1 = u1.href.replace(/\/$/, '')
      const s2 = u2.href.replace(/\/$/, '')
      return s1 !== s2
    } catch (e) {
      return original !== cleaned
    }
  }

  if (rawLinks.length === 1) {
    const cleanedUrl = cleanedUrls[0]
    const rawLink = rawLinks[0]

    if (!isChanged(rawLink, cleanedUrl)) {
      if (chat.type === 'private') {
        await sendMessage(chat.id, '这个' + CLEAN_NOT_NEEDED)
      }
    } else {
      const rawUrlObj = new URL(rawLink)
      const rawParams = Array.from(new URLSearchParams(rawUrlObj.search).keys())

      let isHostChanged = false
      try {
        isHostChanged = new URL(cleanedUrl).hostname !== rawUrlObj.hostname
      } catch (e) {}

      // If no params to toggle OR host changed (e.g. twitter -> fxtwitter), just show result
      if (rawParams.length === 0 || isHostChanged) {
        await sendMessage(chat.id, cleanedUrl, null, messageId)
      } else {
        const replyText =
          cleanedUrl +
          '\n\n如果你对处理的结果不满意，请在下面选择要保留（或再次移除）的参数吧：'

        const keyboardButtons = createKeyboardFromParams(rawParams, 32)
        const replyMarkup = { inline_keyboard: keyboardButtons }
        await sendMessage(chat.id, replyText, replyMarkup, messageId)
      }
    }
  } else {
    let hasChanges = false
    let outputLines = []

    cleanedUrls.forEach((url, index) => {
      const rawLink = rawLinks[index]
      if (isChanged(rawLink, url)) {
        outputLines.push(url)
        hasChanges = true
      } else {
        let hostname = '该域名'
        try {
          hostname = new URL(rawLink).hostname
        } catch (e) {}
        outputLines.push(`[${hostname}] ${CLEAN_NOT_NEEDED}`)
      }
    })

    if (hasChanges) {
      let finalMsg = outputLines.join('\n')
      if (chat.type === 'private') {
        finalMsg +=
          '\n\n🪢如果你对其中一些链接的处理结果不满意的话，还请你尝试将这些链接分开发送，每次只发送一条链接，以便更好地处理问题哦~\n'
      }
      await sendMessage(chat.id, finalMsg, null, messageId)
    } else if (chat.type === 'private') {
      let finalMsg =
        outputLines.join('\n') +
        '\n\n🪢如果你对其中一些链接的处理结果不满意的话，还请你尝试将这些链接分开发送，每次只发送一条链接，以便更好地处理问题哦~\n'
      await sendMessage(chat.id, finalMsg, null, messageId)
    }
  }
}

function createKeyboardFromParams(params, maxRowWidth = 24) {
  if (!Array.isArray(params) || params.length === 0) return []
  // 按长度升序，这样短的优先被放在一起
  const sorted = [...params].sort((a, b) => a.length - b.length)
  const rows = []
  let currentRow = []
  let currentLen = 0

  for (const p of sorted) {
    const textLen = p.length
    // 如果单个按钮本身就超出宽度，独占一行
    if (textLen >= maxRowWidth) {
      if (currentRow.length > 0) {
        rows.push(currentRow)
        currentRow = []
        currentLen = 0
      }
      rows.push([p])
      continue
    }

    // 预估加入这个按钮后行长度（按钮间按1个字符分隔）
    const projected = currentLen + (currentRow.length > 0 ? 1 : 0) + textLen
    if (projected <= maxRowWidth) {
      currentRow.push(p)
      currentLen = projected
    } else {
      if (currentRow.length > 0) rows.push(currentRow)
      currentRow = [p]
      currentLen = textLen
    }
  }
  if (currentRow.length > 0) rows.push(currentRow)

  // 转换为 Telegram 的 inline_keyboard 结构
  return rows.map((row) =>
    row.map((param) => ({ text: param, callback_data: 'keep:' + param })),
  )
}

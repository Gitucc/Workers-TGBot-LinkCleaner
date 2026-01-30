import handleTGBotCmd from './src/bot/handlers/cmdHandler'
import handleTGBotUpdate from './handleTGBotUpdate'
import { AdGuardUpdater } from './src/core/AdGuardUpdater'

export default {
  async fetch(request, env, ctx) {
    globalThis.TG_BOT_TOKEN = env.TG_BOT_TOKEN

    // Manual Update Trigger
    if (
      new URL(request.url).pathname === '/update-rules' &&
      request.method === 'POST'
    ) {
      // Secure with dedicated key, fallback to Bot Token if not set (legacy compat)
      const adminKey = env.ADMIN_KEY || env.TG_BOT_TOKEN
      if (request.headers.get('X-Admin-Key') !== adminKey) {
        return new Response('Unauthorized', { status: 401 })
      }
      const result = await AdGuardUpdater.update(env)
      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return handleRequest(request, env)
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(AdGuardUpdater.update(env))
  },
}

async function handleRequest(request, env) {
  const { pathname } = new URL(request.url)

  if (
    request.method === 'POST' &&
    request.headers.get('Content-Type')?.startsWith('application/json') &&
    pathname === `/${env.TG_BOT_TOKEN}`
  ) {
    return handleTGBotUpdate(request, env)
  } else if (
    request.method === 'GET' &&
    (pathname.startsWith('/TGBotCmd/') || pathname === '/TGBotCmd')
  ) {
    return handleTGBotCmd(request, pathname, env)
  } else if (request.method === 'GET' && pathname === '/state') {
    return new Response("I'm alive.\n", {
      headers: { 'content-type': 'text/plain' },
    })
  } else {
    return new Response('Error: Invalid Endpoint.\n', {
      status: 404,
      headers: { 'content-type': 'text/plain' },
    })
  }
}

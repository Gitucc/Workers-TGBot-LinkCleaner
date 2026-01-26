import handleTGBotCmd from "./src/bot/handlers/cmdHandler";
import handleTGBotUpdate from "./handleTGBotUpdate";
import { AdGuardUpdater } from "./src/core/AdGuardUpdater";

export default {
    async fetch(request, env, ctx) {
        // Compatibility Shim: Expose env vars to global scope for legacy code support
        globalThis.TG_BOT_TOKEN = env.TG_BOT_TOKEN;

        // Manual Update Trigger (for debugging/admin)
        if (new URL(request.url).pathname === '/update-rules' && request.method === 'POST') {
             // Basic auth check (optional but recommended)
             if (request.headers.get('X-Admin-Key') !== env.TG_BOT_TOKEN) {
                 return new Response('Unauthorized', { status: 401 });
             }
             const result = await AdGuardUpdater.update(env);
             return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
        }

        return handleRequest(request, env);
    },

    async scheduled(event, env, ctx) {
        ctx.waitUntil(AdGuardUpdater.update(env));
    }
};

async function handleRequest(request, env) {
    const { pathname } = new URL(request.url);
    
    // Check for POST request from Telegram
    if (request.method === "POST" && 
        request.headers.get("Content-Type")?.startsWith("application/json") && 
        pathname === `/${env.TG_BOT_TOKEN}`) {
        return handleTGBotUpdate(request, env);
    }
    // Check for Management Commands
    else if (request.method === "GET" && (pathname.startsWith('/TGBotCmd/') || pathname === '/TGBotCmd')) {
        return handleTGBotCmd(request, pathname);
    }
    // Health Check
    else if (request.method === "GET" && pathname === '/state') {
        return new Response("I'm alive.\n", { headers: { "content-type": "text/plain" } });
    }
    // Fallback
    else {
        return new Response("Error: Invalid Endpoint.\n", { status: 404, headers: { "content-type": "text/plain" } });
    }
}

export default {
  hostnames: ['bsky.app'],
  patterns: [/^(www\.)?bsky\.app$/i],

  // 关键：只有匹配特定的帖子路径才进行主机替换
  // 格式: /profile/*/post/*
  pathPattern: /^\/profile\/[^/]+\/post\/[^/]+/i,

  type: 'host_replace',
  newHost: 'fxbsky.app',

  // Bluesky 帖子通常不需要参数，清理掉追踪
  keepParams: [],
}

export default {
  hostnames: ['bilibili.com', 'www.bilibili.com'],
  patterns: [/^(www\.)?bilibili\.com$/i],
  type: 'param_clean',
  keepParams: ['p', 't'],
}

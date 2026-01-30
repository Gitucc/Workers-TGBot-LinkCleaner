/**
 * 示例：主机替换规则 (Host Replace)
 *
 * 场景：将 short.com 转换为 long.com，并映射/清理参数。
 */

export default {
  hostnames: ['short.com', 'www.short.com'],
  patterns: [/^(www\.)?short\.com$/i],

  type: 'host_replace',
  newHost: 'long.com',

  // [可选] 路径重写
  pathReplace: [{ match: /^\/s\//, replace: '/link/' }],

  // [可选] 参数改名 (大小写不敏感)
  paramMap: {
    sid: 'id',
  },

  // [重要] 明确指定要保留的参数
  // 如果不定义此项，host_replace 默认保留所有参数。
  // 如果定义为空数组 []，则清空所有参数。
  keepParams: ['id', 'token'],
}

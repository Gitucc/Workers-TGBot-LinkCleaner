/**
 * 示例：参数清理规则 (Param Clean)
 *
 * 场景：针对特定域名，仅保留指定的白名单参数。
 */

export default {
  hostnames: ['tracker.com'],
  patterns: [/^(www\.)?tracker\.com$/i],

  type: 'param_clean',

  // [重要] 指定白名单参数 (大小写不敏感)
  // 如果不定义此项，param_clean 默认清空所有参数。
  keepParams: ['id'],
}

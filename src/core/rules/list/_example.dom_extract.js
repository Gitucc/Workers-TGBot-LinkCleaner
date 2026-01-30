/**
 * 示例：DOM 提取规则 (DOM Extract)
 *
 * 场景：针对中间页，从 HTML 内容中提取真实的跳转 URL。
 * 注意：此类型会发起 GET 请求。
 */

export default {
  hostnames: ['jump.com'],
  patterns: [/^(www\.)?jump\.com$/i],

  type: 'dom_extract',

  // 正则表达式：第一个捕获组 [1] 必须是目标 URL
  selector: /var\s+targetUrl\s*=\s*['"]([^'"]+)['"]/,
}

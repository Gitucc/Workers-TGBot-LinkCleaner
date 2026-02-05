export default {
  hostnames: ['m.tb.cn'],
  patterns: [/^(www\.)?m\.tb\.cn$/i],
  type: 'dom_extract',
  selector: /var\s+url\s*=\s*['"]([^'"]+)['"]/,
}

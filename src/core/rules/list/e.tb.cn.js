export default {
  hostnames: ['e.tb.cn'],
  patterns: [/^(www\.)?e\.tb\.cn$/i],
  type: 'dom_extract',
  selector: /var\s+url\s*=\s*['"]([^'"]+)['"]/,
}

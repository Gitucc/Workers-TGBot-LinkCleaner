/**
 * Rule for JD Short Links (3.cn)
 *
 * 3.cn returns generic homepage on HEAD requests.
 * We must use GET (via dom_extract without selector) to follow the real redirect.
 */
export default {
  hostnames: ['3.cn'],
  // Match 3.cn exactly
  patterns: [/^(www\.)?3\.cn$/i],
  type: 'get_redirect',
}

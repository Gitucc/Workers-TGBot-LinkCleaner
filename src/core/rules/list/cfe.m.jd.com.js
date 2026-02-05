/**
 * Rule for JD Risk Handler (cfe.m.jd.com)
 *
 * When JD detects frequent requests, it redirects to a risk handler page.
 * We can extract the original destination from the 'returnurl' parameter.
 */
export default {
  hostnames: ['cfe.m.jd.com'],
  patterns: [/cfe\.m\.jd\.com/i],
  type: 'param_extract',
  paramName: 'returnurl',
}

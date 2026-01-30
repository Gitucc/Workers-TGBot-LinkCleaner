export default {
  hostnames: [
    'fxtwitter.com',
    'www.fxtwitter.com',
    'vxtwitter.com',
    'www.vxtwitter.com',
    'fixupx.com',
    'www.fixupx.com',
  ],
  patterns: [
    /^(www\.)?fxtwitter\.com$/i,
    /^(www\.)?vxtwitter\.com$/i,
    /^(www\.)?fixupx\.com$/i,
  ],
  type: 'param_clean',
  keepParams: [],
}

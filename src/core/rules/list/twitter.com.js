export default {
  hostnames: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
  patterns: [/^(www\.)?twitter\.com$/i, /^(www\.)?x\.com$/i],
  pathPattern: /\/status\//,
  type: 'host_replace',
  newHost: 'fxtwitter.com',
  keepParams: [],
}

export default {
    hostnames: ['twitter.com', 'www.twitter.com', 'x.com', 'www.x.com'],
    patterns: [/^(www\.)?twitter\.com$/i, /^(www\.)?x\.com$/i],
    type: 'host_replace',
    newHost: 'fxtwitter.com',
    keepParams: [] 
};

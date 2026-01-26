export default {
    hostnames: ['youtube.com', 'www.youtube.com', 'youtu.be', 'www.youtu.be'],
    patterns: [/^(www\.)?youtube\.com$/i, /^(www\.)?youtu\.be$/i],
    type: 'param_clean',
    keepParams: ['v', 'list', 'index', 't']
};

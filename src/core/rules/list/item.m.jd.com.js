export default {
    hostnames: ['item.m.jd.com'],
    patterns: [/^(www\.)?item\.m\.jd\.com$/i],
    type: 'host_replace',
    newHost: 'item.jd.com',
    pathReplace: [
        {
            match: /^\/product\//,
            replace: '/'
        }
    ],
    keepParams: []
};

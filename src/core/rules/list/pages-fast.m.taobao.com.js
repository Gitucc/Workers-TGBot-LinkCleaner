export default {
    hostnames: ['pages-fast.m.taobao.com'],
    patterns: [/^(www\.)?pages-fast\.m\.taobao\.com$/i],
    type: 'host_replace',
    newHost: 'item.taobao.com',
    pathReplace: [
        { match: /^.*$/, replace: '/item.htm' }
    ],
    paramMap: { 'itemIds': 'id' },
    keepParams: ['id']
};

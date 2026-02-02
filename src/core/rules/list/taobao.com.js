export default {
    hostnames: [
        'item.taobao.com', 
        'item.m.taobao.com', 
        'a.m.taobao.com', 
        'details.m.taobao.com',
        'item.tmall.com', 
        'detail.tmall.com', 
        'item.m.tmall.com',
        'detail.m.tmall.com',
        'tmall.com'
    ],
    patterns: [
        /^(www\.)?item\.taobao\.com$/i,
        /^(www\.)?item\.m\.taobao\.com$/i,
        /^(www\.)?a\.m\.taobao\.com$/i,
        /^(www\.)?details\.m\.taobao\.com$/i,
        /^(www\.)?item\.tmall\.com$/i,
        /^(www\.)?detail\.tmall\.com$/i,
        /^(www\.)?item\.m\.tmall\.com$/i,
        /^(www\.)?detail\.m\.tmall\.com$/i,
        /^(www\.)?tmall\.com$/i
    ],
    type: 'param_clean',
    keepParams: ['id', 'itemId', 'skuId']
};

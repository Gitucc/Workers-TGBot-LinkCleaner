export default {
    hostnames: ['map.baidu.com', 'www.map.baidu.com'],
    patterns: [/^(www\.)?map\.baidu\.com$/i],
    type: 'param_clean',
    // 百度地图严重依赖参数，s=加密数据, uid=地点ID, latlng=坐标
    keepParams: [
        's', 'newmap', 'uid', 'sharecallbackflag', 'shareurl', 'poiShareUid',
        'c', 'wd', 'qt',       // 城市、搜索词、查询类型
        'nb_x', 'nb_y',        // 坐标相关
        'center_rank', 
        'b', 'l'               // 缩放级别等
    ]
};
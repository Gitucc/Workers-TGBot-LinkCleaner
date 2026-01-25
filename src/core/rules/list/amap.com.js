/**
 * Amap (HighAuto Map) Rule
 * 
 * Logic:
 * 1. surl.amap.com (Short Link) -> HTTP 302 -> wb.amap.com
 * 2. wb.amap.com (Intermediate) -> HTTP 302 (Buggy Encoding) -> www.amap.com
 * 
 * Solution:
 * We catch the URL at step 2 (wb.amap.com). correctly formatted parameters are already present.
 * We rewrite host to www.amap.com and strip tracking params like 'commonBizInfo',
 * bypassing the buggy redirect entirely.
 * 
 * NOTE: Do NOT include 'surl.amap.com' here. It must be resolved via network to get the 'wb' link.
 */

export default {
    // Only match the intermediate domain 'wb' and the destination 'www'/'ditu'
    hostnames: ['amap.com', 'www.amap.com', 'wb.amap.com', 'ditu.amap.com'],
    patterns: [/^(www\.|wb\.|ditu\.)?amap\.com$/i],
    
    type: 'host_replace',
    newHost: 'www.amap.com',
    
    // 'q' contains "lat,lng,name" and is the only thing needed for navigation.
    keepParams: ['q']
};
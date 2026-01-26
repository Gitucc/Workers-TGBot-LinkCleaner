import { rules } from './rules/index';

export class LinkProcessor {
    static ruleMap = new Map();
    static fallbackRules = [];
    static isInitialized = false;
    static USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15 (Bot; +[INSERT_REPO_URL_HERE])';

    static init() {
        if (this.isInitialized) return;
        
        for (const rule of rules) {
            if (rule.hostnames && rule.hostnames.length > 0) {
                for (const hostname of rule.hostnames) {
                    this.ruleMap.set(hostname.toLowerCase(), rule);
                }
            } else {
                this.fallbackRules.push(rule);
            }
        }
        this.isInitialized = true;
    }

    /**
     * Process a single URL: Clean, Resolve, or Transform.
     */
    static async process(originalLink, db = null, depth = 0) {
        if (depth > 3) return originalLink;
        this.init(); 

        let url;
        try {
            url = new URL(originalLink);
        } catch (e) {
            return originalLink; 
        }

        // --- Tier 1: Manual Rules ---
        let ruleMatch = false;
        const rule = this.findRule(url.hostname);
        if (rule) {
            // Check if rule is constrained to specific paths. 
            // If pathPattern is undefined, it defaults to true (matches all).
            const isPathMatched = !rule.pathPattern || rule.pathPattern.test(url.pathname);
            
            if (isPathMatched) {
                if (rule.type === 'no_op') return originalLink;
                if (rule.type === 'dom_extract') {
                    return this.processDomExtract(url, rule, db, depth);
                }
                
                const manualCleaned = this.applyRule(url, rule);
                url = new URL(manualCleaned);
                ruleMatch = true;
            }
        }

        // --- Tier 2: AdGuard Tracking Filters (D1) ---
        if (db) {
            const adGuardUrl = await this.applyAdGuardRules(url, db);
            url = new URL(adGuardUrl);
        }

        // --- Tier 3: Redirect Follow ---
        if (url.toString() === originalLink) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);

                const response = await fetch(originalLink, {
                    method: 'HEAD',
                    redirect: 'manual',
                    headers: { 'User-Agent': this.USER_AGENT },
                    signal: controller.signal
                });
                clearTimeout(timeoutId);
                
                if (response.status === 301 || response.status === 302) {
                    const location = response.headers.get('location');
                    if (location) {
                        const absoluteUrl = new URL(location, originalLink).toString();
                        return this.process(absoluteUrl, db, depth + 1);
                    }
                }
            } catch (e) {
                // Ignore
            }
        }

        return url.toString();
    }

    static async applyAdGuardRules(urlObj, db, depth) {
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;
        const parts = hostname.split('.');
        const candidates = ['global'];
        
        const startLevel = Math.max(0, parts.length - 4);
        for (let i = startLevel; i < parts.length; i++) {
            const suffixParts = parts.slice(i);
            const suffixStr = suffixParts.join('.');
            if (!candidates.includes(suffixStr)) candidates.push(suffixStr);
            for (let j = 1; j < suffixParts.length; j++) {
                const wildcardStr = suffixParts.slice(0, j).join('.') + '.*';
                if (!candidates.includes(wildcardStr)) candidates.push(wildcardStr);
            }
        }

        try {
            const sql = `SELECT * FROM adguard_rules WHERE domain IN (${candidates.map(() => '?').join(',')})`;
            const dbResponse = await db.prepare(sql).bind(...candidates).all();
            const results = dbResponse.results || [];

            if (results.length === 0) return urlObj.toString();

            const toRemove = new Set();
            const toProtect = new Set();
            const regexRemove = [];
            const regexProtect = [];

            for (const rule of results) {
                if (rule.path_pattern && rule.path_pattern.trim() !== '') {
                    if (!pathname.startsWith(rule.path_pattern)) continue; 
                }

                try {
                    if (rule.rule_type === 1) {
                        if (rule.is_regex) {
                            const pattern = rule.param_name.startsWith('/') && rule.param_name.endsWith('/') 
                                ? rule.param_name.slice(1, -1) : rule.param_name;
                            regexProtect.push(new RegExp(pattern));
                        } else {
                            toProtect.add(rule.param_name.toLowerCase());
                        }
                    } else {
                        if (rule.is_regex) {
                            const pattern = rule.param_name.startsWith('/') && rule.param_name.endsWith('/') 
                                ? rule.param_name.slice(1, -1) : rule.param_name;
                            regexRemove.push(new RegExp(pattern));
                        } else {
                            toRemove.add(rule.param_name.toLowerCase());
                        }
                    }
                } catch (reErr) {
                    console.error(`Invalid regex in DB: ${rule.param_name}`, reErr);
                }
            }
            
            let changed = false;
            const newUrl = new URL(urlObj.toString());
            const paramsToDelete = [];

            for (const [param] of newUrl.searchParams) {
                const paramLower = param.toLowerCase();
                const isProtected = toProtect.has(paramLower) || regexProtect.some(r => r.test(param));
                if (isProtected) continue;

                const shouldRemove = toRemove.has(paramLower) || regexRemove.some(r => r.test(param));
                if (shouldRemove) {
                    paramsToDelete.push(param);
                }
            }

            if (paramsToDelete.length > 0) {
                paramsToDelete.forEach(p => newUrl.searchParams.delete(p));
                changed = true;
            }

            return changed ? newUrl.toString() : urlObj.toString();
        } catch (e) {
            console.error('D1 Query Error:', e);
            return urlObj.toString();
        }
    }

    static async processDomExtract(url, rule, db, depth) {
        try {
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'User-Agent': this.USER_AGENT }
            });
            const text = await response.text();
            if (rule.selector) {
                const match = text.match(rule.selector);
                if (match && match[1]) {
                    return this.process(match[1], db, depth + 1);
                }
            }
        } catch (e) {
            console.error(`DOM Extract failed for ${url}:`, e);
        }
        return url.toString(); 
    }

    static findRule(hostname) {
        hostname = hostname.toLowerCase();
        // 1. Exact Match O(1)
        if (this.ruleMap.has(hostname)) {
            return this.ruleMap.get(hostname);
        }
        // 2. Fallback for Complex Regex O(N)
        for (const rule of this.fallbackRules) {
            for (const pattern of rule.patterns) {
                if (pattern.test(hostname)) {
                    return rule;
                }
            }
        }
        return null;
    }

    static applyRule(url, rule) {
        const newUrl = new URL(url.toString());
        
        // 1. Host & Path Transformations
        if (rule.type === 'host_replace' && rule.newHost) {
            newUrl.hostname = rule.newHost;
        }
        if (rule.pathReplace && Array.isArray(rule.pathReplace)) {
            for (const replacement of rule.pathReplace) {
                if (replacement.match && typeof replacement.replace === 'string') {
                    newUrl.pathname = newUrl.pathname.replace(replacement.match, replacement.replace);
                }
            }
        }

        // 2. Robust Parameter Processing (Case-Insensitive)
        const originalParams = new URLSearchParams(newUrl.search);
        const finalParams = new URLSearchParams();

        // 2.1 Pre-process maps for O(1) case-insensitive lookup
        const lowerParamMap = {};
        if (rule.paramMap) {
            for (const key in rule.paramMap) {
                lowerParamMap[key.toLowerCase()] = rule.paramMap[key];
            }
        }
        const lowerKeepParams = new Set((rule.keepParams || []).map(p => p.toLowerCase()));

        // 2.2 Single pass over all parameters
        originalParams.forEach((value, key) => {
            const keyLower = key.toLowerCase();
            
            // A. Identity Transformation: Map names if needed
            let effectiveKey = key;
            if (lowerParamMap[keyLower]) {
                effectiveKey = lowerParamMap[keyLower];
            }
            
            const effectiveKeyLower = effectiveKey.toLowerCase();

            // B. Decision Logic: Decide if this parameter survives
            let shouldKeep = true;
            if (rule.type === 'host_replace' || rule.type === 'param_clean') {
                if (rule.keepParams) {
                    // If keepParams IS DEFINED (even if empty), check against it
                    shouldKeep = lowerKeepParams.has(effectiveKeyLower);
                } else {
                    // [Safety] Default behavior if keepParams is NOT DEFINED:
                    // host_replace: Keep everything (minimal surprise)
                    // param_clean: Drop everything (intended clean)
                    shouldKeep = (rule.type === 'host_replace');
                }
            }

            if (shouldKeep) {
                finalParams.append(effectiveKey, value);
            }
        });

        newUrl.search = finalParams.toString();
        return newUrl.toString();
    }

    static removeParams(url) {
        const newUrl = new URL(url.toString());
        newUrl.search = '';
        return newUrl;
    }
}

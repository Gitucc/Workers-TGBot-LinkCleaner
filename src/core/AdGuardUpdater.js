/**
 * AdGuard Updater Worker Logic
 */

export class AdGuardUpdater {
    static FILTER_URL = 'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_17_TrackParam/filter.txt';

    static async update(env) {
        console.log('[Updater] Starting AdGuard rule update...');
        const startTime = Date.now();

        try {
            const response = await fetch(this.FILTER_URL);
            if (!response.ok) throw new Error(`Failed to fetch rules: ${response.status}`);
            const text = await response.text();
            const lines = text.split('\n');

            console.log(`[Updater] Fetched ${lines.length} lines. Parsing...`);

            const rulesToInsert = [];
            for (const line of lines) {
                const parsedRules = this.parseRule(line);
                if (parsedRules.length > 0) {
                    rulesToInsert.push(...parsedRules);
                }
            }

            console.log(`[Updater] Parsed ${rulesToInsert.length} valid rules.`);

            const db = env.DB;
            const BATCH_SIZE = 100;
            
            await db.prepare('DELETE FROM adguard_rules').run();

            let insertedCount = 0;
            for (let i = 0; i < rulesToInsert.length; i += BATCH_SIZE) {
                const batch = rulesToInsert.slice(i, i + BATCH_SIZE);
                const statements = batch.map(rule => {
                    return db.prepare(
                        `INSERT INTO adguard_rules (domain, path_pattern, param_name, rule_type, is_regex) VALUES (?, ?, ?, ?, ?)`
                    ).bind(
                        rule.domain, 
                        rule.path_pattern, 
                        rule.param_name, 
                        rule.rule_type, 
                        rule.is_regex
                    );
                });
                
                await db.batch(statements);
                insertedCount += batch.length;
            }

            const duration = (Date.now() - startTime) / 1000;
            return { status: 'ok', count: insertedCount, time: duration };

        } catch (e) {
            console.error('[Updater] Update failed:', e);
            return { status: 'error', message: e.message };
        }
    }

    /**
     * Parsing AdGuard $removeparam rules correctly.
     * Examples:
     * 1. ||example.com^$removeparam=id
     * 2. @@||example.com$removeparam=id (Exception)
     * 3. $removeparam=utm_source (Global)
     * 4. $removeparam=id,domain=a.com|~b.com
     */
    static parseRule(line) {
        line = line.trim();
        // Skip comments and non-removeparam rules
        if (!line || line.startsWith('!') || line.startsWith('[') || !line.includes('$removeparam=')) return [];
        
        // 1. Handle Exception Prefix
        let ruleType = 0; // 0 = Remove, 1 = Allow
        if (line.startsWith('@@')) {
            ruleType = 1;
            line = line.substring(2);
        }

        // 2. Split Target Pattern and Modifier Options
        const dollarIndex = line.indexOf('$removeparam=');
        let targetPart = line.substring(0, dollarIndex);
        let modifierPart = line.substring(dollarIndex + 13); // After "$removeparam="

        // 3. Extract Core Parameter Pattern and Domain Options
        let paramPattern = "";
        let domainOptions = null;
        
        // Handle options after comma (e.g., $removeparam=id,domain=example.com)
        const commaIndex = modifierPart.indexOf(',domain=');
        if (commaIndex !== -1) {
            paramPattern = modifierPart.substring(0, commaIndex);
            domainOptions = modifierPart.substring(commaIndex + 8);
        } else {
            paramPattern = modifierPart;
        }

        // 4. Determine Initial Scope (Domain & Path)
        let initialDomain = 'global';
        let initialPath = null;

        if (targetPart.startsWith('||')) {
            let urlBody = targetPart.substring(2);
            // End at separator ^ or start of path /
            const endIdx = urlBody.search(/[\^\/]/);
            if (endIdx !== -1) {
                initialDomain = urlBody.substring(0, endIdx);
                if (urlBody[endIdx] === '/') {
                    initialPath = urlBody.substring(endIdx);
                }
            } else {
                initialDomain = urlBody;
            }
        } else if (targetPart && !targetPart.startsWith('$')) {
            // Raw domain or path match
            const slashIdx = targetPart.indexOf('/');
            if (slashIdx === 0) {
                // Path-only rule: /path$removeparam=...
                initialDomain = 'global';
                initialPath = targetPart;
            } else if (slashIdx !== -1) {
                // Domain and path: example.com/path$removeparam=...
                initialDomain = targetPart.substring(0, slashIdx);
                initialPath = targetPart.substring(slashIdx);
            } else {
                // Domain only: example.com$removeparam=...
                initialDomain = targetPart;
            }
        }

        const isRegex = paramPattern.startsWith('/') && paramPattern.endsWith('/') ? 1 : 0;
        const results = [];

        // 5. Expand Scope based on "domain=" options
        if (domainOptions) {
            const domainList = domainOptions.split('|');
            domainList.forEach(d => {
                if (d.startsWith('~')) {
                    // Exclusion: This site should NOT follow the rule
                    results.push({
                        domain: d.substring(1),
                        path_pattern: initialPath,
                        param_name: paramPattern,
                        rule_type: 1, // Force Allow
                        is_regex: isRegex
                    });
                } else {
                    results.push({
                        domain: d,
                        path_pattern: initialPath,
                        param_name: paramPattern,
                        rule_type: ruleType,
                        is_regex: isRegex
                    });
                }
            });
        } else {
            // No domain options, use initial scope
            results.push({
                domain: initialDomain || 'global',
                path_pattern: initialPath,
                param_name: paramPattern,
                rule_type: ruleType,
                is_regex: isRegex
            });
        }

        return results;
    }
}
/**
 * AdGuard Updater Worker Logic
 */

export class AdGuardUpdater {
  static FILTER_URL =
    'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_17_TrackParam/filter.txt'

  static async update(env) {
    console.log('[Updater] Starting AdGuard rule update...')
    const startTime = Date.now()

    try {
      const response = await fetch(this.FILTER_URL)
      if (!response.ok)
        throw new Error(`Failed to fetch rules: ${response.status}`)
      const text = await response.text()
      const lines = text.split('\n')

      console.log(`[Updater] Fetched ${lines.length} lines. Parsing...`)

      const rulesToInsert = []
      for (const line of lines) {
        const parsedRules = this.parseRule(line)
        if (parsedRules.length > 0) {
          rulesToInsert.push(...parsedRules)
        }
      }

      console.log(`[Updater] Parsed ${rulesToInsert.length} valid rules.`)

      if (rulesToInsert.length === 0) {
        console.warn(
          '[Updater] No valid rules found. Skipping update to preserve existing data.',
        )
        return { status: 'skipped', count: 0, message: 'No valid rules found' }
      }

      const db = env.DB
      const BATCH_SIZE = 50 // Smaller batch size to stay within limits

      // Transactional-ish update:
      // D1 supports batching which is implicit transaction for the batch.
      // Since we cannot fit all inserts in one batch (limit is usually 100 statements or size limit),
      // we have to delete first.
      // Ideally, we would use a temporary table but D1 schema changes are expensive/slow in migration.
      // Current best effort: Delete then Insert in chunks.
      // IMPROVEMENT: Delete only after fetching and parsing succeeds (already done).

      await db.prepare('DELETE FROM adguard_rules').run()

      let insertedCount = 0
      for (let i = 0; i < rulesToInsert.length; i += BATCH_SIZE) {
        const batch = rulesToInsert.slice(i, i + BATCH_SIZE)
        const statements = batch.map((rule) => {
          return db
            .prepare(
              `INSERT INTO adguard_rules (domain, path_pattern, param_name, rule_type, is_regex) VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(
              rule.domain,
              rule.path_pattern,
              rule.param_name,
              rule.rule_type,
              rule.is_regex,
            )
        })

        // Execute batch
        await db.batch(statements)
        insertedCount += batch.length
      }

      const duration = (Date.now() - startTime) / 1000
      return { status: 'ok', count: insertedCount, time: duration }
    } catch (e) {
      console.error('[Updater] Update failed:', e)
      return { status: 'error', message: e.message }
    }
  }

  /**
   * Parsing AdGuard $removeparam rules correctly.
   */
  static parseRule(line) {
    line = line.trim()
    // Skip comments and non-removeparam rules
    if (
      !line ||
      line.startsWith('!') ||
      line.startsWith('[') ||
      !line.includes('$removeparam=')
    )
      return []

    try {
      // 1. Handle Exception Prefix
      let ruleType = 0 // 0 = Remove, 1 = Allow
      if (line.startsWith('@@')) {
        ruleType = 1
        line = line.substring(2)
      }

      // 2. Split Target Pattern and Modifier Options
      const dollarIndex = line.indexOf('$removeparam=')
      let targetPart = line.substring(0, dollarIndex)
      let modifierPart = line.substring(dollarIndex + 13) // After "$removeparam="

      // 3. Extract Core Parameter Pattern and Domain Options
      let paramPattern = ''
      let domainOptions = null

      // AdGuard syntax: $removeparam=<param>[,<modifier>[,<modifier>...]]
      // We treat the first token as the parameter pattern and then
      // scan remaining tokens for a domain= modifier, ignoring others
      // like important, badfilter, third-party, etc.
      const modifierTokens = modifierPart.split(',')
      if (modifierTokens.length > 0) {
        paramPattern = modifierTokens[0].trim()
        for (let i = 1; i < modifierTokens.length; i++) {
          const token = modifierTokens[i].trim()
          if (token.startsWith('domain=')) {
            // Extract everything after "domain="
            domainOptions = token.substring('domain='.length)
          }
        }
      } else {
        paramPattern = modifierPart
      }

      // Validation: Ensure paramPattern is a valid regex if it looks like one
      const isRegex =
        paramPattern.startsWith('/') && paramPattern.endsWith('/') ? 1 : 0
      if (isRegex) {
        try {
          new RegExp(paramPattern.slice(1, -1))
        } catch (e) {
          console.warn(`[Updater] Skipping invalid regex: ${paramPattern}`)
          return []
        }
      }

      // 4. Determine Initial Scope (Domain & Path)
      let initialDomain = 'global'
      let initialPath = null

      if (targetPart.startsWith('||')) {
        let urlBody = targetPart.substring(2)
        const endIdx = urlBody.search(/[\^\/]/)
        if (endIdx !== -1) {
          initialDomain = urlBody.substring(0, endIdx)
          if (urlBody[endIdx] === '/') {
            initialPath = urlBody.substring(endIdx)
          }
        } else {
          initialDomain = urlBody
        }
      } else if (targetPart && !targetPart.startsWith('$')) {
        const slashIdx = targetPart.indexOf('/')
        if (slashIdx === 0) {
          initialDomain = 'global'
          initialPath = targetPart
        } else if (slashIdx !== -1) {
          initialDomain = targetPart.substring(0, slashIdx)
          initialPath = targetPart.substring(slashIdx)
        } else {
          initialDomain = targetPart
        }
      }

      const results = []

      // 5. Expand Scope based on "domain=" options
      if (domainOptions) {
        const domainList = domainOptions.split('|')
        domainList.forEach((d) => {
          if (d.startsWith('~')) {
            // Exclusion
            results.push({
              domain: d.substring(1),
              path_pattern: initialPath,
              param_name: paramPattern,
              rule_type: 1, // Force Allow
              is_regex: isRegex,
            })
          } else {
            results.push({
              domain: d,
              path_pattern: initialPath,
              param_name: paramPattern,
              rule_type: ruleType,
              is_regex: isRegex,
            })
          }
        })
      } else {
        results.push({
          domain: initialDomain || 'global',
          path_pattern: initialPath,
          param_name: paramPattern,
          rule_type: ruleType,
          is_regex: isRegex,
        })
      }

      return results
    } catch (e) {
      console.error(`[Updater] Parse error on line: ${line}`, e)
      return []
    }
  }
}

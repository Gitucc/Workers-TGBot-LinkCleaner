import { rules } from './rules/index'

export class LinkProcessor {
  static ruleMap = new Map()
  static fallbackRules = []
  static isInitialized = false
  static USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15 (Bot; +https://github.com/TGBot-LinkCleaner)'

  static init() {
    if (this.isInitialized) return

    for (const rule of rules) {
      if (rule.hostnames && rule.hostnames.length > 0) {
        for (const hostname of rule.hostnames) {
          this.ruleMap.set(hostname.toLowerCase(), rule)
        }
      } else {
        this.fallbackRules.push(rule)
      }
    }
    this.isInitialized = true
  }

  /**
   * Process a single URL: Clean, Resolve, or Transform.
   */
  static async process(originalLink, db = null, depth = 0) {
    if (depth > 3) return originalLink
    this.init()

    let url
    try {
      url = new URL(originalLink)
    } catch (e) {
      return originalLink
    }

    console.log(`[LinkProcessor] Processing: ${url.href} (Depth: ${depth})`)

    // --- Tier 1: Manual Rules ---
    let ruleApplied = false
    const rule = this.findRule(url.hostname)
    if (rule) {
      console.log(
        `[LinkProcessor] Rule Matched: ${
          rule.hostnames?.[0] || 'RegexRule'
        } for ${url.hostname}`,
      )
      // Check if rule is constrained to specific paths.
      // If pathPattern is undefined, it defaults to true (matches all).
      const isPathMatched =
        !rule.pathPattern || rule.pathPattern.test(url.pathname)

      if (isPathMatched) {
        if (rule.type === 'no_op') return originalLink
        if (rule.type === 'dom_extract') {
          return this.processDomExtract(url, rule, db, depth)
        }
        if (rule.type === 'get_redirect') {
          return this.processGetRedirect(url, rule, db, depth)
        }
        if (rule.type === 'param_extract' && rule.paramName) {
          const extracted = url.searchParams.get(rule.paramName)
          if (extracted) {
            console.log(
              `[LinkProcessor] Parameter Extracted: ${rule.paramName} -> ${extracted}`,
            )
            return this.process(extracted, db, depth + 1)
          }
        }

        const manualCleaned = this.applyRule(url, rule)
        url = new URL(manualCleaned)
        ruleApplied = true
      }
    } else {
      console.log(`[LinkProcessor] No Rule Matched for ${url.hostname}`)
    }

    // --- Tier 2: AdGuard Tracking Filters (D1) ---
    if (db) {
      const adGuardUrl = await this.applyAdGuardRules(url, db)
      url = new URL(adGuardUrl)
    }

    // --- Tier 3: Redirect Follow ---
    // Refactored: We check for 3xx status even if URL was modified,
    // but we prioritize cleaning first.
    // Only follow redirects if the *current* URL looks like a redirector
    // OR if it hasn't been definitively handled by a rule that says "I'm done".
    // For safety/perf, we usually only follow if it looks "short" or specific known redirectors,
    // but the original logic was "if not modified".
    // New logic: Check if we should try to resolve it.
    // We'll trust the modified URL. If it's the same as original OR it was modified,
    // we might still want to check if it redirects (e.g. clean params -> still a redirect).

    try {
      // Optimized: Only HEAD request if we suspect it's a redirector or we haven't stripped much.
      // For now, retaining the "try to resolve" but allowing it even if modified,
      // unless it's a known "final" domain.

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 6000) // Increased to 6s

      const response = await fetch(url.toString(), {
        method: 'HEAD',
        redirect: 'manual',
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.status === 301 || response.status === 302) {
        const location = response.headers.get('location')
        if (location) {
          const absoluteUrl = new URL(location, url.toString()).toString()
          return this.process(absoluteUrl, db, depth + 1)
        }
      }
    } catch (e) {
      // Network error or timeout - ignore and return current state
    }

    return url.toString()
  }

  static async applyAdGuardRules(urlObj, db) {
    const hostname = urlObj.hostname
    const pathname = urlObj.pathname
    const parts = hostname.split('.')
    const candidates = ['global']

    // Generate domain candidates: "sub.example.com" -> ["sub.example.com", "example.com", "com", "*.example.com", "*.com"]
    const startLevel = Math.max(0, parts.length - 4)
    for (let i = startLevel; i < parts.length; i++) {
      const suffixParts = parts.slice(i)
      const suffixStr = suffixParts.join('.')
      if (!candidates.includes(suffixStr)) candidates.push(suffixStr)

      // Add wildcard variants for DB lookup support
      if (suffixParts.length > 1) {
        const wildcard = '*.' + suffixStr
        if (!candidates.includes(wildcard)) candidates.push(wildcard)
      }
    }

    // Add wildcard searches for the DB query
    // If DB has "google.*", and we visit "mail.google.com"
    // We need to query for "google.com" (handled) and maybe patterns?
    // Simpler approach: Query exact matches of domain parts and let DB rules handle wildcards if stored explicitly.
    // The current implementation queries exact domain strings.

    try {
      const sql = `SELECT * FROM adguard_rules WHERE domain IN (${candidates
        .map(() => '?')
        .join(',')})`
      const dbResponse = await db
        .prepare(sql)
        .bind(...candidates)
        .all()
      const results = dbResponse.results || []

      if (results.length === 0) return urlObj.toString()

      const toRemove = new Set()
      const toProtect = new Set()
      const regexRemove = []
      const regexProtect = []

      for (const rule of results) {
        if (rule.path_pattern && rule.path_pattern.trim() !== '') {
          // Simple prefix match for path
          if (!pathname.startsWith(rule.path_pattern)) continue
        }

        try {
          if (rule.rule_type === 1) {
            // Allow/Protect
            if (rule.is_regex) {
              const pattern =
                rule.param_name.startsWith('/') && rule.param_name.endsWith('/')
                  ? rule.param_name.slice(1, -1)
                  : rule.param_name
              regexProtect.push(new RegExp(pattern))
            } else {
              toProtect.add(rule.param_name.toLowerCase())
            }
          } else {
            // Remove
            if (rule.is_regex) {
              const pattern =
                rule.param_name.startsWith('/') && rule.param_name.endsWith('/')
                  ? rule.param_name.slice(1, -1)
                  : rule.param_name
              regexRemove.push(new RegExp(pattern))
            } else {
              toRemove.add(rule.param_name.toLowerCase())
            }
          }
        } catch (reErr) {
          console.error(`Invalid regex in DB: ${rule.param_name}`, reErr)
        }
      }

      let changed = false
      const newUrl = new URL(urlObj.toString())
      const paramsToDelete = []

      for (const [param] of newUrl.searchParams) {
        const paramLower = param.toLowerCase()
        const isProtected =
          toProtect.has(paramLower) || regexProtect.some((r) => r.test(param))
        if (isProtected) continue

        const shouldRemove =
          toRemove.has(paramLower) || regexRemove.some((r) => r.test(param))
        if (shouldRemove) {
          paramsToDelete.push(param)
        }
      }

      if (paramsToDelete.length > 0) {
        paramsToDelete.forEach((p) => newUrl.searchParams.delete(p))
        changed = true
      }

      return changed ? newUrl.toString() : urlObj.toString()
    } catch (e) {
      console.error('D1 Query Error:', e)
      return urlObj.toString()
    }
  }

  static async processDomExtract(url, rule, db, depth) {
    console.log(`[LinkProcessor] Entering processDomExtract for ${url}`)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000) // Increased to 8s

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log(
        `[LinkProcessor] Fetch Status: ${response.status}, Final URL: ${response.url}`,
      )

      if (!response.body) return url.toString()

      // Read only the first 128KB to avoid OOM on large pages
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let text = ''
      let bytesRead = 0
      const MAX_BYTES = 128 * 1024 // 128KB

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          text += decoder.decode(value, { stream: true })
          bytesRead += value.length

          if (bytesRead >= MAX_BYTES) {
            await reader.cancel()
            break
          }
        }
        // Flush decoder
        text += decoder.decode()
      } catch (streamErr) {
        // Ignore stream errors (like cancel)
      }

      if (rule.selector) {
        const match = text.match(rule.selector)
        if (match && match[1]) {
          console.log(`[LinkProcessor] DOM Selector Matched: ${match[1]}`)
          return this.process(match[1], db, depth + 1)
        }
      } else {
        // If no selector is defined, we assume the goal was just to follow the GET redirect chain
        // response.url contains the final URL after redirects
        if (response.url && response.url !== url.toString()) {
          console.log(
            `[LinkProcessor] Following GET Redirect to: ${response.url}`,
          )
          return this.process(response.url, db, depth + 1)
        }
      }
    } catch (e) {
      console.error(`DOM Extract failed for ${url}:`, e)
    }
    return url.toString()
  }

  static async processGetRedirect(url, rule, db, depth) {
    console.log(`[LinkProcessor] Entering processGetRedirect for ${url}`)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 8000)

      const response = await fetch(url.toString(), {
        method: 'GET',
        redirect: 'manual',
        headers: { 'User-Agent': this.USER_AGENT },
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.status === 301 || response.status === 302) {
        const location = response.headers.get('location')
        if (location) {
          const absoluteUrl = new URL(location, url.toString()).toString()
          console.log(`[LinkProcessor] GET Redirect found: ${absoluteUrl}`)
          return this.process(absoluteUrl, db, depth + 1)
        }
      }
      // If not a redirect, return original URL (or final one if fetch followed it despite manual - shouldn't happen)
      return url.toString()
    } catch (e) {
      console.error(`GET Redirect failed for ${url}:`, e)
      return url.toString()
    }
  }

  static findRule(hostname) {
    hostname = hostname.toLowerCase()
    // 1. Exact Match O(1)
    if (this.ruleMap.has(hostname)) {
      return this.ruleMap.get(hostname)
    }
    // 2. Fallback for Complex Regex O(N)
    for (const rule of this.fallbackRules) {
      for (const pattern of rule.patterns) {
        if (pattern.test(hostname)) {
          return rule
        }
      }
    }
    return null
  }

  static applyRule(url, rule) {
    const newUrl = new URL(url.toString())

    // 1. Host & Path Transformations
    if (rule.type === 'host_replace' && rule.newHost) {
      newUrl.hostname = rule.newHost
    }
    if (rule.pathReplace && Array.isArray(rule.pathReplace)) {
      for (const replacement of rule.pathReplace) {
        if (replacement.match && typeof replacement.replace === 'string') {
          newUrl.pathname = newUrl.pathname.replace(
            replacement.match,
            replacement.replace,
          )
        }
      }
    }

    // 2. Robust Parameter Processing (Case-Insensitive)
    const originalParams = new URLSearchParams(newUrl.search)
    const finalParams = new URLSearchParams()

    // 2.1 Pre-process maps for O(1) case-insensitive lookup
    const lowerParamMap = {}
    if (rule.paramMap) {
      for (const key in rule.paramMap) {
        lowerParamMap[key.toLowerCase()] = rule.paramMap[key]
      }
    }
    const lowerKeepParams = new Set(
      (rule.keepParams || []).map((p) => p.toLowerCase()),
    )

    // 2.2 Single pass over all parameters
    originalParams.forEach((value, key) => {
      const keyLower = key.toLowerCase()

      // A. Identity Transformation: Map names if needed
      let effectiveKey = key
      if (lowerParamMap[keyLower]) {
        effectiveKey = lowerParamMap[keyLower]
      }

      const effectiveKeyLower = effectiveKey.toLowerCase()

      // B. Decision Logic: Decide if this parameter survives
      let shouldKeep = true
      if (rule.type === 'host_replace' || rule.type === 'param_clean') {
        if (rule.keepParams) {
          shouldKeep = lowerKeepParams.has(effectiveKeyLower)
        } else {
          shouldKeep = rule.type === 'host_replace'
        }
      }

      if (shouldKeep) {
        finalParams.append(effectiveKey, value)
      }
    })

    newUrl.search = finalParams.toString()
    return newUrl.toString()
  }
}

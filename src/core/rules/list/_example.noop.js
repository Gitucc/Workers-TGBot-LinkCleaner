/**
 * Example Rule: No-Op / Whitelist
 * 
 * Purpose: 
 * Completely ignore specific domains. No network requests will be made,
 * and no parameters will be cleaned.
 * 
 * Use Case:
 * Sites that break if any parameters are removed, or sites you trust 100%.
 */

export default {
    // List all domains this rule applies to (including www)
    hostnames: ['example.org', 'www.example.org'],
    
    // Regular expressions to match the domains (fallback for complex cases)
    patterns: [/^(www\.)?example\.org$/i],
    
    // Type: 'no_op' means "Do Nothing"
    type: 'no_op'
};

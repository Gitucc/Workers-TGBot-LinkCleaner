-- Latest Database Schema (Synchronized with Production D1)
CREATE TABLE IF NOT EXISTS adguard_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 域名主体。
    -- 1. 精确域名: "bilibili.com"
    -- 2. 通配域名: "google.*"
    -- 3. 全局: "global"
    domain TEXT NOT NULL,
    -- 路径特征。
    -- 存储 URL 的路径部分，例如 "/share/"。
    -- 如果为 NULL，表示匹配该域名下的所有路径。
    path_pattern TEXT,
    -- 参数名 (或正则字符串)
    param_name TEXT NOT NULL,
    -- 规则类型
    -- 0: Remove (删除参数)
    -- 1: Allow (白名单/保护参数 - 对应 domain=~example.com 或 @@)
    rule_type INTEGER DEFAULT 0,
    -- 参数名是否为正则
    is_regex INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_adguard_domain ON adguard_rules(domain);
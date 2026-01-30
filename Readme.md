# Workers-TGBot-LinkCleaner 🛡️

一个基于 Cloudflare Workers + D1 数据库的高效 Telegram 链接清理机器人。

## 🌟 特性

- **三级防护架构**：
  1. **Tier 1 (手动规则)**：针对头部域名（B站、抖音、Twitter等）的高精度深度清理。
  2. **Tier 2 (AdGuard 智能引擎)**：自动同步并解析 AdGuard URL Tracking Protection 规则库（2400+ 规则），支持通配符域名、路径匹配和正则。
  3. **Tier 3 (暴力跟随)**：自动追踪 301/302 重定向并递归清理。
- **高性能**：利用 Cloudflare D1 边缘数据库，规则查询仅需毫秒级。
- **自动化**：每 3 天自动更新一次 AdGuard 规则库，保持防护能力最前沿。

## 🚀 快速部署

### 1. 准备工作
- 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)。
- 登录 Cloudflare：`npx wrangler login`。

### 2. 创建数据库
```bash
npx wrangler d1 create link-cleaner-db
```
**重要**：执行后，你会获得一个 `database_id`。

1.  复制 `wrangler.toml.template` 为 `wrangler.toml`（或运行生成脚本）。
2.  在项目根目录创建一个 `.env` 文件：
    ```env
    D1_DATABASE_ID=你的_database_id
    # 可选：自定义 Worker 名称 (默认: tgbot-link-cleaner)
    WORKERS_NAME=your-worker-name
    ```
3.  运行配置生成命令：
    ```bash
    npm run gen-config
    ```

### 3. 初始化数据库
```bash
npx wrangler d1 execute link-cleaner-db --file=./schema.sql
```

### 4. 设置 Secret
```bash
npx wrangler secret put TG_BOT_TOKEN
```
输入你的 Telegram Bot Token。

### 5. 部署
```bash
npm run deploy
```
此命令会自动先根据 `.env` 生成 `wrangler.toml`，然后再执行部署。

### 💡 重要：数据初始化
部署成功后，你的数据库是空的。你必须手动触发一次同步（或者等待下一次 Cron 触发），以后 Cron 触发器才会每 3 天接管自动更新。

请执行以下命令（替换为你自己的 Worker 域名）：
```bash
curl -X POST https://your-worker.workers.dev/update-rules -H "X-Admin-Key: <YOUR_TG_BOT_TOKEN>"
```

## 🛠️ 手搓自定义规则 (Tier 1)

Tier 1 规则拥有最高优先级，适合处理结构复杂或需要特殊保护的头部网站。你可以在 `src/core/rules/list/` 目录下创建新的 `.js` 文件来添加规则。

### 1. 域名转换 (host_replace)
适用于将短链/特定平台链接转换为标准链接（如 Twitter 转 vxtwitter）。
```javascript
export default {
    hostnames: ['x.com', 'twitter.com'], // 快速查找匹配
    patterns: [/^(www\.)?x\.com$/i],      // 正则匹配
    type: 'host_replace',
    newHost: 'fxtwitter.com',
    keepParams: [] // 显式指定为空数组，表示清空所有追踪参数
};
```

### 2. 精确清理 (param_clean)
适用于保留核心参数并删除其他所有干扰项（如淘宝商品页）。
```javascript
export default {
    hostnames: ['item.taobao.com'],
    type: 'param_clean',
    paramMap: { 'itemIds': 'id' }, // 将 itemIds 自动改名为 id
    keepParams: ['id']             // 仅保留 id 参数，其余全部删除
};
```

### 3. 内容提取 (dom_extract)
适用于需要访问网页 HTML 才能获取真实地址的中间跳转页。
```javascript
export default {
    hostnames: ['m.tb.cn'],
    type: 'dom_extract',
    // 第一个捕获组 [1] 必须是目标 URL
    selector: /var\s+url\s*=\s*['"]([^'"]+)['"]/ 
};
```

### 4. 注册规则 (重要)
创建好规则文件后，你必须在 `src/core/rules/index.js` 中手动导入并将其加入到 `rules` 数组中，否则规则不会生效：
```javascript
import myNewRule from './list/my-rule.com.js';

export const rules = [
    // ... 其他规则
    myNewRule
];
```

> **提示**：所有参数匹配（`paramMap`, `keepParams`）均不区分大小写。对于 `host_replace` 类型，若不定义 `keepParams` 则默认保留所有参数。

## 🤖 自动化部署 (GitHub Actions)

本项目已配置 GitHub Actions。当你推送到 `main` 或 `master` 分支时，会自动触发部署。

### 准备工作
在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加以下 Secrets：

1. `CF_API_TOKEN`: 你的 Cloudflare API Token (需具备 Workers 部署权限)。
2. `CF_ACCOUNT_ID`: 你的 Cloudflare 账户 ID。
3. `TG_BOT_TOKEN`: 你的 Telegram Bot Token。
4. `D1_DATABASE_ID`: 你的 D1 数据库 ID (从步骤 2 获取)。
5. `WORKERS_NAME` (Variables): 可选，自定义 Worker 名称。

## 🛠️ 技术栈
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1
- **Framework**: 原生 JS (ES Modules)
- **Data Source**: [AdGuard Tracking Filters](https://github.com/AdguardTeam/FiltersRegistry)

## 🙏 致谢

特别感谢 [AdGuard](https://adguard.com/) 提供的开源跟踪保护过滤器。本项目集成了 [AdguardTeam/FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry) 中的 `General tracking parameters list` 规则库（路径为 `filter_17_TrackParam/filter.txt`），为链接清理提供了强大的数据支持。

## 📄 开源协议

- **项目代码**: 本仓库中的逻辑代码采用 [MIT License](LICENSE) 授权。
- **规则数据**: 集成的 AdGuard 规则库遵循其原始的 [GNU GPL v3.0 License](https://github.com/AdguardTeam/AdguardFilters/blob/master/LICENSE)。

MIT.
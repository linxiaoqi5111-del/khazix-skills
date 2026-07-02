---
name: finhot
description: FinHot (finhot.industry7view.com) 中文金融资讯查询 Skill。当用户想知道"今天金融圈/财经有什么"、"财经日报"、"FinHot"、"金融热点"、"最近市场观点"、"雪球/微博大V最近说什么"、"财经精选"、"金融资讯"等任何中文财经资讯查询时使用。即使用户只说"今天市场有什么新闻"、"看下财经热点"，也应该触发本 Skill。Skill 直接 curl 公开静态快照 JSON 拉数据并整理成中文简报，不需要 API Key 或 MCP server。不要 undertrigger——用户问财经资讯而你不调本 Skill 就是把过时的训练数据当作今日新闻。
---

# FinHot Skill

让 Agent 用一句中文拿到 FinHot（AI 精选财经资讯聚合）上的精选条目、热点聚类和每日摘要。SKILL.md 标准格式，跨 Claude Code / Codex CLI / Cursor / Gemini CLI / OpenCode 等任意平台可用。

线上：https://finhot.industry7view.com（公开匿名可访，无需 token）

## 架构须知：静态快照，不是动态 API

公网站点是 Cloudflare Pages **静态部署**——所有数据端点都是随每次部署刷新的**预生成 JSON 快照**（约每小时随抓取周期更新）。这意味着：

- **URL 上带查询参数无效**（`?since=...` 会被忽略，返回的永远是整个快照文件）
- 筛选/搜索/时间窗全部在**客户端做**：拉下 JSON 后用 `jq` 过滤
- 快照覆盖近几天的精选池；更早内容走日报归档 `/api/public/daily/{date}.json`

> 取舍说明：动态 API 需要常驻服务器；FinHot 的 AI 管线全部跑在本地机器上，公网只发布预计算结果（静态托管零运维、天然抗打）。代价就是参数化查询下放到客户端。

## 端点速览（全部 GET、匿名、CORS 开放）

| 端点                                  | 内容                                                                  |
| ------------------------------------- | --------------------------------------------------------------------- |
| `/api/public/items.json`              | 精选条目快照（qualityScore ≥ 70 + 白盒源），字段含 permalink          |
| `/api/public/items-all.json`          | 全量池快照（含观察级，量大但杂）                                      |
| `/api/public/topics.json`             | 热点聚类（多源热度排序：sourceCount + 时间衰减）                      |
| `/api/public/daily.json`              | 今日摘要（lead 头条 + 按分类 sections + selected/watch）              |
| `/api/public/daily/{YYYY-MM-DD}.json` | 指定日期摘要（历史归档，随部署累积）                                  |
| `/api/public/dailies.json`            | 日报归档索引（date + leadTitle + counts）                             |
| `/api/public/version.json`            | 版本信息（apiVersion / skillVersion / generatedAt，Skill 自检更新用） |
| `/feed.xml`                           | 精选 RSS                                                              |
| `/feed/all.xml`                       | 全量 RSS                                                              |
| `/feed/daily.xml`                     | 今日摘要 RSS                                                          |

## 意图路由（第一原则：默认走精选）

| 用户在说                                               | 走的端点                                          |
| ------------------------------------------------------ | ------------------------------------------------- |
| **默认（宽问题）**："今天财经圈有什么"、"最近市场新闻" | `items.json` + jq 按 publishedAt 收时间窗         |
| **明确说"日报 / 摘要"**                                | `daily.json`；指定日期走 `daily/{date}.json`      |
| **明确说"全部 / 完整 / 所有"**                         | `items-all.json`                                  |
| "现在最热的是什么"、"在爆什么"                         | `topics.json`（按热度排序，≠最新发布）            |
| "XX公司/关键词相关"                                    | `items.json` + `jq` 在 title/summary/tags 里 grep |
| "哪些日期有日报"                                       | `dailies.json`                                    |

## 工作流

```bash
BASE="https://finhot.industry7view.com"

# 默认：最近 24 小时精选（客户端时间窗）
since=$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)
curl -s "$BASE/api/public/items.json" \
  | jq --arg s "$since" '[.items[] | select(.publishedAt >= $s)] | .[] | {title, feedTitle, publishedAt, qualityScore, permalink}'

# 热点（用户问"现在最热"）
curl -s "$BASE/api/public/topics.json" | jq '.topics[] | {title, sourceCount, qualityScore}'

# 日报（用户明确说"日报/摘要"）
curl -s "$BASE/api/public/daily.json" | jq '{date, lead: .lead.title, sections: [.sections[] | {label, n: (.items|length)}]}'

# 关键词（用户问"XX 相关"）
curl -s "$BASE/api/public/items.json" \
  | jq '[.items[] | select((.title + (.summary // "") + (.tags|join(","))) | test("光模块"))]'
```

## 版本自检（每会话一次）

本地版本 = 本文件同目录 `VERSION` 文件（安装时一并落盘）。每会话第一次调用时顺带：

```bash
curl -s "$BASE/api/public/version.json"
# → { "apiVersion": "...", "skillVersion": "X.Y.Z", "generatedAt": "..." }
```

线上 `skillVersion` 按 X.Y.Z 逐位比较**严格大于**本地 → 在最终输出末尾追加一行温和提示：

> 💡 FinHot Skill 有新版（v<skillVersion>）。重装：`curl -fsSL https://finhot.industry7view.com/finhot-skill/install.sh | bash`

本地 ≥ 线上、或端点超时/报错 → 静默跳过，绝不打断用户正事。

## 字段说明

- `recommendationReason` = 为什么值得读（选入理由）；`summary` = 内容说了什么。判断相关性用前者，理解内容用后者。
- `qualityScore` 六维打分（信息增量/深度/证据/可操作性/原创性/信号密度）加权 0-100；≥70 = 精选，40-69 = 观察。
- `permalink` = FinHot 站内详情页；`url` = 原文。引用前用 `url` 回原文核对——摘要由 LLM 生成，原文为准。

## 使用须知

- 快照约每小时刷新；`version.json` 的 `generatedAt` 是本次快照生成时间，引用时可注明数据截至时间。
- 测试版：接口可能调整，生产业务请勿强依赖。

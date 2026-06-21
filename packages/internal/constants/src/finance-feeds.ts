/**
 * Preset financial RSS feeds for FinHot.
 * Categories: 监管政策 / 产品发布 / 行业动态 / 研报 / 观点洞察
 */

export interface FinanceFeed {
  title: string
  url: string
  category: FinanceFeedCategory
  description?: string
}

export type FinanceFeedCategory = "regulatory" | "product" | "market" | "research" | "opinion"

export const FinanceFeedCategoryMap: Record<
  FinanceFeedCategory,
  { label: string; emoji: string; color: string }
> = {
  regulatory: { label: "监管政策", emoji: "🏛", color: "#6366f1" },
  product: { label: "产品发布", emoji: "📦", color: "#10b981" },
  market: { label: "行业动态", emoji: "📊", color: "#f59e0b" },
  research: { label: "研报", emoji: "📑", color: "#8b5cf6" },
  opinion: { label: "观点洞察", emoji: "💡", color: "#ec4899" },
}

export const PRESET_FINANCE_FEEDS: FinanceFeed[] = [
  // 监管政策
  {
    title: "证监会新闻",
    url: "https://rss.kael.ink/gov/csrc/news",
    category: "regulatory",
    description: "中国证监会官方新闻发布",
  },
  {
    title: "央行公告",
    url: "https://rss.kael.ink/gov/pbc/goutongjiaoliu",
    category: "regulatory",
    description: "中国人民银行沟通交流",
  },

  // 行业动态
  {
    title: "华尔街见闻",
    url: "https://rss.kael.ink/wallstreetcn/news/global",
    category: "market",
    description: "华尔街见闻全球快讯",
  },
  {
    title: "华尔街见闻热门",
    url: "https://rss.kael.ink/wallstreetcn/hot",
    category: "market",
    description: "华尔街见闻热门文章",
  },
  {
    title: "金十数据",
    url: "https://rss.kael.ink/jin10/news",
    category: "market",
    description: "金十数据快讯",
  },
  {
    title: "格隆汇",
    url: "https://rss.kael.ink/gelonghui/live",
    category: "market",
    description: "格隆汇实时资讯",
  },
  {
    title: "第一财经",
    url: "https://rss.kael.ink/yicai/news",
    category: "market",
    description: "第一财经新闻",
  },

  // 研报
  {
    title: "36氪最新",
    url: "https://rss.kael.ink/36kr/news/latest",
    category: "research",
    description: "36氪最新科技商业资讯",
  },
  {
    title: "36氪 Feed",
    url: "https://36kr.com/feed",
    category: "research",
    description: "36氪官方 RSS Feed",
  },

  // 观点洞察
  {
    title: "财新网",
    url: "https://rss.kael.ink/caixin/latest",
    category: "opinion",
    description: "财新网深度报道",
  },
]

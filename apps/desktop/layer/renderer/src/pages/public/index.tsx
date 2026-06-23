import { useCallback, useEffect, useMemo, useRef, useState } from "react"

// ─── Types ───

interface PublicFeed {
  id: string
  title: string | null
  url: string
  description: string | null
  image: string | null
  siteUrl: string | null
  category: string | null
  updatedAt: string
}

interface PublicEntry {
  id: string
  title: string | null
  url: string | null
  content: string
  description: string | null
  author: string | null
  publishedAt: string
  feedId: string
}

interface PublicEnrichment {
  summary?: string | null
  tags?: string[]
  qualityScore?: number | null
  qualityTier?: string | null
  qualityPositiveReasons?: string[]
  qualityNegativeReasons?: string[]
  qualityDimensions?: Record<string, number>
  qualityConfidence?: number
  qualitySummary?: string
}

type EnrichmentMap = Record<string, PublicEnrichment>

// ─── API helpers ───

const API_BASE = import.meta.env.VITE_PUBLIC_API_BASE ?? ""

async function fetchPublicSubscriptions(): Promise<{ feeds: PublicFeed[] }> {
  const res = await fetch(`${API_BASE}/api/public/subscriptions`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchPublicEntries(
  feedId?: string,
  limit = 30,
): Promise<{ entries: PublicEntry[] }> {
  const params = new URLSearchParams()
  if (feedId) params.set("feedId", feedId)
  params.set("limit", String(limit))
  const res = await fetch(`${API_BASE}/api/public/entries?${params}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchPublicEnrichments(): Promise<EnrichmentMap> {
  try {
    const res = await fetch(`${API_BASE}/api/public/enrichments`)
    if (!res.ok) return {}
    return res.json()
  } catch {
    return {}
  }
}

// ─── Helpers ───

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes}分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}天前`
  return new Date(dateStr).toLocaleDateString("zh-CN")
}

function stripHtml(html: string): string {
  const tmp = document.createElement("div")
  tmp.innerHTML = html
  return tmp.textContent ?? ""
}

function normalizeSummary(s: string): string {
  return s
    .replaceAll(/```[\s\S]*?```/g, " ")
    .replaceAll(/`([^`]+)`/g, "$1")
    .replaceAll(/\*\*([^*]+)\*\*/g, "$1")
    .replaceAll(/\*([^*]+)\*/g, "$1")
    .replaceAll(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replaceAll(/^\s{0,3}#{1,6}\s+/gm, "")
    .replaceAll(/^\s*[-*+]\s+/gm, "")
    .replaceAll(/\s+/g, " ")
    .trim()
}

const CAT_ORDER = ["推特", "公众号", "雪球", "微博", "其他"]

const CAT_NORMALIZE: Record<string, string> = {
  微: "微博",
  推: "推特",
  雪: "雪球",
}

function normalizeCat(cat: string): string {
  return CAT_NORMALIZE[cat] ?? cat
}

type PlatformFilter = "all" | "xueqiu" | "weibo" | "twitter" | "wechat" | "other"

const PLATFORM_TABS: { key: PlatformFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "xueqiu", label: "雪球" },
  { key: "weibo", label: "微博" },
  { key: "twitter", label: "推特" },
  { key: "wechat", label: "公众号" },
  { key: "other", label: "其他" },
]

function getPlatformForFeed(feedUrl: string, category: string | null): PlatformFilter {
  if (/xueqiu/i.test(feedUrl)) return "xueqiu"
  if (/twitter|nitter|xcancel|\/x\.com\//i.test(feedUrl)) return "twitter"
  if (/weibo/i.test(feedUrl)) return "weibo"
  if (/wechat|mp\.weixin/i.test(feedUrl)) return "wechat"
  const norm = category ? normalizeCat(category) : null
  if (norm === "雪球") return "xueqiu"
  if (norm === "推特") return "twitter"
  if (norm === "微博") return "weibo"
  if (norm === "公众号") return "wechat"
  return "other"
}

function groupByCategory(feeds: PublicFeed[]): [string, PublicFeed[]][] {
  const groups = new Map<string, PublicFeed[]>()
  for (const feed of feeds) {
    const cat = normalizeCat(feed.category ?? "其他")
    const existing = groups.get(cat)
    if (existing) existing.push(feed)
    else groups.set(cat, [feed])
  }
  return [...groups.entries()].sort((a, b) => {
    const ia = CAT_ORDER.indexOf(a[0])
    const ib = CAT_ORDER.indexOf(b[0])
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
}

function scoreTier(score: number): string {
  if (score >= 70) return "high"
  if (score >= 40) return "medium"
  if (score >= 20) return "low"
  return "ignore"
}

const TIER_CLASSES: Record<string, string> = {
  high: "border-green-500/30 bg-green-500/20 text-green-600 dark:text-green-400",
  medium: "border-yellow-500/20 bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  low: "border-neutral-400/15 bg-neutral-400/15 text-neutral-500 dark:text-neutral-400",
  ignore: "border-neutral-300/10 bg-neutral-300/10 text-neutral-400 dark:text-neutral-500",
}

const DIM_LABELS: Record<string, string> = {
  information_gain: "信息增益",
  depth: "深度",
  evidence: "论据",
  actionability: "可操作性",
  originality: "原创性",
  signal_density: "信号密度",
}

// ─── Components ───

function FeedIcon({ feed }: { feed: PublicFeed }) {
  const [error, setError] = useState(false)

  if (feed.image && !error) {
    return (
      <img
        src={feed.image}
        alt=""
        className="size-5 shrink-0 rounded"
        onError={() => setError(true)}
      />
    )
  }

  if (feed.url.startsWith("finhot://twitter/")) {
    return (
      <span className="flex size-5 shrink-0 items-center justify-center rounded bg-neutral-900 text-[10px] font-bold text-white dark:bg-neutral-100 dark:text-neutral-900">
        X
      </span>
    )
  }

  const initial = (feed.title ?? "?").charAt(0).toUpperCase()
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-neutral-200 text-[10px] font-semibold text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
      {initial}
    </span>
  )
}

function QualityScoreBadge({ enrichment }: { enrichment: PublicEnrichment }) {
  const [showTip, setShowTip] = useState(false)
  const score = enrichment.qualityScore
  if (score == null) return null

  const tier = scoreTier(score)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShowTip(true)}
      onMouseLeave={() => setShowTip(false)}
    >
      <span
        className={`inline-flex min-w-[2rem] shrink-0 items-center justify-center rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${TIER_CLASSES[tier]}`}
      >
        {score}
      </span>
      {showTip && (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-neutral-200 bg-white p-3 text-xs leading-snug shadow-lg dark:border-neutral-700 dark:bg-neutral-800">
          <div className="mb-1 font-semibold">质量分: {score}/100</div>
          {enrichment.qualityConfidence != null && (
            <div className="mb-1.5 text-neutral-500">
              置信度: {Math.round(enrichment.qualityConfidence * 100)}%
            </div>
          )}
          {enrichment.qualitySummary && (
            <p className="mb-2 text-neutral-700 dark:text-neutral-300">
              {enrichment.qualitySummary}
            </p>
          )}
          {enrichment.qualityDimensions && (
            <div className="mb-2">
              <div className="mb-1 font-medium text-neutral-500">维度评分</div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                {(
                  [
                    "information_gain",
                    "depth",
                    "evidence",
                    "actionability",
                    "originality",
                    "signal_density",
                  ] as const
                ).map((k) =>
                  enrichment.qualityDimensions?.[k] != null ? (
                    <span key={k}>
                      {DIM_LABELS[k]}: {enrichment.qualityDimensions[k]}/5
                    </span>
                  ) : null,
                )}
              </div>
            </div>
          )}
          {enrichment.qualityPositiveReasons && enrichment.qualityPositiveReasons.length > 0 && (
            <div className="mb-1.5">
              <div className="mb-0.5 font-medium text-green-600 dark:text-green-400">优点</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {enrichment.qualityPositiveReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
          {enrichment.qualityNegativeReasons && enrichment.qualityNegativeReasons.length > 0 && (
            <div>
              <div className="mb-0.5 font-medium text-orange-600 dark:text-orange-400">不足</div>
              <ul className="list-disc space-y-0.5 pl-4">
                {enrichment.qualityNegativeReasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  )
}

function EntryCard({
  entry,
  feedTitle,
  enrichment,
  isSelected,
  onSelect,
}: {
  entry: PublicEntry
  feedTitle?: string
  enrichment?: PublicEnrichment
  isSelected: boolean
  onSelect: () => void
}) {
  const snippet = useMemo(() => {
    const summary = enrichment?.summary ? normalizeSummary(enrichment.summary) : ""
    return summary || stripHtml(entry.description ?? entry.content ?? "").slice(0, 200)
  }, [entry.description, entry.content, enrichment?.summary])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect()
      }}
      className={`group cursor-pointer rounded-xl border p-4 transition-all duration-200 active:scale-[0.99] ${
        isSelected
          ? "border-blue-400/40 bg-blue-50/60 dark:border-blue-500/30 dark:bg-blue-900/15"
          : "border-neutral-200/60 bg-white/80 hover:border-neutral-300 hover:shadow-sm dark:border-neutral-700/60 dark:bg-neutral-800/80 dark:hover:border-neutral-600"
      }`}
    >
      <div className="mb-1.5 flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
        {feedTitle && <span className="font-medium">{feedTitle}</span>}
        {feedTitle && <span className="text-neutral-300 dark:text-neutral-600">·</span>}
        <span>{timeAgo(entry.publishedAt)}</span>
        {entry.author && (
          <>
            <span className="text-neutral-300 dark:text-neutral-600">·</span>
            <span>{entry.author}</span>
          </>
        )}
        <span className="flex-1" />
        {enrichment && (
          <span onClick={(e) => e.stopPropagation()}>
            <QualityScoreBadge enrichment={enrichment} />
          </span>
        )}
      </div>
      {entry.title && (
        <h3
          className={`mb-1 text-sm font-semibold leading-snug ${
            isSelected
              ? "text-blue-700 dark:text-blue-400"
              : "text-neutral-900 group-hover:text-blue-600 dark:text-neutral-100 dark:group-hover:text-blue-400"
          }`}
        >
          {entry.title}
        </h3>
      )}
      {snippet && (
        <p className="line-clamp-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
          {snippet}
        </p>
      )}
      {enrichment?.tags && enrichment.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {enrichment.tags.map((tag, i) => (
            <span
              key={i}
              className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function DetailPanel({
  entry,
  feed,
  enrichment,
  onClose,
}: {
  entry: PublicEntry
  feed?: PublicFeed
  enrichment?: PublicEnrichment
  onClose: () => void
}) {
  const summaryText = enrichment?.summary ? normalizeSummary(enrichment.summary) : ""
  const contentText = stripHtml(entry.content || entry.description || "")

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-neutral-200/60 bg-white dark:border-neutral-800/60 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-neutral-200/60 px-4 py-3 dark:border-neutral-700/60">
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-700 dark:text-neutral-300">
          {entry.title ?? "详情"}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {entry.title && (
          <h2 className="mb-3 text-[22px] font-bold leading-tight text-neutral-900 dark:text-neutral-100">
            {entry.title}
          </h2>
        )}
        <div className="mb-5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {feed?.title && <span>{feed.title}</span>}
          {feed?.title && (
            <span className="size-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          )}
          {entry.author && <span>{entry.author}</span>}
          {entry.author && (
            <span className="size-1 rounded-full bg-neutral-300 dark:bg-neutral-600" />
          )}
          <span>{timeAgo(entry.publishedAt)}</span>
        </div>

        {/* AI Summary */}
        {summaryText && (
          <div className="mb-6 overflow-hidden rounded-2xl border border-purple-200/30 bg-gradient-to-b from-purple-50/30 via-white/50 to-blue-50/20 p-5 shadow-sm dark:border-purple-800/30 dark:from-purple-950/30 dark:via-neutral-900/50 dark:to-blue-950/20">
            <div className="mb-3 flex items-center gap-2.5">
              <span className="text-base text-purple-500">✦</span>
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-[13px] font-medium text-transparent dark:from-purple-400 dark:to-blue-400">
                AI 总结
              </span>
            </div>
            <p className="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
              {summaryText}
            </p>
          </div>
        )}

        {/* Content */}
        {contentText && (
          <div className="text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            {contentText}
          </div>
        )}

        {/* Link to original */}
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:bg-blue-500/18 mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-500/10 px-3.5 py-2 text-xs font-medium text-blue-600 transition-colors dark:text-blue-400"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            查看原文
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───

export function Component() {
  const [feeds, setFeeds] = useState<PublicFeed[]>([])
  const [entries, setEntries] = useState<PublicEntry[]>([])
  const [enrichments, setEnrichments] = useState<EnrichmentMap>({})
  const [selectedFeedId, setSelectedFeedId] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const mainRef = useRef<HTMLDivElement>(null)

  // Load subscriptions + enrichments
  useEffect(() => {
    Promise.all([fetchPublicSubscriptions(), fetchPublicEnrichments()])
      .then(([{ feeds: f }, en]) => {
        setFeeds(f)
        setEnrichments(en)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  // Load entries when feed changes
  useEffect(() => {
    setEntries([])
    fetchPublicEntries(selectedFeedId ?? undefined, 50)
      .then(({ entries: e }) => setEntries(e))
      .catch(() => {})
  }, [selectedFeedId])

  const [expandedCats, setExpandedCats] = useState<Record<string, boolean>>({})
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all")
  const grouped = useMemo(() => groupByCategory(feeds), [feeds])

  const feedById = useMemo(() => {
    const map = new Map<string, PublicFeed>()
    for (const f of feeds) map.set(f.id, f)
    return map
  }, [feeds])

  const handleFeedClick = useCallback((feedId: string | null) => {
    setSelectedFeedId((prev) => (prev === feedId ? null : feedId))
    setPlatformFilter("all")
    setSelectedEntryId(null)
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [])

  const filteredEntries = useMemo(() => {
    if (platformFilter === "all") return entries
    return entries.filter((e) => {
      const feed = feedById.get(e.feedId)
      if (!feed) return false
      return getPlatformForFeed(feed.url, feed.category) === platformFilter
    })
  }, [entries, platformFilter, feedById])

  const selectedEntry = useMemo(
    () => (selectedEntryId ? entries.find((e) => e.id === selectedEntryId) : null),
    [selectedEntryId, entries],
  )

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="flex flex-col items-center gap-3">
          <div className="size-6 animate-spin rounded-full border-2 border-neutral-300 border-t-blue-500" />
          <span className="text-sm text-neutral-500">加载中...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <p className="mb-2 text-lg font-medium text-neutral-700 dark:text-neutral-300">
            暂无公开数据
          </p>
          <p className="text-sm text-neutral-500">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-72" : "w-0"} flex shrink-0 flex-col overflow-hidden border-r border-neutral-200/60 bg-white/90 backdrop-blur-xl transition-all duration-300 dark:border-neutral-800/60 dark:bg-neutral-800/90`}
      >
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-neutral-200/60 px-4 dark:border-neutral-700/60">
          <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            FinHot
          </span>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
            {feeds.length} 订阅
          </span>
        </div>

        {/* Feed list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          <button
            type="button"
            onClick={() => handleFeedClick(null)}
            className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
              selectedFeedId === null
                ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700/50"
            }`}
          >
            <span className="flex size-5 shrink-0 items-center justify-center">
              <i className="i-focal-radar size-4" />
            </span>
            <span>全部</span>
          </button>

          {grouped.map(([category, categoryFeeds]) => {
            const isExpanded = !!expandedCats[category]
            return (
              <div key={category} className="mb-0.5">
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCats((prev) => ({
                      ...prev,
                      [category]: !prev[category],
                    }))
                  }
                  className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className={`shrink-0 text-neutral-400 transition-transform duration-150 dark:text-neutral-500 ${
                      isExpanded ? "rotate-90" : ""
                    }`}
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="grow truncate text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
                    {category}
                  </span>
                  <span className="text-[10px] text-neutral-400 dark:text-neutral-500">
                    {categoryFeeds.length}
                  </span>
                </button>
                {isExpanded &&
                  categoryFeeds.map((feed) => (
                    <button
                      key={feed.id}
                      type="button"
                      onClick={() => handleFeedClick(feed.id)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                        selectedFeedId === feed.id
                          ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700/50"
                      }`}
                    >
                      <FeedIcon feed={feed} />
                      <span className="truncate">{feed.title ?? feed.url}</span>
                    </button>
                  ))}
              </div>
            )
          })}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-neutral-200/60 px-4 dark:border-neutral-800/60">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex size-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {selectedFeedId ? (feedById.get(selectedFeedId)?.title ?? "订阅") : "全部文章"}
          </h1>
          <span className="text-xs text-neutral-400">{filteredEntries.length} 条</span>
        </div>

        {/* Platform filter tabs */}
        {!selectedFeedId && (
          <div className="flex shrink-0 items-center gap-1 px-4 pb-2 pt-1">
            {PLATFORM_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setPlatformFilter(tab.key)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  platformFilter === tab.key
                    ? "border border-blue-500/30 bg-blue-500/15 font-semibold text-blue-600 dark:text-blue-400"
                    : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {/* Content split: entry list + detail panel */}
        <div className="flex min-h-0 flex-1">
          {/* Entries */}
          <div ref={mainRef} className="flex-1 overflow-y-auto p-4">
            {filteredEntries.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <p className="text-sm text-neutral-400">暂无内容</p>
              </div>
            ) : (
              <div className="mx-auto flex max-w-3xl flex-col gap-2">
                {filteredEntries.map((entry) => (
                  <EntryCard
                    key={entry.id}
                    entry={entry}
                    feedTitle={
                      selectedFeedId ? undefined : (feedById.get(entry.feedId)?.title ?? undefined)
                    }
                    enrichment={enrichments[entry.id]}
                    isSelected={selectedEntryId === entry.id}
                    onSelect={() =>
                      setSelectedEntryId((prev) => (prev === entry.id ? null : entry.id))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedEntry && (
            <div className="w-1/2 shrink-0">
              <DetailPanel
                entry={selectedEntry}
                feed={feedById.get(selectedEntry.feedId) ?? undefined}
                enrichment={enrichments[selectedEntry.id]}
                onClose={() => setSelectedEntryId(null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

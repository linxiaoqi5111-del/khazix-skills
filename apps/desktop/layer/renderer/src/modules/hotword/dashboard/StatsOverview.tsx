/**
 * Stats overview cards showing key metrics at a glance.
 */

interface StatsOverviewProps {
  totalArticles: number
  totalTerms: number
  burstCount: number
  trendingCount: number
}

export function StatsOverview({
  totalArticles,
  totalTerms,
  burstCount,
  trendingCount,
}: StatsOverviewProps) {
  const stats = [
    {
      label: "已分析文章",
      value: totalArticles,
      icon: "📰",
      color: "text-blue",
    },
    {
      label: "识别词汇",
      value: totalTerms,
      icon: "🔤",
      color: "text-purple",
    },
    {
      label: "突发热词",
      value: burstCount,
      icon: "🔥",
      color: "text-red",
    },
    {
      label: "上升趋势",
      value: trendingCount,
      icon: "📈",
      color: "text-orange",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-fill-secondary bg-fill-tertiary p-4 transition-colors duration-200 hover:bg-fill-secondary"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="text-lg">{stat.icon}</span>
            <span className="text-xs text-text-tertiary">{stat.label}</span>
          </div>
          <div className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  )
}

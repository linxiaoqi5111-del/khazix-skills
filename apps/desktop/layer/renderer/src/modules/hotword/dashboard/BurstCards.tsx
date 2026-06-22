/**
 * Burst/trending term cards with glassmorphic design.
 * Displays bursting terms prominently with score indicators.
 */

import type { TermFrequency } from "@follow/hotword"

interface BurstCardsProps {
  bursting: TermFrequency[]
  trending: TermFrequency[]
}

export function BurstCards({ bursting, trending }: BurstCardsProps) {
  if (bursting.length === 0 && trending.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-fill-secondary bg-fill-tertiary p-8">
        <p className="text-sm text-text-tertiary">暂无突发热词，持续监控中...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bursting terms */}
      {bursting.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-2 rounded-full bg-red" />
            <h3 className="text-sm font-semibold text-text">突发热词</h3>
            <span className="rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red">
              {bursting.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {bursting.map((term) => (
              <BurstCard key={term.term} term={term} variant="burst" />
            ))}
          </div>
        </div>
      )}

      {/* Trending terms */}
      {trending.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <div className="size-2 rounded-full bg-orange" />
            <h3 className="text-sm font-semibold text-text">上升趋势</h3>
            <span className="rounded-full bg-orange/10 px-2 py-0.5 text-xs font-medium text-orange">
              {trending.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {trending.map((term) => (
              <BurstCard key={term.term} term={term} variant="trending" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BurstCard({ term, variant }: { term: TermFrequency; variant: "burst" | "trending" }) {
  const isBurst = variant === "burst"

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:scale-[1.02] ${
        isBurst ? "border-red/20 bg-red/5" : "border-orange/20 bg-orange/5"
      }`}
    >
      {/* Subtle glow */}
      <div
        className="pointer-events-none absolute inset-0 rounded-xl"
        style={{
          background: isBurst
            ? "radial-gradient(ellipse at top right, rgba(230, 57, 70, 0.08), transparent 70%)"
            : "radial-gradient(ellipse at top right, rgba(255, 165, 0, 0.06), transparent 70%)",
        }}
      />

      <div className="relative">
        <div className="mb-2 flex items-start justify-between">
          <span className="text-base font-semibold text-text">{term.term}</span>
          <span
            className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${
              isBurst ? "bg-red/15 text-red" : "bg-orange/15 text-orange"
            }`}
          >
            {term.burstScore.toFixed(1)}x
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-text-secondary">
            出现 <span className="font-medium text-text">{term.count}</span> 次
          </div>
          {/* Mini bar indicator */}
          <div className="flex-1">
            <div className="h-1 overflow-hidden rounded-full bg-fill-secondary">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isBurst ? "bg-red" : "bg-orange"
                }`}
                style={{ width: `${Math.min(100, term.burstScore * 20)}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

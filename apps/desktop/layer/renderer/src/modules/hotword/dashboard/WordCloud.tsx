/**
 * Word cloud / tag cloud visualization for stable high-frequency terms.
 * Uses variable font sizes based on frequency.
 */

import type { TermFrequency } from "@follow/hotword"
import { useMemo } from "react"

interface WordCloudProps {
  terms: TermFrequency[]
  maxDisplay?: number
}

export function WordCloud({ terms, maxDisplay = 30 }: WordCloudProps) {
  const displayTerms = useMemo(() => {
    const sorted = [...terms].sort((a, b) => b.count - a.count).slice(0, maxDisplay)
    if (sorted.length === 0) return []

    const maxCount = sorted[0]!.count
    const minCount = sorted.at(-1)!.count
    const range = maxCount - minCount || 1

    return sorted.map((term) => {
      // Map count to font size (12px - 28px)
      const normalizedSize = (term.count - minCount) / range
      const fontSize = 12 + normalizedSize * 16
      // Map to opacity (0.5 - 1.0)
      const opacity = 0.5 + normalizedSize * 0.5

      return {
        ...term,
        fontSize,
        opacity,
      }
    })
  }, [terms, maxDisplay])

  if (displayTerms.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-fill-secondary bg-fill-tertiary p-8">
        <p className="text-sm text-text-tertiary">暂无稳定热词数据...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 rounded-xl border border-fill-secondary bg-fill-tertiary p-6">
      {displayTerms.map((term) => (
        <span
          key={term.term}
          className="cursor-default rounded-md px-2 py-1 text-text transition-all duration-200 hover:bg-fill-secondary"
          style={{
            fontSize: `${term.fontSize}px`,
            opacity: term.opacity,
            fontWeight: term.fontSize > 20 ? 600 : 400,
          }}
          title={`${term.term}: ${term.count} 次 | 突发指数 ${term.burstScore.toFixed(1)}`}
        >
          {term.term}
        </span>
      ))}
    </div>
  )
}

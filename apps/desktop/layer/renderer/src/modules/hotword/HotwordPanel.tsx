/**
 * Hotword radar panel — shows trending financial terms.
 * Displays as a collapsible sidebar section or standalone panel.
 */

import type { TermFrequency } from "@follow/hotword"
import { useAtomValue } from "jotai"

import { burstingTermsAtom, hotwordSnapshotAtom, topTermsAtom } from "./store"

const panelStyles: Record<string, React.CSSProperties> = {
  container: {
    padding: "12px 16px",
    borderRadius: 8,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 11,
    padding: "2px 6px",
    borderRadius: 4,
    fontWeight: 500,
  },
  termList: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: 6,
  },
  termTag: {
    fontSize: 12,
    padding: "4px 8px",
    borderRadius: 4,
    cursor: "pointer",
    transition: "opacity 0.15s",
    lineHeight: 1.4,
  },
  empty: {
    fontSize: 12,
    textAlign: "center" as const,
    padding: "20px 0",
    opacity: 0.6,
  },
}

function TermTag({ term }: { term: TermFrequency }) {
  const { isBurst } = term

  return (
    <span
      className={
        isBurst
          ? "border border-red/20 bg-red/10 text-red"
          : "border border-transparent bg-fill-secondary text-text-secondary"
      }
      style={panelStyles.termTag}
      title={`出现 ${term.count} 次 | 突发指数 ${term.burstScore.toFixed(1)}`}
    >
      {term.term}
      {isBurst && (
        <span className="ml-1 text-red" style={{ fontSize: 10 }}>
          {term.burstScore.toFixed(1)}x
        </span>
      )}
    </span>
  )
}

export function HotwordPanel() {
  const snapshot = useAtomValue(hotwordSnapshotAtom)
  const burstTerms = useAtomValue(burstingTermsAtom)
  const topTerms = useAtomValue(topTermsAtom)

  if (!snapshot || snapshot.terms.length === 0) {
    return (
      <div className="bg-fill-tertiary" style={panelStyles.container}>
        <div style={panelStyles.header}>
          <span className="text-text" style={panelStyles.title}>
            热词雷达
          </span>
        </div>
        <div className="text-text-tertiary" style={panelStyles.empty}>
          正在收集数据，订阅更多信息源以获取热词...
        </div>
      </div>
    )
  }

  return (
    <div className="bg-fill-tertiary" style={panelStyles.container}>
      <div style={panelStyles.header}>
        <span className="text-text" style={panelStyles.title}>
          热词雷达
        </span>
        {burstTerms.length > 0 && (
          <span className="bg-red/15 text-red" style={panelStyles.badge}>
            {burstTerms.length} 突发
          </span>
        )}
      </div>

      {burstTerms.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div
            className="text-text-secondary"
            style={{ fontSize: 11, marginBottom: 6, fontWeight: 500 }}
          >
            突发热词
          </div>
          <div style={panelStyles.termList}>
            {burstTerms.map((t) => (
              <TermTag key={t.term} term={t} />
            ))}
          </div>
        </div>
      )}

      <div>
        <div
          className="text-text-secondary"
          style={{ fontSize: 11, marginBottom: 6, fontWeight: 500 }}
        >
          高频词
        </div>
        <div style={panelStyles.termList}>
          {topTerms.slice(0, 15).map((t) => (
            <TermTag key={t.term} term={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Hotword radar panel — shows trending financial terms.
 * Displays as a collapsible sidebar section or standalone panel.
 * Terms are gated by the admission scoring system; right-click to
 * blacklist / whitelist individual terms.
 */

import type { TermFrequency } from "@follow/hotword"
import { useAtomValue, useSetAtom } from "jotai"
import { useCallback, useState } from "react"
import { useNavigate } from "react-router"

import {
  blacklistAtom,
  burstingTermsAtom,
  hotwordSnapshotAtom,
  topTermsAtom,
  whitelistAtom,
} from "./store"

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
    position: "relative" as const,
  },
  empty: {
    fontSize: 12,
    textAlign: "center" as const,
    padding: "20px 0",
    opacity: 0.6,
  },
}

function TermTag({
  term,
  onBlock,
  onWhitelist,
}: {
  term: TermFrequency
  onBlock: (t: string) => void
  onWhitelist: (t: string) => void
}) {
  const { isBurst, admissionScore } = term
  const [showMenu, setShowMenu] = useState(false)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu((v) => !v)
  }, [])

  const scoreLabel = admissionScore != null ? ` | 准入分 ${admissionScore.toFixed(0)}` : ""

  return (
    <span
      className={
        isBurst
          ? "border border-red/20 bg-red/10 text-red"
          : "border border-transparent bg-fill-secondary text-text-secondary"
      }
      style={panelStyles.termTag}
      title={`出现 ${term.count} 次 | 突发指数 ${term.burstScore.toFixed(1)}${scoreLabel}`}
      onContextMenu={handleContextMenu}
    >
      {term.term}
      {isBurst && (
        <span className="ml-1 text-red" style={{ fontSize: 10 }}>
          {term.burstScore.toFixed(1)}x
        </span>
      )}
      {showMenu && (
        <span
          className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-0.5 rounded-md border border-fill-secondary bg-popover p-1 shadow-lg"
          style={{ minWidth: 100, fontSize: 11 }}
        >
          <button
            type="button"
            className="rounded px-2 py-1 text-left text-text-secondary transition-colors hover:bg-fill-secondary"
            onClick={(e) => {
              e.stopPropagation()
              onBlock(term.term)
              setShowMenu(false)
            }}
          >
            屏蔽此词
          </button>
          <button
            type="button"
            className="rounded px-2 py-1 text-left text-text-secondary transition-colors hover:bg-fill-secondary"
            onClick={(e) => {
              e.stopPropagation()
              onWhitelist(term.term)
              setShowMenu(false)
            }}
          >
            加入白名单
          </button>
        </span>
      )}
    </span>
  )
}

export function HotwordPanel() {
  const navigate = useNavigate()
  const snapshot = useAtomValue(hotwordSnapshotAtom)
  const burstTerms = useAtomValue(burstingTermsAtom)
  const topTerms = useAtomValue(topTermsAtom)
  const dispatchBlacklist = useSetAtom(blacklistAtom)
  const dispatchWhitelist = useSetAtom(whitelistAtom)

  const handleBlock = useCallback(
    (term: string) => dispatchBlacklist({ type: "add", term }),
    [dispatchBlacklist],
  )
  const handleWhitelist = useCallback(
    (term: string) => dispatchWhitelist({ type: "add", term }),
    [dispatchWhitelist],
  )

  const openDashboard = () => {
    navigate("/hotword")
  }

  if (!snapshot || snapshot.terms.length === 0) {
    return (
      <div className="bg-fill-tertiary" style={panelStyles.container}>
        <div style={panelStyles.header}>
          <button
            type="button"
            onClick={openDashboard}
            className="text-text transition-opacity hover:opacity-70"
            style={panelStyles.title}
          >
            热词雷达 →
          </button>
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
        <button
          type="button"
          onClick={openDashboard}
          className="text-text transition-opacity hover:opacity-70"
          style={panelStyles.title}
        >
          热词雷达 →
        </button>
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
              <TermTag key={t.term} term={t} onBlock={handleBlock} onWhitelist={handleWhitelist} />
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
            <TermTag key={t.term} term={t} onBlock={handleBlock} onWhitelist={handleWhitelist} />
          ))}
        </div>
      </div>
    </div>
  )
}

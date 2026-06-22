/**
 * Hotword engine singleton + Jotai atoms for reactive UI state.
 */

import type { HotwordSnapshot, TermFrequency, TermTimeSeries } from "@follow/hotword"
import { HotwordEngine } from "@follow/hotword"
import { atom } from "jotai"

/** Singleton engine instance */
const engine = new HotwordEngine({
  windowMinutes: 60,
  baselineWindows: 24,
  burstThreshold: 3,
  minCount: 2,
  maxTerms: 50,
})

export function getHotwordEngine(): HotwordEngine {
  return engine
}

/** Current hotword snapshot atom (refreshed periodically) */
export const hotwordSnapshotAtom = atom<HotwordSnapshot | null>(null)

/** Bursting terms only */
export const burstingTermsAtom = atom<TermFrequency[]>((get) => {
  const snapshot = get(hotwordSnapshotAtom)
  if (!snapshot) return []
  return snapshot.terms.filter((t) => t.isBurst)
})

/** Top terms sorted by count */
export const topTermsAtom = atom<TermFrequency[]>((get) => {
  const snapshot = get(hotwordSnapshotAtom)
  if (!snapshot) return []
  return [...snapshot.terms].sort((a, b) => b.count - a.count).slice(0, 20)
})

/** Engine stats atom */
export const hotwordStatsAtom = atom(() => {
  return engine.getStats()
})

/** Time-series data for trend chart (refreshed with snapshot) */
export const hotwordTimeSeriesAtom = atom<TermTimeSeries[]>((get) => {
  // Depend on snapshot to auto-refresh
  get(hotwordSnapshotAtom)
  return engine.getTimeSeries(8)
})

/** Dashboard grouped data atom */
export const hotwordDashboardAtom = atom((get) => {
  get(hotwordSnapshotAtom)
  return engine.getDashboardData()
})

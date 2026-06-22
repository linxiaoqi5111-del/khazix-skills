/**
 * Hotword engine singleton + Jotai atoms for reactive UI state.
 * Includes blacklist / whitelist persistence via localStorage.
 */

import type { HotwordSnapshot, TermFrequency, TermTimeSeries } from "@follow/hotword"
import {
  addToBlacklist,
  addToWhitelist,
  getBlacklist,
  getRegistryStats,
  getWhitelist,
  HotwordEngine,
  removeFromBlacklist,
  removeFromWhitelist,
  setBlacklist,
  setWhitelist,
} from "@follow/hotword"
import { atom } from "jotai"

// ---------------------------------------------------------------------------
// LocalStorage keys
// ---------------------------------------------------------------------------

const LS_BLACKLIST = "hotword:blacklist"
const LS_WHITELIST = "hotword:whitelist"

function loadList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function saveList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list))
  } catch {
    /* quota exceeded — silent */
  }
}

// Hydrate blacklist / whitelist from localStorage on module load
setBlacklist(loadList(LS_BLACKLIST))
setWhitelist(loadList(LS_WHITELIST))

// ---------------------------------------------------------------------------
// Engine singleton
// ---------------------------------------------------------------------------

const engine = new HotwordEngine({
  windowMinutes: 60,
  baselineWindows: 24,
  burstThreshold: 3,
  minCount: 2,
  maxTerms: 50,
  admissionThreshold: 2,
})

export function getHotwordEngine(): HotwordEngine {
  return engine
}

// ---------------------------------------------------------------------------
// Snapshot atoms
// ---------------------------------------------------------------------------

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
  get(hotwordSnapshotAtom)
  return engine.getTimeSeries(8)
})

/** Dashboard grouped data atom */
export const hotwordDashboardAtom = atom((get) => {
  get(hotwordSnapshotAtom)
  return engine.getDashboardData()
})

// ---------------------------------------------------------------------------
// Blacklist / whitelist atoms (reactive)
// ---------------------------------------------------------------------------

/** Trigger atom: bump to force re-read of blacklist/whitelist */
const filterVersionAtom = atom(0)

export const blacklistAtom = atom(
  (get) => {
    get(filterVersionAtom)
    return getBlacklist()
  },
  (_get, set, action: { type: "add" | "remove"; term: string }) => {
    if (action.type === "add") addToBlacklist(action.term)
    else removeFromBlacklist(action.term)
    saveList(LS_BLACKLIST, getBlacklist())
    saveList(LS_WHITELIST, getWhitelist())
    set(filterVersionAtom, (v) => v + 1)
  },
)

export const whitelistAtom = atom(
  (get) => {
    get(filterVersionAtom)
    return getWhitelist()
  },
  (_get, set, action: { type: "add" | "remove"; term: string }) => {
    if (action.type === "add") addToWhitelist(action.term)
    else removeFromWhitelist(action.term)
    saveList(LS_WHITELIST, getWhitelist())
    saveList(LS_BLACKLIST, getBlacklist())
    set(filterVersionAtom, (v) => v + 1)
  },
)

/** Registry stats atom */
export const registryStatsAtom = atom((get) => {
  get(filterVersionAtom)
  return getRegistryStats()
})

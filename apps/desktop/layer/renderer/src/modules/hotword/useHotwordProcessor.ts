/**
 * Hook that processes new entries through the hotword engine
 * and periodically refreshes the snapshot atom.
 */

import { useSetAtom } from "jotai"
import { useCallback, useEffect, useRef } from "react"

import { getHotwordEngine, hotwordSnapshotAtom } from "./store"

/** Refresh interval for hotword snapshot (ms) */
const REFRESH_INTERVAL = 30_000

/**
 * Processes entries through the hotword engine.
 * Call this hook once at the app layout level.
 */
export function useHotwordProcessor() {
  const setSnapshot = useSetAtom(hotwordSnapshotAtom)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refreshSnapshot = useCallback(() => {
    const engine = getHotwordEngine()
    const snapshot = engine.getSnapshot()
    setSnapshot(snapshot)
  }, [setSnapshot])

  // Set up periodic refresh
  useEffect(() => {
    // Initial snapshot
    refreshSnapshot()

    intervalRef.current = setInterval(refreshSnapshot, REFRESH_INTERVAL)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refreshSnapshot])

  /** Process a batch of entries (call after feed refresh) */
  const processEntries = useCallback(
    (
      entries: Array<{
        id: string
        title: string | null
        description: string | null
        content: string | null
      }>,
    ) => {
      const engine = getHotwordEngine()
      for (const entry of entries) {
        engine.processEntry(entry.id, entry.title, entry.description, entry.content)
      }
      // Refresh immediately after processing
      refreshSnapshot()
    },
    [refreshSnapshot],
  )

  return { processEntries, refreshSnapshot }
}

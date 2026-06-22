/**
 * Hook that processes new entries through the hotword engine.
 * Refreshes snapshot only when new entries arrive (event-driven, not polling).
 */

import { useSetAtom } from "jotai"
import { useCallback, useEffect } from "react"

import { getHotwordEngine, hotwordSnapshotAtom } from "./store"

/**
 * Processes entries through the hotword engine.
 * Call this hook once at the app layout level.
 * Snapshot updates are event-driven: refresh only when feed data arrives.
 */
export function useHotwordProcessor() {
  const setSnapshot = useSetAtom(hotwordSnapshotAtom)

  const refreshSnapshot = useCallback(() => {
    const engine = getHotwordEngine()
    const snapshot = engine.getSnapshot()
    setSnapshot(snapshot)
  }, [setSnapshot])

  // Initial snapshot on mount
  useEffect(() => {
    refreshSnapshot()
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
      // Refresh immediately after processing new entries
      refreshSnapshot()
    },
    [refreshSnapshot],
  )

  return { processEntries, refreshSnapshot }
}

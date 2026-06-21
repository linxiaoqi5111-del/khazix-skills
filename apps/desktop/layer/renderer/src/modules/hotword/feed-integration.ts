/**
 * Integration layer that connects RSS feed refreshes to the hotword engine.
 * Listens for new entries and processes them through the segmenter.
 */

import { getHotwordEngine } from "./store"

export interface EntryForHotword {
  id: string
  title: string | null
  description: string | null
  content: string | null
}

/**
 * Process a batch of entries through the hotword engine.
 * Call this after a feed refresh completes.
 */
export function processEntriesForHotwords(entries: EntryForHotword[]): void {
  const engine = getHotwordEngine()
  for (const entry of entries) {
    engine.processEntry(entry.id, entry.title, entry.description, entry.content)
  }
}

/**
 * Process all entries currently in the entry store.
 * Call this once at startup to seed the hotword engine with existing data.
 */
export function seedHotwordsFromStore(
  entries: Array<{
    id: string
    title?: string | null
    description?: string | null
    content?: string | null
  }>,
): void {
  const engine = getHotwordEngine()
  for (const entry of entries) {
    engine.processEntry(
      entry.id,
      entry.title ?? null,
      entry.description ?? null,
      entry.content ?? null,
    )
  }
}

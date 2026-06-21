/**
 * Integration layer that connects RSS feed refreshes to the hotword engine.
 * Listens for new entries and processes them through the segmenter.
 *
 * Includes a Defuddle/Jina content enrichment pipeline:
 * When entry content is too short (<100 chars), attempts to fetch full text
 * via defuddle.md or r.jina.ai to improve hotword extraction quality.
 */

import { getHotwordEngine } from "./store"

export interface EntryForHotword {
  id: string
  title: string | null
  description: string | null
  content: string | null
  url?: string | null
}

/** Minimum content length before we attempt enrichment */
const MIN_CONTENT_LENGTH = 100

/**
 * Attempt to enrich short content via Defuddle (primary) or Jina (fallback).
 * Non-blocking — silently returns original content on failure.
 */
async function enrichContent(entry: EntryForHotword): Promise<string | null> {
  const existingContent = [entry.title, entry.description, entry.content].filter(Boolean).join(" ")

  // Skip enrichment if content is already sufficient or no URL
  if (existingContent.length >= MIN_CONTENT_LENGTH || !entry.url) {
    return null
  }

  try {
    // Try Defuddle first
    const res = await fetch("/api/defuddle/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: entry.url }),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.content && data.content.length > existingContent.length) {
        return data.content
      }
    }
  } catch {
    // Defuddle failed, try Jina
    try {
      const res = await fetch("/api/jina/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: entry.url }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.content && data.content.length > existingContent.length) {
          return data.content
        }
      }
    } catch {
      // Both failed, skip enrichment
    }
  }

  return null
}

/**
 * Process a batch of entries through the hotword engine.
 * Call this after a feed refresh completes.
 * Attempts content enrichment for short entries in background.
 */
export function processEntriesForHotwords(entries: EntryForHotword[]): void {
  const engine = getHotwordEngine()
  for (const entry of entries) {
    engine.processEntry(entry.id, entry.title, entry.description, entry.content)
  }

  // Background enrichment for short-content entries (non-blocking)
  const shortEntries = entries.filter((e) => {
    const len = [e.title, e.description, e.content].filter(Boolean).join(" ").length
    return len < MIN_CONTENT_LENGTH && e.url
  })

  if (shortEntries.length > 0) {
    // Process enrichment in background, max 5 at a time
    const batch = shortEntries.slice(0, 5)
    Promise.allSettled(
      batch.map(async (entry) => {
        const enriched = await enrichContent(entry)
        if (enriched) {
          // Re-process with enriched content (engine deduplicates by ID,
          // so we use a suffixed ID for the enriched version)
          engine.processEntry(`${entry.id}:enriched`, entry.title, enriched, null)
        }
      }),
    )
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

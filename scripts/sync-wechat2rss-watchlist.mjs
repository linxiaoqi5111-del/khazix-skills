#!/usr/bin/env node
/**
 * Sync subscribed WeChat public accounts from a self-hosted wechat2rss service
 * into `finhot/watchlist.json` so the collector / public reader picks them up.
 *
 * wechat2rss exposes `GET /list?k=<RSS_TOKEN>` returning `{ data: [{ id, name,
 * link }], meta: { total } }`. Each account maps to a `{ name, url }` entry in
 * the watchlist `wechat` array, with `url = <endpoint>/feed/<id>.xml`.
 *
 * Behaviour:
 *  - Only the `wechat` category is touched; other categories are left intact.
 *  - Existing plain-string entries (public-library 公众号) are preserved as-is.
 *  - Dedup is keyed by the numeric feed id; accounts already present (by id)
 *    are skipped, so the file is only ever appended to.
 *  - `--dry-run` prints the planned additions without writing.
 *
 * Env:
 *  - RSS_TOKEN (or WECHAT2RSS_RSS_TOKEN) — required, the wechat2rss token.
 *  - WECHAT2RSS_ENDPOINT — optional, defaults to http://localhost:8090.
 *
 * Usage:
 *   node scripts/sync-wechat2rss-watchlist.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const DRY_RUN = process.argv.includes("--dry-run")
const TOKEN = (process.env.RSS_TOKEN || process.env.WECHAT2RSS_RSS_TOKEN || "").trim()
const ENDPOINT = (process.env.WECHAT2RSS_ENDPOINT || "http://localhost:8090").replace(/\/+$/, "")
const PAGE_SIZE = 100

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const watchlistPath = join(repoRoot, "finhot", "watchlist.json")

const FEED_ID_RE = /\/feed\/(\d+)\.xml/

function feedIdFromUrl(url) {
  const m = typeof url === "string" ? url.match(FEED_ID_RE) : null
  return m ? m[1] : null
}

async function fetchAllAccounts() {
  const accounts = []
  for (let page = 1; ; page++) {
    const url = `${ENDPOINT}/list?page=${page}&size=${PAGE_SIZE}&k=${encodeURIComponent(TOKEN)}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`wechat2rss /list HTTP ${res.status}`)
    const json = await res.json()
    if (json.err) throw new Error(`wechat2rss error: ${json.err}`)
    const batch = Array.isArray(json.data) ? json.data : []
    accounts.push(...batch)
    const total = json.meta?.total
    if (batch.length < PAGE_SIZE || (typeof total === "number" && accounts.length >= total)) break
  }
  return accounts
}

async function main() {
  if (!TOKEN) {
    console.error("RSS_TOKEN (or WECHAT2RSS_RSS_TOKEN) is required.")
    process.exit(2)
  }

  const data = JSON.parse(readFileSync(watchlistPath, "utf-8"))
  const wechat = Array.isArray(data.wechat) ? data.wechat : []

  // Dedup keys: by feed id (from object urls) and by name (covers plain-string
  // public-library entries that have no feed id but would otherwise duplicate a
  // self-hosted account with the same 公众号 name).
  const existingIds = new Set()
  const existingNames = new Set()
  for (const entry of wechat) {
    if (typeof entry === "string") {
      existingNames.add(entry.trim())
    } else if (entry && typeof entry === "object") {
      const id = feedIdFromUrl(entry.url)
      if (id) existingIds.add(id)
      if (entry.name) existingNames.add(String(entry.name).trim())
    }
  }

  const accounts = await fetchAllAccounts()
  const additions = []
  const seen = new Set()
  for (const acc of accounts) {
    const id = String(acc.id ?? "").trim()
    const name = String(acc.name ?? id).trim()
    if (!id || existingIds.has(id) || existingNames.has(name) || seen.has(id)) continue
    seen.add(id)
    additions.push({ name, url: `${ENDPOINT}/feed/${id}.xml` })
  }

  console.info(
    `wechat2rss: ${accounts.length} subscribed | watchlist wechat: ${wechat.length} | new: ${additions.length}`,
  )
  for (const a of additions) console.info(`  + ${a.name}  ${a.url}`)

  if (additions.length === 0) {
    console.info("Nothing to add.")
    return
  }
  if (DRY_RUN) {
    console.info("(dry-run) watchlist.json not modified.")
    return
  }

  data.wechat = [...wechat, ...additions]
  writeFileSync(watchlistPath, `${JSON.stringify(data, null, 2)}\n`, "utf-8")
  console.info(`Wrote ${additions.length} new account(s) to ${watchlistPath}`)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

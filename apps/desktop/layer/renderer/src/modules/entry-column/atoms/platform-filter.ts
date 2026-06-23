import { atom, useAtomValue, useSetAtom } from "jotai"

export type PlatformFilter = "all" | "xueqiu" | "weibo" | "twitter" | "wechat" | "other"

export const platformFilterAtom = atom<PlatformFilter>("all")

export const usePlatformFilter = () => useAtomValue(platformFilterAtom)
export const useSetPlatformFilter = () => useSetAtom(platformFilterAtom)

export const PLATFORM_LABELS: Record<PlatformFilter, string> = {
  all: "全部",
  xueqiu: "雪球",
  weibo: "微博",
  twitter: "推特",
  wechat: "公众号",
  other: "其他",
}

/**
 * Determine which platform a feed URL belongs to.
 */
export function getPlatformFromFeedUrl(feedUrl: string | undefined | null): PlatformFilter {
  if (!feedUrl) return "other"

  if (/^finhot:\/\/xueqiu\//.test(feedUrl)) return "xueqiu"
  if (/^finhot:\/\/twitter\//.test(feedUrl)) return "twitter"
  if (/\/weibo\//.test(feedUrl)) return "weibo"
  if (/wechat|mp\.weixin/.test(feedUrl)) return "wechat"

  return "other"
}

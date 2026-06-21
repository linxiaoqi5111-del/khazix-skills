/**
 * Chinese text segmentation using Intl.Segmenter + financial domain dictionary.
 * Falls back to simple n-gram extraction if Intl.Segmenter is unavailable.
 */

const CJK_RANGE = /[\u4e00-\u9fff]/
const CJK_RUN = /[\u4e00-\u9fff]+/g
const LATIN_TOKEN = /[A-Za-z\u03b1-\u03c9][A-Za-z0-9\u03b1-\u03c9\-+]{1,14}/g
const SPLIT_PATTERN = /[^\u4e00-\u9fffA-Za-z0-9\u03b1-\u03c9\u0391-\u03a9+]+/

/** Financial domain compound terms that segmenters often split incorrectly */
export const FINANCE_DICTIONARY: string[] = [
  // Market structure
  "涨停板",
  "跌停板",
  "涨停",
  "跌停",
  "封板",
  "炸板",
  "连板",
  "断板",
  "打板",
  "排板",
  "首板",
  "二板",
  "三板",
  "高标",
  // Trading
  "主力资金",
  "北向资金",
  "融资融券",
  "大宗交易",
  "龙虎榜",
  "成交额",
  "成交量",
  "换手率",
  "市盈率",
  "市净率",
  // Policy / Regulatory
  "证监会",
  "央行",
  "银保监",
  "金融监管",
  "货币政策",
  "降准",
  "降息",
  "加息",
  "逆回购",
  "MLF",
  "LPR",
  "注册制",
  "退市",
  "转融通",
  "量化交易",
  // Sectors
  "人工智能",
  "大模型",
  "算力",
  "芯片",
  "半导体",
  "新能源",
  "光伏",
  "储能",
  "锂电池",
  "固态电池",
  "机器人",
  "无人驾驶",
  "自动驾驶",
  "智能驾驶",
  "军工",
  "航天",
  "卫星",
  "低空经济",
  "医药",
  "创新药",
  "中药",
  "医疗器械",
  "消费",
  "白酒",
  "食品饮料",
  "房地产",
  "基建",
  "水泥",
  // Common financial terms
  "利好",
  "利空",
  "高开",
  "低开",
  "放量",
  "缩量",
  "突破",
  "回调",
  "反弹",
  "震荡",
  "横盘",
  "牛市",
  "熊市",
  "慢牛",
  "快牛",
  "题材",
  "概念",
  "板块",
  "赛道",
  "风口",
  "龙头",
  "妖股",
  "核心资产",
  "预期差",
  "超预期",
  "不及预期",
  "业绩",
  "营收",
  "净利润",
  "毛利率",
]

/** Stopwords to filter out from results */
const STOPWORDS = new Set([
  "公司",
  "市场",
  "美元",
  "亿元",
  "万元",
  "同比",
  "环比",
  "增长",
  "下降",
  "上涨",
  "下跌",
  "报道",
  "消息",
  "记者",
  "表示",
  "认为",
  "指出",
  "预计",
  "预期",
  "目前",
  "已经",
  "今日",
  "昨日",
  "今天",
  "昨天",
  "近日",
  "日前",
  "中国",
  "美国",
  "全球",
  "国内",
  "国际",
  "相关",
  "进一步",
  "方面",
  "人民币",
  "港股",
  "美股",
  "发布",
  "公告",
  "披露",
  "数据",
  "显示",
  "可能",
  "或将",
  "以及",
  "对于",
  "关于",
  "通过",
  "进行",
  "情况",
  "问题",
  "工作",
  "项目",
  "我们",
  "他们",
  "有限",
  "集团",
  "股份",
  "上市",
  "正式",
  "成功",
  "收购",
  "合作",
  "投资",
  "基金",
  "证券",
  "银行",
  "保险",
])

const GENERIC_LATIN = new Set([
  "https",
  "http",
  "www",
  "com",
  "html",
  "api",
  "app",
  "ceo",
  "cfo",
  "cto",
  "ipo",
  "gdp",
  "cpi",
  "ppi",
  "pmi",
  "the",
  "and",
  "for",
  "that",
  "this",
  "with",
  "from",
])

let segmenter: Intl.Segmenter | null = null

function getSegmenter(): Intl.Segmenter | null {
  if (segmenter) return segmenter
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" })
    return segmenter
  }
  return null
}

/** Extract n-grams from a Chinese character run (fallback when no segmenter) */
function extractNgrams(run: string, lo = 2, hi = 4): string[] {
  const results: string[] = []
  for (let n = lo; n <= hi; n++) {
    for (let i = 0; i <= run.length - n; i++) {
      results.push(run.slice(i, i + n))
    }
  }
  return results
}

/** Check if a term matches any dictionary entry (for compound term detection) */
function matchDictionary(text: string): string[] {
  const matches: string[] = []
  for (const term of FINANCE_DICTIONARY) {
    if (text.includes(term)) {
      matches.push(term)
    }
  }
  return matches
}

export interface SegmentResult {
  terms: string[]
  dictionaryMatches: string[]
}

/**
 * Segment text and extract candidate hotword terms.
 * Returns de-duplicated terms of length >= 2.
 */
export function segmentText(text: string): SegmentResult {
  const terms = new Set<string>()
  const dictionaryMatches: string[] = []

  // First pass: extract dictionary compound terms
  const dictMatches = matchDictionary(text)
  for (const match of dictMatches) {
    terms.add(match)
    dictionaryMatches.push(match)
  }

  // Split text into segments
  const segments = text.split(SPLIT_PATTERN)

  for (const seg of segments) {
    if (!seg) continue

    // Extract Latin tokens (ETF, REITS, AI, etc.)
    for (const match of seg.matchAll(LATIN_TOKEN)) {
      const tok = match[0]
      if (tok.length < 2) continue
      const lower = tok.toLowerCase()
      if (GENERIC_LATIN.has(lower)) continue
      if (/^\d+$/.test(tok)) continue
      // Uppercase short abbreviations
      const normalized = tok.length <= 6 && /^[a-z]+$/i.test(tok) ? tok.toUpperCase() : tok
      terms.add(normalized)
    }

    // Extract Chinese terms
    const cjkRuns = seg.match(CJK_RUN)
    if (!cjkRuns) continue

    for (const run of cjkRuns) {
      const seg2 = getSegmenter()
      if (seg2) {
        // Use Intl.Segmenter for word-level segmentation
        for (const { segment, isWordLike } of seg2.segment(run)) {
          if (isWordLike && segment.length >= 2 && CJK_RANGE.test(segment)) {
            terms.add(segment)
          }
        }
      } else {
        // Fallback: n-gram extraction
        for (const ngram of extractNgrams(run)) {
          terms.add(ngram)
        }
      }
    }
  }

  // Filter stopwords
  const filtered = [...terms].filter((t) => !STOPWORDS.has(t))

  return { terms: filtered, dictionaryMatches }
}

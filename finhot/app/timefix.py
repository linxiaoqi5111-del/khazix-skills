"""时间保真：解决 RSS/快讯源时间戳不可信导致的"假爆词"问题。

背景：很多 feed 给出的 pubDate 不是文章实际发布时间，而是"被抓取/再发布到本站"
的时间；缺失时间时旧代码又一律回退到 now()。这会把历史/陈旧内容一股脑塞进"今天"，
污染突发检测（今日量 ÷ 过去 N 天基线）。

策略：以 finhot 自己首次入库的时间 first_seen 为可信锚点，按可信度决定用于"归日/突发"
的 effective_ts：
  1) 源被显式标记 trust_ts=false（如已知会篡改时间的 feed）→ 锚定 first_seen；
  2) 缺失时间（ts<=0，由 sources/watchlist 改用 0 作为"无可信时间"哨兵）→ 锚定 first_seen；
  3) 未来时间（明显超过 now，留少量时钟漂移容差）→ 钳回 first_seen；
  4) 其余（含真实的过去时间）→ 信任原始时间，按其真实日期归日。

说明：真实的过去时间按"真实日期"归日，因此新订阅源首轮回灌的历史条目会被分散到各自
的历史日期、并由新鲜度因子（见 scoring.py）压低分值，而不会在"今天"形成假突发。
"""


def resolve_time(raw_ts, now, *, trust_ts=True, future_skew_hours=2):
    """返回 (display_ts, effective_ts, ts_trusted)。

    - display_ts：用于前端展示的时间（可信原始时间，否则用 first_seen=now）；
    - effective_ts：用于归日（day_of）与突发统计的有效时间；
    - ts_trusted：1=采用了源给的时间，0=回退到 first_seen / 被钳回。

    调用方应把 first_seen 记为 now。
    """
    first_seen = now
    try:
        raw = int(raw_ts or 0)
    except (TypeError, ValueError):
        raw = 0
    if not trust_ts or raw <= 0:
        return first_seen, first_seen, 0
    if raw > now + int(future_skew_hours * 3600):
        return first_seen, first_seen, 0
    return raw, raw, 1

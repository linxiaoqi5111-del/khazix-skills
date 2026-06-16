"""采集入口：抓取所有源 -> 入库前时间保真/去重/打分 -> 重算当日词频。

用法:
    python -m app.collector            # 抓一次
    python -m app.collector --loop 30  # 每30分钟抓一次

入库管线（Phase 1）：
    fetch_all + fetch_watchlist
      -> 按 (信源 tier, 时间) 排序（高 tier、早发布者优先当去重代表）
      -> timefix.resolve_time（缺失/未来/不可信时间锚定 first_seen）
      -> dedup（跨源近重复 -> dup_group）
      -> scoring.score_item（四因子 -> admitted）
      -> 写入 items（含 first_seen/effective_ts/score/admitted/dup_group）
      -> recount_day 只统计 admitted=1 的条目
"""
import argparse
import datetime
import json
import sys
import time

from . import db, dedup, scoring, timefix
from .events import build_events, source_tier
from .sources import fetch_all
from .terms import count_daily_terms
from .watchlist import fetch_watchlist

_SEED_CAP = 8000  # 去重预热时从 DB 载入的近窗代表条目上限


def day_of(ts):
    return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


def recount_day(conn, day):
    """重算某日：聚类成事件 -> 回写 event_id -> 按事件统计词频。

    只统计 admitted=1 且为去重代表（dup_group IS NULL）的条目，
    使突发基线建立在"够格 + 去重代表"样本上。
    """
    rows = conn.execute(
        "SELECT id, source, title, content FROM items "
        "WHERE day=? AND admitted=1 AND dup_group IS NULL",
        (day,),
    ).fetchall()
    events, assign = build_events(rows)
    conn.executemany("UPDATE items SET event_id=? WHERE id=?", [(eid, iid) for iid, eid in assign.items()])
    counts = count_daily_terms(events)
    conn.execute("DELETE FROM term_daily WHERE day=?", (day,))
    conn.executemany(
        "INSERT INTO term_daily (term, day, doc_count, spec_count, weight) VALUES (?,?,?,?,?)",
        [(t, day, c, s, w) for t, (c, s, w) in counts.items()],
    )


def _seed_dedup(conn, now, cfg):
    """用近窗内的已有代表条目预热去重状态，支持跨轮/跨源去重。"""
    dcfg = cfg.get("dedup") or {}
    since = now - int(dcfg.get("window_hours", 72) * 3600)
    rows = conn.execute(
        "SELECT id, title, content FROM items "
        "WHERE dup_group IS NULL AND effective_ts >= ? "
        "ORDER BY effective_ts DESC LIMIT ?",
        (since, _SEED_CAP),
    ).fetchall()
    st = dedup.DedupState(jaccard=dcfg.get("jaccard", 0.5))
    for r in rows:
        st.seed(r["id"], r["title"], r["content"])
    return st


def _sort_key(it):
    # 高 tier（数字小）优先；同 tier 内有真实时间者优先成为去重代表
    ts = int(it.get("ts") or 0)
    return (source_tier(it["source"]), ts if ts > 0 else (1 << 62))


def collect_once():
    items, errors = fetch_all()
    wl_items, wl_errors = fetch_watchlist()
    items.extend(wl_items)
    errors.update(wl_errors)
    cfg = scoring.load_config()
    now = int(time.time())
    conn = db.connect()
    new = 0
    admitted_new = 0
    days = set()
    with conn:
        st = _seed_dedup(conn, now, cfg)
        for it in sorted(items, key=_sort_key):
            trust = scoring.trust_ts_for(it["source"], cfg)
            display_ts, eff_ts, ts_trusted = timefix.resolve_time(
                it.get("ts"), now, trust_ts=trust, future_skew_hours=cfg["future_skew_hours"]
            )
            dup_group, is_dup = st.add(it["id"], it.get("title"), it.get("content"))
            score, parts, admitted = scoring.score_item(
                it, effective_ts=eff_ts, now=now, dup=is_dup, cfg=cfg
            )
            day = day_of(eff_ts)
            cur = conn.execute(
                "INSERT OR IGNORE INTO items "
                "(id, source, title, content, url, ts, day, first_seen, effective_ts, "
                " ts_trusted, score, score_parts, admitted, dup_group) "
                "VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                (
                    it["id"], it["source"], it["title"], it["content"], it["url"],
                    display_ts, day, now, eff_ts, ts_trusted,
                    score, json.dumps(parts, ensure_ascii=False), admitted, dup_group,
                ),
            )
            if cur.rowcount:
                new += 1
                if admitted and dup_group is None:
                    admitted_new += 1
                    days.add(day)
        for day in days:
            recount_day(conn, day)
    conn.close()
    print(
        f"[collector] fetched={len(items)} new={new} admitted={admitted_new} "
        f"days_recomputed={sorted(days)} errors={errors}"
    )
    return new, errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--loop", type=int, default=0, help="循环间隔（分钟），0=只跑一次")
    args = parser.parse_args()
    while True:
        try:
            collect_once()
        except Exception as e:  # noqa: BLE001
            print(f"[collector] error: {e}", file=sys.stderr)
        if not args.loop:
            break
        time.sleep(args.loop * 60)


if __name__ == "__main__":
    main()

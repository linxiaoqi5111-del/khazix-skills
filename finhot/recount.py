"""重算所有已入库日期的词频（修改算法/停用词/权重后使用）。

用法:
    python recount.py              # 仅重算词频（聚类/停用词/权重改动后）
    python recount.py --rescore    # 先按当前 scoring 配置重算 admitted（改权重/阈值后
                                   # 零丢失召回低分存档），再重算词频

--rescore 从每条已存的 score_parts（四因子归一值）用当前配置重算 score/admitted，
不重算新鲜度（避免历史条目被当前时间一律算成过期），因此调低阈值即可重新召回此前
被存档的条目。
"""
import argparse
import json

from app import db, scoring
from app.collector import recount_day


def rescore_all(conn, cfg):
    rows = conn.execute("SELECT id, score_parts FROM items WHERE score_parts IS NOT NULL").fetchall()
    updated = 0
    with conn:
        for r in rows:
            try:
                parts = json.loads(r["score_parts"])
            except (TypeError, ValueError):
                continue
            score, admitted = scoring.recompute(parts, cfg)
            conn.execute(
                "UPDATE items SET score=?, admitted=? WHERE id=?", (score, admitted, r["id"])
            )
            updated += 1
    print(f"[rescore] updated={updated} threshold={cfg['threshold']} weights={cfg['weights']}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--rescore", action="store_true", help="先按当前 scoring 配置重算 admitted")
    args = parser.parse_args()
    conn = db.connect()
    if args.rescore:
        rescore_all(conn, scoring.load_config())
    days = [r["day"] for r in conn.execute("SELECT DISTINCT day FROM items ORDER BY day")]
    for day in days:
        with conn:
            recount_day(conn, day)
        n = conn.execute("SELECT COUNT(*) FROM term_daily WHERE day=?", (day,)).fetchone()[0]
        print(day, n, "terms")
    conn.close()


if __name__ == "__main__":
    main()

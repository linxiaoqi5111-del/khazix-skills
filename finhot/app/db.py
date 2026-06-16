import os
import sqlite3

DB_PATH = os.environ.get("FINHOT_DB", os.path.join(os.path.dirname(__file__), "..", "data", "finhot.db"))

SCHEMA = """
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT,
    content TEXT,
    url TEXT,
    ts INTEGER NOT NULL,
    day TEXT NOT NULL,
    event_id TEXT,
    first_seen INTEGER,
    effective_ts INTEGER,
    ts_trusted INTEGER NOT NULL DEFAULT 1,
    score REAL NOT NULL DEFAULT 0,
    score_parts TEXT,
    admitted INTEGER NOT NULL DEFAULT 1,
    dup_group TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_day ON items(day);
CREATE TABLE IF NOT EXISTS term_daily (
    term TEXT NOT NULL,
    day TEXT NOT NULL,
    doc_count INTEGER NOT NULL,
    spec_count INTEGER NOT NULL DEFAULT 0,
    weight REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (term, day)
);
CREATE INDEX IF NOT EXISTS idx_term_daily_day ON term_daily(day);
"""


def connect():
    path = os.path.abspath(DB_PATH)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(term_daily)")}
    if "spec_count" not in cols:
        conn.execute("ALTER TABLE term_daily ADD COLUMN spec_count INTEGER NOT NULL DEFAULT 0")
    if "weight" not in cols:
        conn.execute("ALTER TABLE term_daily ADD COLUMN weight REAL NOT NULL DEFAULT 0")
    item_cols = {r[1] for r in conn.execute("PRAGMA table_info(items)")}
    if "event_id" not in item_cols:
        conn.execute("ALTER TABLE items ADD COLUMN event_id TEXT")
    # Phase 1：入库期时间保真 + 打分 + 跨源去重新增列（旧库可空迁移 + 回填）
    item_migrations = [
        ("first_seen", "ALTER TABLE items ADD COLUMN first_seen INTEGER"),
        ("effective_ts", "ALTER TABLE items ADD COLUMN effective_ts INTEGER"),
        ("ts_trusted", "ALTER TABLE items ADD COLUMN ts_trusted INTEGER NOT NULL DEFAULT 1"),
        ("score", "ALTER TABLE items ADD COLUMN score REAL NOT NULL DEFAULT 0"),
        ("score_parts", "ALTER TABLE items ADD COLUMN score_parts TEXT"),
        ("admitted", "ALTER TABLE items ADD COLUMN admitted INTEGER NOT NULL DEFAULT 1"),
        ("dup_group", "ALTER TABLE items ADD COLUMN dup_group TEXT"),
    ]
    added = False
    for name, ddl in item_migrations:
        if name not in item_cols:
            conn.execute(ddl)
            added = True
    if added:
        # 旧条目：有效时间/首见时间回填为原 ts（保持既有归日不变，admitted 默认 1）
        conn.execute("UPDATE items SET first_seen=ts WHERE first_seen IS NULL")
        conn.execute("UPDATE items SET effective_ts=ts WHERE effective_ts IS NULL")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_items_admitted_day ON items(admitted, day)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_items_dup_group ON items(dup_group)")
    conn.commit()
    return conn

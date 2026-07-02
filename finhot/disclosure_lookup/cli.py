"""disclosure_lookup 命令行入口。

    python3 -m disclosure_lookup.cli company 瑞华泰 --days 30
    python3 -m disclosure_lookup.cli company 688323 --source cninfo,irm_szse
    python3 -m disclosure_lookup.cli keyword "CoWoS 否认" --days 30
    python3 -m disclosure_lookup.cli cache --stats

以模块方式运行时，工作目录需为本包的父目录（finhot/finhot/）。
Phase 0：参数解析（--help）可用；执行实际查询会抛 NotImplementedError（逻辑见各期）。
"""
from __future__ import annotations

import argparse
import json
from typing import Optional

from . import evidence_card, lookup
from .triage import is_reverse_evidence


def _parse_sources(value: Optional[str]) -> Optional[list[str]]:
    if not value:
        return None
    return [s.strip() for s in value.split(",") if s.strip()]


_LEVEL_ORDER = {"P0": 0, "P1": 1, "P2": 2, "P3": 3, None: 4}


def _filter_records(records, args):
    """按 --level/--limit 筛选；--sort triage 时先按分级再按同级内分数降序。"""
    levels = _parse_sources(getattr(args, "level", None))
    if levels:
        wanted = {lv.upper() for lv in levels}
        records = [r for r in records if (r.triage_level or "").upper() in wanted]
    if getattr(args, "sort", None) == "triage":
        records = sorted(
            records,
            key=lambda r: (_LEVEL_ORDER.get(r.triage_level, 4), -(r.triage_score or 0.0)),
        )
    limit = getattr(args, "limit", None)
    if limit:
        records = records[:limit]
    return records


def _print_records(records, as_json: bool = False) -> None:
    """统一打印：日期 / 来源 / 公司 / [triage] / 标题；--json 时输出机器可读 JSON。"""
    if as_json:
        payload = [dict(r.to_dict(), is_reverse=is_reverse_evidence(r)) for r in records]
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return
    if not records:
        print("(无结果)")
        return
    for r in records:
        level = f"[{r.triage_level}]" if r.triage_level else ""
        # P0 + 反证 → 追加 [反证]：正向硬事实与反证同为 P0，靠这个标记区分
        if r.triage_level == "P0" and is_reverse_evidence(r):
            level = f"[{r.triage_level}][反证]"
        level = f"{level} " if level else ""
        kws = (",".join(r.matched_keywords)) if r.matched_keywords else "-"
        print(
            f"{r.published_at[:16]}  {r.source:<14} {r.company_name}({r.company_code})  "
            f"{level}{r.title[:48]}  <{kws}>\n    {r.url}"
        )


def _cmd_company(args) -> int:
    records = lookup.search_company(
        args.query, days=args.days, sources=_parse_sources(args.source)
    )
    _print_records(_filter_records(records, args), as_json=args.json)
    return 0


def _cmd_keyword(args) -> int:
    records = lookup.search_keyword(
        args.keyword,
        days=args.days,
        codes=_parse_sources(args.codes),
        sources=_parse_sources(args.source),
    )
    _print_records(_filter_records(records, args), as_json=args.json)
    return 0


def _cmd_evidence(args) -> int:
    """查公司 → triage 已在 search_company 内跑 → 为 P0/P1 生成证据卡候选写盘。"""
    records = lookup.search_company(
        args.query, days=args.days, sources=_parse_sources(args.source)
    )
    # 展示层可筛/可截断；证据卡生成仍用全量 records，不受展示筛选影响
    _print_records(_filter_records(records, args), as_json=args.json)
    cfg = lookup.load_config()
    kb_dir = evidence_card.resolve_kb_dir(cfg)
    paths = evidence_card.generate_candidates(records, kb_dir=kb_dir)
    print(f"\n证据卡候选落点：{kb_dir}")
    if not paths:
        print("(无 P0/P1 候选，未生成证据卡)")
    else:
        print(f"生成 {len(paths)} 张（review_status=pending，待人工/agent 确认才入知识库正文）：")
        for p in paths:
            print(f"  {p}")
    return 0


def _cmd_cache(args) -> int:
    from . import cache

    cfg = lookup.load_config()
    conn = cache.connect(lookup.db_path(cfg))
    try:
        if args.purge_expired:
            print(f"purged {cache.purge_expired(conn)} expired records")
        print("cache stats:")
        for k, v in cache.stats(conn).items():
            print(f"  {k}: {v}")
    finally:
        conn.close()
    return 0


def _add_output_flags(p: argparse.ArgumentParser) -> None:
    """输出控制：给 agent/脚本消费的 --json，只看高价值的 --level，长结果的 --limit/--sort。"""
    p.add_argument("--level", default=None, help="只显示指定分级，逗号分隔，如 P0,P1")
    p.add_argument("--limit", type=int, default=None, help="最多显示 N 条")
    p.add_argument("--sort", choices=["time", "triage"], default="time",
                   help="排序：time=源顺序(默认) / triage=P0→P3、同级按分数降序")
    p.add_argument("--json", action="store_true", help="输出 JSON（含全部字段+is_reverse，供 agent 消费）")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="disclosure_lookup", description="实时查新 + 选择性 L3 沉淀")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_company = sub.add_parser("company", help="按公司（名或代码）查近 N 天披露")
    p_company.add_argument("query", help="公司名或 6 位代码，如 瑞华泰 / 688323")
    p_company.add_argument("--days", type=int, default=30)
    p_company.add_argument("--source", default=None, help="逗号分隔，如 cninfo,irm_szse")
    _add_output_flags(p_company)
    p_company.set_defaults(func=_cmd_company)

    p_kw = sub.add_parser("keyword", help="按关键词查")
    p_kw.add_argument("keyword", help='如 "CoWoS 否认"')
    p_kw.add_argument("--days", type=int, default=30)
    p_kw.add_argument("--codes", default=None, help="限定公司代码，逗号分隔")
    p_kw.add_argument("--source", default=None, help="逗号分隔来源")
    _add_output_flags(p_kw)
    p_kw.set_defaults(func=_cmd_keyword)

    p_ev = sub.add_parser(
        "evidence", help="查公司并为 P0/P1 生成证据卡候选（写到知识库 disclosures）"
    )
    p_ev.add_argument("query", help="公司名或 6 位代码")
    p_ev.add_argument("--days", type=int, default=30)
    p_ev.add_argument("--source", default=None, help="逗号分隔来源")
    _add_output_flags(p_ev)
    p_ev.set_defaults(func=_cmd_evidence)

    p_cache = sub.add_parser("cache", help="缓存维护")
    p_cache.add_argument("--stats", action="store_true", help="打印缓存统计")
    p_cache.add_argument("--purge-expired", action="store_true", help="清理过期记录")
    p_cache.set_defaults(func=_cmd_cache)
    return ap


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except NotImplementedError as exc:
        print(f"[scaffold] 该功能尚未实现：{exc}")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

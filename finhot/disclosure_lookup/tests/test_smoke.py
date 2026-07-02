"""离线冒烟测试：验证包可导入 + 数据契约稳定（无网络、无 PyYAML/akshare 依赖）。

运行（cwd = finhot/finhot）：
    python3 -m unittest disclosure_lookup.tests.test_smoke -v
"""
import importlib
import unittest

from disclosure_lookup.schema import DisclosureRecord, make_doc_hash


class TestContract(unittest.TestCase):
    def test_doc_hash_stable_within_day(self):
        # 同一条披露、同日不同时刻 → 同 hash（make_doc_hash 只取到「天」）
        h1 = make_doc_hash("cninfo", "688323", "签订重大合同", "2026-06-30T00:00:00+08:00")
        h2 = make_doc_hash("cninfo", "688323", "签订重大合同", "2026-06-30T09:30:00+08:00")
        self.assertEqual(h1, h2)

    def test_record_autofills_doc_hash(self):
        r = DisclosureRecord(
            company_name="瑞华泰",
            company_code="688323",
            source="cninfo",
            title="签订重大合同",
            url="https://example",
            published_at="2026-06-30T00:00:00+08:00",
        )
        self.assertTrue(r.doc_hash)
        self.assertIsNone(r.triage_level)


class TestImportsClean(unittest.TestCase):
    """所有模块在不装 PyYAML/akshare 时也应能 import（重依赖须延迟加载）。"""

    def test_modules_import(self):
        for mod in (
            "disclosure_lookup",
            "disclosure_lookup.lookup",
            "disclosure_lookup.cache",
            "disclosure_lookup.triage",
            "disclosure_lookup.evidence_card",
            "disclosure_lookup.cli",
            "disclosure_lookup.sources.base",
            "disclosure_lookup.sources.cninfo",
            "disclosure_lookup.sources.irm",
            "disclosure_lookup.sources.inquiry",
        ):
            importlib.import_module(mod)


class TestSseDateFormat(unittest.TestCase):
    """sse_einteract 中文日期 + 相对日期解析（irm._to_iso）。"""

    def test_chinese_date(self):
        from disclosure_lookup.sources.irm import _to_iso

        self.assertEqual(_to_iso("2026年06月25日 15:40来自网站"), "2026-06-25T15:40:00+08:00")
        self.assertEqual(_to_iso("2026年6月5日"), "2026-06-05T00:00:00+08:00")

    def test_standard_formats(self):
        from disclosure_lookup.sources.irm import _to_iso

        self.assertEqual(_to_iso("2026-06-30T09:30:00+08:00"), "2026-06-30T09:30:00+08:00")
        self.assertEqual(_to_iso("2026/6/5 08:00"), "2026-06-05T08:00:00+08:00")

    def test_relative_date(self):
        import datetime as dt

        from disclosure_lookup.sources.irm import _to_iso

        iso = _to_iso("昨天 17:45来自网站")
        self.assertTrue(iso.startswith((dt.date.today() - dt.timedelta(days=1)).isoformat()))
        self.assertIn("17:45:00", iso)

    def test_no_date(self):
        from disclosure_lookup.sources.irm import _to_iso

        self.assertEqual(_to_iso("纯文本无日期"), "")


if __name__ == "__main__":
    unittest.main()


class TestCliOutputFlags(unittest.TestCase):
    """CLI 输出控制（--level/--limit/--sort/--json）的展示层筛选。"""

    def _rec(self, level, score, title="t"):
        from disclosure_lookup.schema import DisclosureRecord

        r = DisclosureRecord(
            company_name="X", company_code="000001", source="cninfo",
            title=title, url="u", published_at="2026-07-01T00:00:00+08:00",
        )
        r.triage_level, r.triage_score = level, score
        return r

    def test_level_filter_and_triage_sort(self):
        import argparse

        from disclosure_lookup import cli

        recs = [self._rec("P2", 5), self._rec("P0", 9), self._rec("P0", 12), self._rec("P3", 1)]
        args = argparse.Namespace(level="P0,p2", limit=None, sort="triage", json=False)
        out = cli._filter_records(recs, args)
        self.assertEqual([(r.triage_level, r.triage_score) for r in out],
                         [("P0", 12), ("P0", 9), ("P2", 5)])

    def test_limit(self):
        import argparse

        from disclosure_lookup import cli

        args = argparse.Namespace(level=None, limit=2, sort="time", json=False)
        self.assertEqual(len(cli._filter_records([self._rec("P1", 1)] * 5, args)), 2)

    def test_json_output_includes_all_fields(self):
        import io
        import json as _json
        from contextlib import redirect_stdout

        from disclosure_lookup import cli

        buf = io.StringIO()
        with redirect_stdout(buf):
            cli._print_records([self._rec("P0", 9, title="签订重大合同")], as_json=True)
        payload = _json.loads(buf.getvalue())
        self.assertEqual(payload[0]["triage_level"], "P0")
        self.assertIn("is_reverse", payload[0])
        self.assertIn("doc_hash", payload[0])

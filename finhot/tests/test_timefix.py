"""时间保真单测：缺失/未来/不可信时间不得被当成"过去某天"，避免假突发。

运行：在 finhot/ 目录下 `python -m unittest discover -s tests`
"""
import datetime
import unittest

from app import timefix


def _day(ts):
    return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d")


class ResolveTimeTest(unittest.TestCase):
    def setUp(self):
        # 固定一个"现在"：2026-06-16 12:00:00（本地时区）
        self.now = int(datetime.datetime(2026, 6, 16, 12, 0, 0).timestamp())

    def test_trusted_past_kept(self):
        """真实的过去时间被信任，按其真实日期归日。"""
        past = int(datetime.datetime(2026, 6, 14, 9, 30, 0).timestamp())
        display, eff, trusted = timefix.resolve_time(past, self.now)
        self.assertEqual(display, past)
        self.assertEqual(eff, past)
        self.assertEqual(trusted, 1)
        self.assertEqual(_day(eff), "2026-06-14")

    def test_missing_anchors_to_now(self):
        """缺失时间（哨兵 0）锚定 first_seen=now，归到今天而非历史。"""
        for raw in (0, None, "", "abc"):
            display, eff, trusted = timefix.resolve_time(raw, self.now)
            self.assertEqual(display, self.now)
            self.assertEqual(eff, self.now)
            self.assertEqual(trusted, 0)
            self.assertEqual(_day(eff), "2026-06-16")

    def test_future_clamped(self):
        """明显的未来时间钳回 now（超过 future_skew 容差）。"""
        future = self.now + 6 * 3600
        display, eff, trusted = timefix.resolve_time(future, self.now)
        self.assertEqual(eff, self.now)
        self.assertEqual(trusted, 0)

    def test_small_future_within_skew_kept(self):
        """容差内的轻微时钟漂移仍被信任，不钳。"""
        slight = self.now + 1800  # 30 分钟，默认容差 2 小时
        display, eff, trusted = timefix.resolve_time(slight, self.now)
        self.assertEqual(eff, slight)
        self.assertEqual(trusted, 1)

    def test_untrusted_source_anchors_to_now(self):
        """源被标记 trust_ts=False 时，即便给了过去时间也锚定 now。"""
        past = int(datetime.datetime(2026, 5, 1, 0, 0, 0).timestamp())
        display, eff, trusted = timefix.resolve_time(past, self.now, trust_ts=False)
        self.assertEqual(eff, self.now)
        self.assertEqual(trusted, 0)
        self.assertEqual(_day(eff), "2026-06-16")

    def test_backfill_not_counted_as_today_burst(self):
        """关键回归：新源首轮回灌的历史条目按真实历史日期归日，不堆到今天。"""
        history = [
            int(datetime.datetime(2026, 6, 10, 8, 0, 0).timestamp()),
            int(datetime.datetime(2026, 6, 11, 8, 0, 0).timestamp()),
            int(datetime.datetime(2026, 6, 12, 8, 0, 0).timestamp()),
        ]
        days = {_day(timefix.resolve_time(h, self.now)[1]) for h in history}
        self.assertEqual(days, {"2026-06-10", "2026-06-11", "2026-06-12"})
        self.assertNotIn("2026-06-16", days)


if __name__ == "__main__":
    unittest.main()

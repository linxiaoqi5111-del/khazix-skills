"""打分/门槛单测：四因子 + 阈值 admitted + recompute 零丢失召回。

运行：在 finhot/ 目录下 `python -m unittest discover -s tests`
"""
import copy
import unittest

from app import scoring


class FactorTest(unittest.TestCase):
    def test_influence_normalized(self):
        """影响力归一到 [0,1]，T1 官方源最高。"""
        infl_t1 = scoring.influence("财联社")
        infl_blogger = scoring.influence("微博@某人")
        self.assertAlmostEqual(infl_t1, 1.0, places=4)
        self.assertLess(infl_blogger, infl_t1)
        self.assertGreaterEqual(infl_blogger, 0.0)

    def test_relevance_empty_is_floor(self):
        """空文本拿地板分。"""
        self.assertEqual(scoring.relevance("", ""), 0.2)

    def test_freshness_decays(self):
        """新鲜度随时间指数衰减：越旧分越低，刚发布≈1。"""
        now = 1_000_000
        fresh_now = scoring.freshness(now, now, 48)
        fresh_old = scoring.freshness(now - 240 * 3600, now, 48)  # 10 天前
        self.assertAlmostEqual(fresh_now, 1.0, places=3)
        self.assertLess(fresh_old, fresh_now)
        self.assertGreaterEqual(fresh_old, 0.0)

    def test_freshness_future_clamped_to_one(self):
        """effective_ts 已被钳过，未来差值按 0 处理，不会 >1。"""
        now = 1_000_000
        self.assertLessEqual(scoring.freshness(now + 9999, now, 48), 1.0)


class AdmissionTest(unittest.TestCase):
    def setUp(self):
        self.cfg = scoring.load_config()
        self.now = 1_000_000

    def test_dup_penalty_lowers_score(self):
        """同条目，标记为重复（dup=1）时分数更低。"""
        item = {"source": "财联社", "title": "央行宣布降准0.5个百分点", "content": "利好银行板块"}
        s_rep, _, _ = scoring.score_item(item, effective_ts=self.now, now=self.now, dup=False, cfg=self.cfg)
        s_dup, _, _ = scoring.score_item(item, effective_ts=self.now, now=self.now, dup=True, cfg=self.cfg)
        self.assertLess(s_dup, s_rep)

    def test_high_value_item_admitted(self):
        """高影响力 + 强相关 + 新鲜 → admitted=1。"""
        item = {"source": "财联社", "title": "央行宣布降准", "content": "半导体光伏新能源板块大涨"}
        score, parts, admitted = scoring.score_item(
            item, effective_ts=self.now, now=self.now, dup=False, cfg=self.cfg
        )
        self.assertEqual(set(parts), {"infl", "rel", "fresh", "dup"})
        self.assertEqual(admitted, 1)

    def test_recompute_matches_score_item(self):
        """recompute(parts) 必须与 score_item 返回的 score 一致。"""
        item = {"source": "东方财富快讯", "title": "某公司公告", "content": "签订合同"}
        score, parts, admitted = scoring.score_item(
            item, effective_ts=self.now, now=self.now, dup=False, cfg=self.cfg
        )
        r_score, r_admitted = scoring.recompute(parts, self.cfg)
        self.assertEqual(score, r_score)
        self.assertEqual(admitted, r_admitted)


class ZeroLossRecallTest(unittest.TestCase):
    """核心：低分条目存档不丢，调低阈值后用 recompute 可零丢失重新召回。"""

    def test_lower_threshold_recalls_archived(self):
        cfg = scoring.load_config()
        # 构造一个分数处于中间档的条目
        parts = {"infl": 0.6, "rel": 0.45, "fresh": 0.5, "dup": 0.0}
        score, _ = scoring.recompute(parts, cfg)

        high_cfg = copy.deepcopy(cfg)
        high_cfg["threshold"] = score + 0.05  # 阈值高于其分 → 被存档
        _, admitted_high = scoring.recompute(parts, high_cfg)
        self.assertEqual(admitted_high, 0)

        low_cfg = copy.deepcopy(cfg)
        low_cfg["threshold"] = score - 0.05  # 调低阈值 → 重新召回
        _, admitted_low = scoring.recompute(parts, low_cfg)
        self.assertEqual(admitted_low, 1)

    def test_recompute_does_not_touch_freshness(self):
        """recompute 只用已存 parts，不重算新鲜度（历史条目不会被当前时间一律算过期）。"""
        cfg = scoring.load_config()
        parts = {"infl": 0.5, "rel": 0.5, "fresh": 0.9, "dup": 0.0}
        s1, _ = scoring.recompute(parts, cfg)
        s2, _ = scoring.recompute(dict(parts), cfg)
        self.assertEqual(s1, s2)


if __name__ == "__main__":
    unittest.main()

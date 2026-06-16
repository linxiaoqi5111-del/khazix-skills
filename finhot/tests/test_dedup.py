"""跨源去重单测：同一篇内容被多源推送，只保留一个代表。

运行：在 finhot/ 目录下 `python -m unittest discover -s tests`
"""
import unittest

from app import dedup


class DedupStateTest(unittest.TestCase):
    def test_cross_source_one_representative(self):
        """同一新闻被三个源转发，只有第一条成为代表，其余指向它。"""
        st = dedup.DedupState(jaccard=0.5)
        title = "央行宣布全面降准0.5个百分点 释放长期资金约1万亿元"
        g1, d1 = st.add("cls-1", title, "")
        g2, d2 = st.add("em-1", title, "")
        g3, d3 = st.add("ths-1", "央行宣布全面降准0.5个百分点，释放长期资金约1万亿", "")
        self.assertIsNone(g1)
        self.assertFalse(d1)
        self.assertEqual(g2, "cls-1")
        self.assertTrue(d2)
        self.assertEqual(g3, "cls-1")
        self.assertTrue(d3)

    def test_distinct_items_not_merged(self):
        """完全不同的两条不应被判为重复。"""
        st = dedup.DedupState(jaccard=0.5)
        g1, d1 = st.add("a", "央行降准利好银行股", "")
        g2, d2 = st.add("b", "某科技公司发布新款芯片产品", "")
        self.assertIsNone(g1)
        self.assertIsNone(g2)
        self.assertFalse(d1)
        self.assertFalse(d2)

    def test_seed_enables_cross_round_dedup(self):
        """预热（上一轮已入库的代表）后，新一轮重复条目能匹配到历史代表。"""
        st = dedup.DedupState(jaccard=0.5)
        st.seed("hist-1", "重磅：国常会部署稳增长一揽子政策措施", "")
        g, d = st.add("new-1", "重磅：国常会部署稳增长一揽子政策措施", "")
        self.assertEqual(g, "hist-1")
        self.assertTrue(d)

    def test_empty_text_is_representative(self):
        """空文本无 token，不与任何条目重复，自成代表。"""
        st = dedup.DedupState(jaccard=0.5)
        g, d = st.add("empty", "", "")
        self.assertIsNone(g)
        self.assertFalse(d)

    def test_threshold_respected(self):
        """相似度低于阈值不合并。"""
        st = dedup.DedupState(jaccard=0.9)
        st.add("a", "央行宣布降准释放流动性支持实体经济", "")
        # 仅部分重叠，Jaccard 应低于 0.9
        g, d = st.add("b", "央行召开会议讨论货币政策方向", "")
        self.assertIsNone(g)
        self.assertFalse(d)


if __name__ == "__main__":
    unittest.main()

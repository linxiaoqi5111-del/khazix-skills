"""跨源近重复检测：同一篇内容被多个 feed 推送时，只让"代表条目"计入热度，
避免一条新闻被 N 个源转发就刷成假突发。

复用 events._tokens（字符 bigram + 单字 + 拉丁词）做 Jaccard 相似度，用 token 倒排
索引只比较有共同 token 的已有代表，避免 O(n^2) 全量比较。

用法：
    st = DedupState(jaccard=0.5)
    st.seed(rep_id, title, content)          # 预热：把窗口内已有代表灌进来
    group, is_dup = st.add(item_id, title, content)
        group is None / item_id  -> 该条是代表（dup=0）
        group == 某个已有 id      -> 该条是重复（dup=1），dup_group 指向代表
"""
from .events import _tokens


def _jaccard(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if not inter:
        return 0.0
    return inter / len(a | b)


class DedupState:
    def __init__(self, jaccard=0.5):
        self.threshold = jaccard
        self._reps = []  # [(rep_id, token_set)]
        self._index = {}  # token -> [rep 下标]

    def _add_rep(self, rep_id, toks):
        idx = len(self._reps)
        self._reps.append((rep_id, toks))
        for t in toks:
            self._index.setdefault(t, []).append(idx)

    def _match(self, toks):
        """返回最相似且达阈值的代表 id，否则 None。"""
        if not toks:
            return None
        seen = set()
        best_id, best_sim = None, 0.0
        for t in toks:
            for idx in self._index.get(t, ()):
                if idx in seen:
                    continue
                seen.add(idx)
                rep_id, rep_toks = self._reps[idx]
                sim = _jaccard(toks, rep_toks)
                if sim >= self.threshold and sim > best_sim:
                    best_id, best_sim = rep_id, sim
        return best_id

    def seed(self, rep_id, title, content):
        """把窗口内一条已有代表灌入状态（不返回判定）。"""
        toks = _tokens(((title or "") + " " + (content or "")).strip())
        self._add_rep(rep_id, toks)

    def add(self, item_id, title, content):
        """判定新条目。返回 (dup_group, is_dup)。

        - 非重复：注册为新代表，返回 (None, False)；
        - 重复：返回 (代表id, True)，不注册（重复条目不再吸附后续条目）。
        """
        toks = _tokens(((title or "") + " " + (content or "")).strip())
        rep = self._match(toks)
        if rep is None:
            self._add_rep(item_id, toks)
            return None, False
        return rep, True

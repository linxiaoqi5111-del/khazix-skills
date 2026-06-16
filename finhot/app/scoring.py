"""入库前打分：把"过滤"从查询期搬到入库期。

每条目按四因子打分，达到阈值才 admitted=1 进入热词分析；低分条目 admitted=0 仅存档
（零丢失，调低阈值后可重新召回，见 recount.py --rescore）。四因子全部复用 finhot 既有能力：

  影响力 infl  : 复用 events.tier_weight（信源分层），归一到 [0,1]
  相关性 rel   : 复用 lexicon.classify / terms.is_speculative（行业/题材/A股投机信号）
  新鲜度 fresh : 基于 effective_ts 的指数衰减 exp(-Δ小时/τ)，压低历史回灌的旧条目
  重复度 dup   : 跨源近重复（见 dedup.py），非代表条目计 1 受罚

  score = w_infl·infl + w_rel·rel + w_fresh·fresh − w_dup·dup
  admitted = score >= threshold

score_parts 存的是四因子的归一值（不是加权后），因此改权重/阈值后只需用 recompute()
重算即可"零丢失召回"，无需重新跑新鲜度（避免历史条目被当前时间一律算成过期）。
"""
import json
import math
import os

from .events import tier_weight
from .lexicon import classify, has_industry_prefix
from .terms import extract_terms, is_speculative

_MAX_TIER_WEIGHT = 1.3  # events.TIER_WEIGHTS 中的最大值（T1 信源）

# 相关性：词类型 -> 基础分（lexicon.classify 的输出）
_REL_BY_TYPE = {
    "industry": 1.0,
    "candidate": 0.5,
    "entity": 0.45,
    "event": 0.45,
    "geo": 0.4,
}

DEFAULT_CONFIG = {
    "weights": {"infl": 0.30, "rel": 0.35, "fresh": 0.20, "dup": 0.15},
    "threshold": 0.45,
    "fresh_tau_hours": 48,
    "future_skew_hours": 2,
    "dedup": {"window_hours": 72, "jaccard": 0.5},
    "baseline_days": 7,
    "trust_ts": {},  # 源名(或前缀) -> bool；缺省 True（信任源给的时间）
}


def _deep_merge(base, override):
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_config():
    """读取打分配置：默认值叠加 scoring.json（或环境变量 FINHOT_SCORING 指定的文件）。"""
    path = os.environ.get("FINHOT_SCORING") or os.path.join(
        os.path.dirname(__file__), "..", "scoring.json"
    )
    user = {}
    try:
        with open(path, encoding="utf-8") as f:
            user = json.load(f)
    except (FileNotFoundError, ValueError):
        user = {}
    return _deep_merge(DEFAULT_CONFIG, user)


def trust_ts_for(source, cfg):
    """源是否可信其时间戳：精确匹配优先，其次前缀匹配，缺省 True。"""
    tt = cfg.get("trust_ts") or {}
    if source in tt:
        return bool(tt[source])
    for key, val in tt.items():
        if source.startswith(key):
            return bool(val)
    return True


def influence(source):
    return round(tier_weight(source) / _MAX_TIER_WEIGHT, 4)


def relevance(title, content):
    text = ((title or "") + " " + (content or "")).strip()
    if not text:
        return 0.2
    best = 0.0
    for term in extract_terms(text):
        ttype = classify(term)
        val = _REL_BY_TYPE.get(ttype, 0.3)
        if ttype == "candidate" and has_industry_prefix(term):
            val = 0.7
        if val > best:
            best = val
    if best == 0.0:
        best = 0.2
    if is_speculative(text):
        best = min(1.0, best + 0.2)
    return round(best, 4)


def freshness(effective_ts, now, tau_hours):
    dh = max(0.0, (now - int(effective_ts)) / 3600.0)
    tau = max(1e-6, float(tau_hours))
    return round(math.exp(-dh / tau), 4)


def recompute(parts, cfg):
    """从已存的四因子归一值重算 (score, admitted)。用于改权重/阈值后零丢失召回。"""
    w = cfg["weights"]
    score = (
        w["infl"] * float(parts.get("infl", 0.0))
        + w["rel"] * float(parts.get("rel", 0.0))
        + w["fresh"] * float(parts.get("fresh", 0.0))
        - w["dup"] * float(parts.get("dup", 0.0))
    )
    score = round(score, 4)
    return score, (1 if score >= cfg["threshold"] else 0)


def score_item(item, *, effective_ts, now, dup, cfg):
    """对单条目打分。返回 (score, parts, admitted)。

    item: {"source","title","content",...}
    effective_ts: timefix.resolve_time 得到的有效时间
    dup: 是否为跨源近重复的非代表条目（dedup.py 判定），True 则重复度=1
    """
    parts = {
        "infl": influence(item.get("source", "")),
        "rel": relevance(item.get("title"), item.get("content")),
        "fresh": freshness(effective_ts, now, cfg["fresh_tau_hours"]),
        "dup": 1.0 if dup else 0.0,
    }
    score, admitted = recompute(parts, cfg)
    return score, parts, admitted

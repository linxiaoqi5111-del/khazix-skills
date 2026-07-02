#!/usr/bin/env bash
# FinHot Skill 一行安装器：
#   curl -fsSL https://finhot.industry7view.com/finhot-skill/install.sh | bash
# 自动探测常见 Agent 平台的 skill 目录，把 SKILL.md + VERSION 装进去。
set -euo pipefail

BASE="${FINHOT_BASE:-https://finhot.industry7view.com}"
SKILL_NAME="finhot"

# 候选目标目录（存在其父目录即视为该平台在用）
candidates=(
  "$HOME/.claude/skills/$SKILL_NAME"          # Claude Code (global)
  "$HOME/.codex/skills/$SKILL_NAME"           # Codex CLI
  "$HOME/.gemini/skills/$SKILL_NAME"          # Gemini CLI
  "$HOME/.config/opencode/skills/$SKILL_NAME" # OpenCode
)

# 若当前目录是一个仓库且有 .agents/skills，优先装到项目级
if [ -d ".agents/skills" ]; then
  candidates=(".agents/skills/$SKILL_NAME" "${candidates[@]}")
fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -fsSL "$BASE/finhot-skill/SKILL.md" -o "$tmp/SKILL.md"
curl -fsSL "$BASE/finhot-skill/VERSION" -o "$tmp/VERSION" || echo "0.0.0" > "$tmp/VERSION"

installed=0
for dir in "${candidates[@]}"; do
  parent=$(dirname "$dir")
  grandparent=$(dirname "$parent")
  # 只装到平台目录已存在的地方，避免凭空创建 ~/.gemini 等
  if [ -d "$grandparent" ]; then
    mkdir -p "$dir"
    cp "$tmp/SKILL.md" "$tmp/VERSION" "$dir/"
    echo "✓ 已安装到 $dir (v$(cat "$tmp/VERSION"))"
    installed=1
  fi
done

if [ "$installed" -eq 0 ]; then
  fallback="$HOME/.claude/skills/$SKILL_NAME"
  mkdir -p "$fallback"
  cp "$tmp/SKILL.md" "$tmp/VERSION" "$fallback/"
  echo "✓ 未检测到已知 Agent 平台，已安装到默认位置 $fallback"
fi

echo "完成。让你的 Agent 试试：\"今天财经圈有什么新东西\""

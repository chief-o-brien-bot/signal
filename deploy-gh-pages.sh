#!/bin/bash
# Deploy Signal public/ directory to gh-pages branch for GitHub Pages hosting
# URL: https://chief-o-brien-bot.github.io/signal/

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[GH Pages] Deploying public/ to gh-pages..."

# Push the public/ subtree to gh-pages branch
cd "$SCRIPT_DIR"
git add -A public/
if git diff --cached --quiet; then
  echo "[GH Pages] No changes to deploy."
  exit 0
fi

git commit -m "deploy: Signal $(date -u +%Y-%m-%d\ %H:%M\ UTC)"
git subtree push --prefix public origin gh-pages

echo "[GH Pages] Deployed to https://chief-o-brien-bot.github.io/signal/"

#!/usr/bin/env bash
# Run a repo's local checks after staging the explainer. usage: check.sh <repo-dir>
cd "$1" || exit 2
git add README.md docs/explainer 2>/dev/null
if [ -f pyproject.toml ]; then
  PYTHONPATH=src timeout 1200 python -m pytest -q -p no:cacheprovider -o addopts="" 2>&1 | tail -1
fi
if [ -f package.json ] && grep -q '"test"' package.json; then
  timeout 900 npm test 2>&1 | grep -E "^(ℹ|# )(pass|fail|tests)" | head -4
fi
for s in scripts/check_public_surface.py tools/check_public_surface.py; do
  [ -f "$s" ] && python "$s" 2>&1 | tail -1
done
true

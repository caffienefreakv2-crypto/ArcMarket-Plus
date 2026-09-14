#!/bin/bash
# Runs periodically via systemd --user timer. Fast-forwards this repo from
# origin/main; main.js watches .git/refs/heads/main and relaunches the running
# app when it changes, so pushed commits take effect without manual action.
set -euo pipefail
cd "$(dirname "$0")/.."

git fetch origin main --quiet
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  git pull --ff-only origin main
  echo "ArcMarket+ updated: $LOCAL -> $REMOTE"
fi

#!/usr/bin/env bash
# Publishes dist/ to $PLAYBOX_DEPLOY, and only after every check has passed.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${PLAYBOX_DEPLOY:?Set PLAYBOX_DEPLOY to user@host:/path/to/site/ (see CLAUDE.md)}"
bash scripts/check.sh
rsync -az --delete dist/ "$PLAYBOX_DEPLOY"
echo "Deployed."

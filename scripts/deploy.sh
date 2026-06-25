#!/usr/bin/env bash
# Build the web app, stage it for Firebase Hosting, and deploy.
# This is the ONE TRUE deploy path — keep it in sync with docs/architecture.md.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Fail fast if the project id was never set.
if grep -q "REPLACE_ME" "$ROOT/.firebaserc"; then
  echo "✗ .firebaserc still contains REPLACE_ME. Set your real Firebase project id first." >&2
  exit 1
fi

echo "→ Building app/ ..."
cd "$ROOT/app"
npm run build

echo "→ Staging dist/ into firebase/app/ ..."
rm -rf "$ROOT/firebase/app"
cp -r "$ROOT/app/dist" "$ROOT/firebase/app"

echo "→ Deploying (hosting + functions) ..."
cd "$ROOT/firebase"
firebase deploy

echo "✓ Deploy complete."

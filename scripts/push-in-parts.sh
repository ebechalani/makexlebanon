#!/bin/sh
# One-time helper: the initial 230 MB commit kept timing out (HTTP 408) on
# push, so this rebuilds it as four smaller commits and pushes after each,
# so no single transfer is larger than ~100 MB. Safe to re-run: pushes only
# what the remote is missing.
set -e
cd "$(dirname "$0")/.."

push_retry() {
  for attempt in 1 2 3 4; do
    if git push -u origin main; then return 0; fi
    echo "push attempt $attempt failed; retrying..."
    sleep 5
  done
  echo "PUSH FAILED after 4 attempts" >&2
  return 1
}

# Rebuild history only if we are still on the single mega-commit.
if [ "$(git rev-list --count HEAD)" = "1" ]; then
  git update-ref -d HEAD
  git reset

  git add .gitignore package.json package-lock.json next.config.mjs postcss.config.mjs \
    tsconfig.json README.md .claude content scripts src public/blockly-media \
    public/downloads public/training public/logo.png
  git commit -m "Site code, rules and training assets

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

  git add public/gallery/2024/smart-logistics
  git commit -m "Photos: 2024 Smart Logistics gallery

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

  git add public/gallery/2024 public/gallery/2025
  git commit -m "Photos: remaining 2024 and 2025 galleries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"

  git add -A
  git commit -m "Photos: international galleries and 2026 ranking cards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
fi

# Push commit by commit so each transfer stays small.
for sha in $(git rev-list --reverse HEAD); do
  echo "=== pushing $sha"
  for attempt in 1 2 3 4; do
    if git push origin "$sha:refs/heads/main"; then break; fi
    echo "attempt $attempt failed; retrying..."
    sleep 5
    [ "$attempt" = "4" ] && { echo "PUSH FAILED at $sha" >&2; exit 1; }
  done
done
git push -u origin main
echo "ALL PUSHED OK"

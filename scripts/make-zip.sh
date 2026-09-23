#!/usr/bin/env bash
# Builds the submission ZIP, excluding node_modules, build output, data and secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
rm -f ai-capsule-submission.zip
zip -r ai-capsule-submission.zip . \
  -x 'node_modules/*' 'client/node_modules/*' 'client/dist/*' 'dist/*' 'build/*' \
     'data/*' '.git/*' '.env' '*.db' '*.db-wal' '*.db-shm' 'ai-capsule-submission.zip'
echo
echo "Created ai-capsule-submission.zip"
unzip -l ai-capsule-submission.zip

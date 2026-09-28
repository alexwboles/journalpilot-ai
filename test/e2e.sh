#!/usr/bin/env bash
# JournalPilot AI end-to-end tests — realistic user flows via node.
set -euo pipefail
cd "$(dirname "$0")/.."
node test/run-e2e.js

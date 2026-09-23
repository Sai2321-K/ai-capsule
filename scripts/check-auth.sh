#!/usr/bin/env bash
# The two required cURL checks from section 9 of the assignment.
# Usage: ./scripts/check-auth.sh https://your-app.onrender.com
set -u
BASE="${1:-http://localhost:4000}"
BASE="${BASE%/}"

echo "Base URL: $BASE"
echo
echo "# Test 1 - no authentication"
echo "curl -i $BASE/api/capsules"
curl -i -s "$BASE/api/capsules" | head -n 12
echo
echo "# Required: 401 Unauthorized"
echo
echo "# Test 2 - fake / invalid JWT"
echo "curl -i -H \"Cookie: token=fake-token-123\" $BASE/api/capsules"
curl -i -s -H "Cookie: token=fake-token-123" "$BASE/api/capsules" | head -n 12
echo
echo "# Required: 401 Unauthorized"
echo
echo "# Public health check"
curl -i -s "$BASE/api/health" | head -n 12

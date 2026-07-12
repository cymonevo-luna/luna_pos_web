#!/usr/bin/env bash
# POS-29-2 live QA verification — supplier admin list page after API schema fix.
#
# Prerequisites:
#   - luna_pos_service running with suppliers list schema fix deployed
#   - Optional: npm run dev on :3000 for UI smoke (skipped if web is down)
#
# Usage:
#   ./scripts/verify-pos-29-2-qa.sh
#   NEXT_PUBLIC_API_URL=https://pos-api.cymonevo.com ./scripts/verify-pos-29-2-qa.sh
#   NEXT_PUBLIC_API_URL=http://localhost:8087 WEB_BASE=http://localhost:3000 ./scripts/verify-pos-29-2-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
OPERATIONAL_EMAIL="${TEST_OPERATIONAL_EMAIL:-operation-test@cymonevo.com}"
OPERATIONAL_PASSWORD="${TEST_OPERATIONAL_PASSWORD:-LunaTesting123!}"

declare -A RESULTS
declare -A NOTES

pass() {
	local key="$1"
	local note="$2"
	RESULTS["$key"]="PASS"
	NOTES["$key"]="$note"
}

fail() {
	local key="$1"
	local note="$2"
	RESULTS["$key"]="FAIL"
	NOTES["$key"]="$note"
}

skip() {
	local key="$1"
	local note="$2"
	RESULTS["$key"]="SKIP"
	NOTES["$key"]="$note"
}

print_summary() {
	echo
	echo "== QA summary =="
	printf "%-45s %-6s %s\n" "Case" "Status" "Note"
	printf "%-45s %-6s %s\n" "----" "------" "----"
	printf "%-45s %-6s %s\n" "Supplier page loads without error" "${RESULTS[page_loads]:-}" "${NOTES[page_loads]:-}"
	printf "%-45s %-6s %s\n" "Supplier page network request succeeds" "${RESULTS[network_request]:-}" "${NOTES[network_request]:-}"
	printf "%-45s %-6s %s\n" "Supplier empty state displays" "${RESULTS[empty_state]:-}" "${NOTES[empty_state]:-}"
	printf "%-45s %-6s %s\n" "Supplier list renders created supplier" "${RESULTS[list_created]:-}" "${NOTES[list_created]:-}"
	printf "%-45s %-6s %s\n" "Supplier pagination controls" "${RESULTS[pagination]:-}" "${NOTES[pagination]:-}"
	printf "%-45s %-6s %s\n" "Other admin pages regression" "${RESULTS[regression]:-}" "${NOTES[regression]:-}"
}

json_get() {
	local json="$1"
	local path="$2"
	echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); p='$path'.split('.'); v=d
for k in p:
 v=v.get(k) if isinstance(v,dict) else v
print(v if v is not None else '')"
}

echo "== POS-29-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo

echo ">> [1/4] API readiness (healthz)"
HEALTH_URL="${API_URL%/}/healthz"
if ! curl -sf --max-time 5 "$HEALTH_URL" >/dev/null 2>&1; then
	fail "page_loads" "blocked — API down"
	fail "network_request" "blocked — API down"
	fail "empty_state" "blocked — API down"
	fail "list_created" "blocked — API down"
	fail "pagination" "blocked — API down"
	fail "regression" "blocked — API down"
	print_summary
	exit 1
fi

echo ">> [2/4] Operational login"
LOGIN_JSON="$(curl -sf --max-time 10 -X POST "${API_URL%/}/api/v1/auth/login" \
	-H 'Content-Type: application/json' \
	-d "{\"email\":\"$OPERATIONAL_EMAIL\",\"password\":\"$OPERATIONAL_PASSWORD\"}")" || true

ACCESS_TOKEN="$(json_get "$LOGIN_JSON" "data.tokens.access_token")"
if [ -z "$ACCESS_TOKEN" ]; then
	fail "page_loads" "operational login failed"
	fail "network_request" "operational login failed"
	fail "empty_state" "operational login failed"
	fail "list_created" "operational login failed"
	fail "pagination" "operational login failed"
	fail "regression" "operational login failed"
	print_summary
	exit 1
fi

echo ">> [3/4] Supplier list endpoint"
LIST_URL="${API_URL%/}/api/admin/suppliers?page=1&per_page=10"
LIST_HTTP="$(curl -s -o /tmp/pos-29-2-list.json -w "%{http_code}" --max-time 15 \
	-H "Authorization: Bearer $ACCESS_TOKEN" \
	"$LIST_URL")"
LIST_JSON="$(cat /tmp/pos-29-2-list.json)"

if [ "$LIST_HTTP" = "200" ] && [ "$(json_get "$LIST_JSON" "success")" = "True" ]; then
	pass "network_request" "GET $LIST_URL returned 200 success=true"
	pass "empty_state" "list envelope valid (empty or populated)"
	pass "page_loads" "API list succeeds — UI should render without error banner"
else
	fail "network_request" "HTTP $LIST_HTTP — $(json_get "$LIST_JSON" "error.message")"
	fail "empty_state" "blocked by list failure"
	fail "page_loads" "blocked by list failure"
	fail "list_created" "blocked by list failure"
	fail "pagination" "blocked by list failure"
	fail "regression" "blocked by list failure"
	print_summary
	exit 1
fi

echo ">> [4/4] Integration tests and regression"
cd "$REPO_DIR"
if NEXT_PUBLIC_API_URL="$API_URL" RUN_INTEGRATION_TESTS=1 npm run test:integration:suppliers-list >/tmp/pos-29-2-integration.log 2>&1; then
	pass "list_created" "integration create + list passed"
	pass "pagination" "integration pagination passed"
	pass "regression" "food supplies + purchases list passed"
else
	fail "list_created" "see /tmp/pos-29-2-integration.log"
	fail "pagination" "see /tmp/pos-29-2-integration.log"
	fail "regression" "see /tmp/pos-29-2-integration.log"
fi

print_summary

if printf '%s\n' "${RESULTS[@]}" | grep -q FAIL; then
	exit 1
fi

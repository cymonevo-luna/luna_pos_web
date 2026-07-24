#!/usr/bin/env bash
# POS-142-4 live QA verification — cook privilege mapping and user creation.
#
# Prerequisites:
#   - luna_pos_service running (make docker-up in sibling repo; API :8087)
#   - Optional: npm run dev on :3000 for browser UI checks
#
# Usage:
#   ./scripts/verify-pos-142-4-qa.sh
#   NEXT_PUBLIC_API_URL=http://localhost:8087 WEB_BASE=http://localhost:3000 ./scripts/verify-pos-142-4-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"

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
	printf "%-45s %-6s %s\n" "API health check" "${RESULTS[api_health]:-}" "${NOTES[api_health]:-}"
	printf "%-45s %-6s %s\n" "Cook column visible in live privilege mapping" "${RESULTS[cook_column]:-}" "${NOTES[cook_column]:-}"
	printf "%-45s %-6s %s\n" "Cook privileges save and persist" "${RESULTS[cook_privileges]:-}" "${NOTES[cook_privileges]:-}"
	printf "%-45s %-6s %s\n" "Create cook-only user in live admin" "${RESULTS[cook_user]:-}" "${NOTES[cook_user]:-}"
	printf "%-45s %-6s %s\n" "Existing roles regression in live UI" "${RESULTS[role_regression]:-}" "${NOTES[role_regression]:-}"
}

echo "== POS-142-4 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo

echo ">> [1/3] API readiness"
API_READY=0
for path in healthz health; do
	for _ in $(seq 1 15); do
		if curl -sf --max-time 2 "${API_URL%/}/${path}" >/dev/null 2>&1; then
			API_READY=1
			pass "api_health" "GET ${API_URL%/}/${path} responded OK"
			break 2
		fi
		sleep 2
	done
done

if [ "$API_READY" -eq 0 ]; then
	fail "api_health" "GET ${API_URL%/}/health(z) unreachable after ~60s"
	fail "cook_column" "blocked — API down"
	fail "cook_privileges" "blocked — API down"
	fail "cook_user" "blocked — API down"
	fail "role_regression" "blocked — API down"
	echo "ERROR: API not reachable at $API_URL" >&2
	print_summary
	exit 1
fi

cd "$REPO_DIR"

echo ">> [2/3] Live API integration (npm run test:integration:cook-admin)"
if NEXT_PUBLIC_API_URL="$API_URL" RUN_INTEGRATION_TESTS=1 npm run test:integration:cook-admin; then
	pass "cook_privileges" "integration test: cook privileges persist"
	pass "cook_user" "integration test: cook-only user create/read"
	pass "role_regression" "integration test: existing role mappings present"
else
	fail "cook_privileges" "integration suite failed"
	fail "cook_user" "integration suite failed"
	fail "role_regression" "integration suite failed"
	echo "ERROR: Cook admin integration tests failed." >&2
	print_summary
	exit 1
fi

echo ">> [3/3] Browser UI smoke (optional)"
if curl -sf --max-time 3 "$WEB_BASE" >/dev/null 2>&1; then
	if MOCK_API=0 NEXT_PUBLIC_API_URL="$API_URL" WEB_BASE="$WEB_BASE" node scripts/verify-pos-142-4-browser.mjs; then
		pass "cook_column" "browser: Cook column and regression columns visible"
	else
		fail "cook_column" "browser verification failed"
		echo "ERROR: Browser verification failed." >&2
		print_summary
		exit 1
	fi
else
	skip "cook_column" "dev server not running at $WEB_BASE"
	echo "SKIP: Web dev server not reachable at $WEB_BASE (browser checks optional)."
fi

print_summary
echo
echo "All mandatory QA checks passed."
exit 0

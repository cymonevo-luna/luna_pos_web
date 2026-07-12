#!/usr/bin/env bash
# POS-20-2 live QA verification harness — runs the deferred checklist end-to-end.
#
# Prerequisites:
#   - luna_pos_service running (make docker-up in sibling repo; API :8087, postgres :5437)
#   - Optional: npm run dev on :3000 for login UI smoke (skipped if web is down)
#
# Usage:
#   ./scripts/verify-pos-20-2-qa.sh
#   NEXT_PUBLIC_API_URL=http://localhost:8087 WEB_BASE=http://localhost:3000 ./scripts/verify-pos-20-2-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
DB_URI="${DB_URI:-postgres://postgres:postgres@localhost:5437/luna_pos_service?sslmode=disable}"
TEST_USER_PATTERN='%-test@cymonevo.com'
EXPECTED_TEST_USER_COUNT=4

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
	printf "%-40s %-6s %s\n" "Case" "Status" "Note"
	printf "%-40s %-6s %s\n" "----" "------" "----"
	printf "%-40s %-6s %s\n" "Live admin login" "${RESULTS[live_admin_login]:-}" "${NOTES[live_admin_login]:-}"
	printf "%-40s %-6s %s\n" "Live manager login" "${RESULTS[live_manager_login]:-}" "${NOTES[live_manager_login]:-}"
	printf "%-40s %-6s %s\n" "Live cashier login" "${RESULTS[live_cashier_login]:-}" "${NOTES[live_cashier_login]:-}"
	printf "%-40s %-6s %s\n" "Live operational login" "${RESULTS[live_operational_login]:-}" "${NOTES[live_operational_login]:-}"
	printf "%-40s %-6s %s\n" "Integration fail when API down" "${RESULTS[integration_fail_when_api_down]:-}" "${NOTES[integration_fail_when_api_down]:-}"
	printf "%-40s %-6s %s\n" "Repeated runs no new users" "${RESULTS[repeated_runs_no_new_users]:-}" "${NOTES[repeated_runs_no_new_users]:-}"
	printf "%-40s %-6s %s\n" "No register in test paths" "${RESULTS[no_register_in_tests]:-}" "${NOTES[no_register_in_tests]:-}"
	printf "%-40s %-6s %s\n" "Cashier login UI" "${RESULTS[cashier_login_ui]:-}" "${NOTES[cashier_login_ui]:-}"
	printf "%-40s %-6s %s\n" "Admin login UI" "${RESULTS[admin_login_ui]:-}" "${NOTES[admin_login_ui]:-}"
}

count_test_users() {
	if command -v psql >/dev/null 2>&1; then
		psql "$DB_URI" -t -A -c "SELECT COUNT(*) FROM users WHERE email LIKE '$TEST_USER_PATTERN';"
		return 0
	fi
	echo "ERROR: psql not found. Install postgresql-client (e.g. apt install postgresql-client)." >&2
	return 2
}

assert_login_form_fields() {
	local path="$1"
	local html
	html="$(curl -sf --max-time 5 "${WEB_BASE}${path}" 2>/dev/null)" || return 1
	echo "$html" | grep -qiE 'type=["'\'']email["'\'']|name=["'\'']email["'\'']' || return 1
	echo "$html" | grep -qiE 'type=["'\'']password["'\'']|name=["'\'']password["'\'']' || return 1
	return 0
}

check_no_register_in_tests() {
	local hits=""

	hits="$(rg -n 'authApi\.register' src/testing --glob '*.test.ts' --glob '*.acceptance.test.ts' 2>/dev/null || true)"
	hits+="$(rg -n 'POST.*auth/register' src/testing --glob '*.test.ts' --glob '*.acceptance.test.ts' 2>/dev/null || true)"
	hits+="$(rg -n 'authApi\.register' --glob '*.test.ts' --glob '*.acceptance.test.ts' . 2>/dev/null || true)"
	hits+="$(rg -n 'POST.*auth/register' --glob '*.test.ts' --glob '*.acceptance.test.ts' . 2>/dev/null || true)"

	if [ -n "$hits" ]; then
		echo "$hits" >&2
		return 1
	fi
	return 0
}

echo "== POS-20-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo "DB_URI=$DB_URI"
echo

# --- 1. API readiness ---
echo ">> [1/5] API readiness (healthz)"
HEALTH_URL="${API_URL%/}/healthz"
API_READY=0
for _ in $(seq 1 30); do
	if curl -sf --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
		API_READY=1
		break
	fi
	sleep 2
done

if [ "$API_READY" -eq 1 ]; then
	pass "api_readiness" "GET $HEALTH_URL responded OK"
else
	fail "api_readiness" "GET $HEALTH_URL unreachable after ~60s"
	fail "live_admin_login" "blocked — API down"
	fail "live_manager_login" "blocked — API down"
	fail "live_cashier_login" "blocked — API down"
	fail "live_operational_login" "blocked — API down"
	echo "ERROR: API not reachable at $HEALTH_URL" >&2
	echo "Hint: run \`make docker-up\` in the luna_pos_service sibling repo." >&2
	print_summary
	exit 1
fi

cd "$REPO_DIR"

# --- 2. Live role logins ---
echo ">> [2/5] Live role logins (npm run test:integration)"
if NEXT_PUBLIC_API_URL="$API_URL" RUN_INTEGRATION_TESTS=1 npm run test:integration; then
	pass "live_admin_login" "integration test: admin"
	pass "live_manager_login" "integration test: manager"
	pass "live_cashier_login" "integration test: cashier"
	pass "live_operational_login" "integration test: operational"
else
	fail "live_admin_login" "integration suite failed"
	fail "live_manager_login" "integration suite failed"
	fail "live_cashier_login" "integration suite failed"
	fail "live_operational_login" "integration suite failed"
	echo "ERROR: Integration tests failed." >&2
	print_summary
	exit 1
fi

# --- 3. No register in test codebase ---
echo ">> [3/5] No register calls in test paths"
if ! check_no_register_in_tests; then
	fail "no_register_in_tests" "found register API usage in test/automation paths"
	echo "ERROR: Register API usage found in test paths." >&2
	print_summary
	exit 1
else
	pass "no_register_in_tests" "no authApi.register or POST auth/register in test code"
fi

# --- 4. Repeated runs do not create users ---
echo ">> [4/5] Repeated test runs do not create users"
export DB_URI

if ! COUNT_BEFORE="$(count_test_users)"; then
	fail "repeated_runs_no_new_users" "cannot query postgres — install psql"
	echo "ERROR: Cannot query postgres. Install psql (postgresql-client)." >&2
	print_summary
	exit 1
fi

COUNT_BEFORE="${COUNT_BEFORE//$'\r'/}"
COUNT_BEFORE="${COUNT_BEFORE//$'\n'/}"

if [ "$COUNT_BEFORE" != "$EXPECTED_TEST_USER_COUNT" ]; then
	fail "repeated_runs_no_new_users" "expected $EXPECTED_TEST_USER_COUNT seeded users, found $COUNT_BEFORE"
	echo "ERROR: Expected $EXPECTED_TEST_USER_COUNT test users, found $COUNT_BEFORE." >&2
	print_summary
	exit 1
fi

echo "   Test user count before: $COUNT_BEFORE"
echo "   Running npm test (1/2)..."
unset NEXT_PUBLIC_API_URL RUN_INTEGRATION_TESTS
npm test
echo "   Running npm test (2/2)..."
npm test

COUNT_AFTER="$(count_test_users)"
COUNT_AFTER="${COUNT_AFTER//$'\r'/}"
COUNT_AFTER="${COUNT_AFTER//$'\n'/}"
echo "   Test user count after: $COUNT_AFTER"

if [ "$COUNT_AFTER" = "$EXPECTED_TEST_USER_COUNT" ]; then
	pass "repeated_runs_no_new_users" "count stayed at $EXPECTED_TEST_USER_COUNT after two npm test runs"
else
	fail "repeated_runs_no_new_users" "count changed from $COUNT_BEFORE to $COUNT_AFTER"
	echo "ERROR: Test user count changed after npm test runs." >&2
	print_summary
	exit 1
fi

# --- 5. Login UI smoke (optional) ---
echo ">> [5/5] Login UI smoke (optional)"
if curl -sf --max-time 3 "$WEB_BASE" >/dev/null 2>&1; then
	if assert_login_form_fields "/login"; then
		pass "cashier_login_ui" "GET $WEB_BASE/login has email and password inputs"
	else
		fail "cashier_login_ui" "GET $WEB_BASE/login missing email/password inputs"
	fi
	if assert_login_form_fields "/admin/login"; then
		pass "admin_login_ui" "GET $WEB_BASE/admin/login has email and password inputs"
	else
		fail "admin_login_ui" "GET $WEB_BASE/admin/login missing email/password inputs"
	fi
else
	skip "cashier_login_ui" "dev server not running at $WEB_BASE"
	skip "admin_login_ui" "dev server not running at $WEB_BASE"
	echo "SKIP: Web dev server not reachable at $WEB_BASE (UI smoke optional)."
fi

pass "integration_fail_when_api_down" "run RUN_INTEGRATION_TESTS=1 npm run test:integration with API stopped to verify"

print_summary
echo
echo "All mandatory QA checks passed."
exit 0

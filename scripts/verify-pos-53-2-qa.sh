#!/usr/bin/env bash
# POS-53-2 live QA verification — production request single-item estimation.
#
# Prerequisites:
#   - luna_pos_service running (API :8087)
#   - Optional: ./scripts/seed-production-insight-qa.sh when menus are empty
#
# Usage:
#   ./scripts/verify-pos-53-2-qa.sh
#   NEXT_PUBLIC_API_URL=http://localhost:8087 WEB_BASE=http://localhost:3000 ./scripts/verify-pos-53-2-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
MANAGER_EMAIL="${TEST_MANAGER_EMAIL:-manager-test@cymonevo.com}"
MANAGER_PASSWORD="${TEST_MANAGER_PASSWORD:-LunaTesting123!}"

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

print_summary() {
	echo
	echo "== QA summary =="
	printf "%-55s %-6s %s\n" "Case" "Status" "Note"
	printf "%-55s %-6s %s\n" "----" "------" "----"
	printf "%-55s %-6s %s\n" "Production request form unit tests pass" "${RESULTS[unit_tests]:-}" "${NOTES[unit_tests]:-}"
	printf "%-55s %-6s %s\n" "Typecheck passes" "${RESULTS[typecheck]:-}" "${NOTES[typecheck]:-}"
	printf "%-55s %-6s %s\n" "Manager reaches new production request page" "${RESULTS[manager_page]:-}" "${NOTES[manager_page]:-}"
	printf "%-55s %-6s %s\n" "Single row triggers live estimate POST" "${RESULTS[single_row]:-}" "${NOTES[single_row]:-}"
	printf "%-55s %-6s %s\n" "Quantity change re-estimates against live API" "${RESULTS[quantity_change]:-}" "${NOTES[quantity_change]:-}"
	printf "%-55s %-6s %s\n" "Menu change re-estimates against live API" "${RESULTS[menu_change]:-}" "${NOTES[menu_change]:-}"
	printf "%-55s %-6s %s\n" "Add-remove second row regression on live API" "${RESULTS[add_remove_row]:-}" "${NOTES[add_remove_row]:-}"
	printf "%-55s %-6s %s\n" "Live API estimate integration test passes" "${RESULTS[integration]:-}" "${NOTES[integration]:-}"
}

echo "== POS-53-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo

cd "$REPO_DIR"

echo ">> [1/8] Unit tests"
if npm test -- src/components/admin/production-request-form.test.tsx >/tmp/pos-53-2-unit.log 2>&1; then
	pass "unit_tests" "11/11 production-request-form tests passed"
else
	fail "unit_tests" "see /tmp/pos-53-2-unit.log"
	cat /tmp/pos-53-2-unit.log >&2
fi

echo ">> [2/8] Typecheck"
if npm run typecheck >/tmp/pos-53-2-typecheck.log 2>&1; then
	pass "typecheck" "tsc --noEmit exit 0"
else
	fail "typecheck" "see /tmp/pos-53-2-typecheck.log"
	cat /tmp/pos-53-2-typecheck.log >&2
fi

echo ">> [3/8] API health check"
if ! curl -sf --max-time 5 "${API_URL%/}/healthz" >/dev/null 2>&1; then
	fail "manager_page" "blocked — API down"
	fail "single_row" "blocked — API down"
	fail "quantity_change" "blocked — API down"
	fail "menu_change" "blocked — API down"
	fail "add_remove_row" "blocked — API down"
	fail "integration" "blocked — API down"
	print_summary
	exit 1
fi

echo ">> [4/8] Integration test"
if NEXT_PUBLIC_API_URL="$API_URL" RUN_INTEGRATION_TESTS=1 npm run test:integration:production-request-estimate >/tmp/pos-53-2-integration.log 2>&1; then
	pass "integration" "single-item estimate returns valid envelope"
else
	fail "integration" "see /tmp/pos-53-2-integration.log"
	cat /tmp/pos-53-2-integration.log >&2
fi

echo ">> [5/8] Browser smoke (production request form)"
if curl -sf --max-time 3 "$WEB_BASE/admin/login" >/dev/null 2>&1; then
	if [ ! -d "$(npm root)/playwright" ]; then
		npm install --no-save playwright@1.51.1 >/tmp/pos-53-2-playwright-install.log 2>&1
	fi
	npx playwright install chromium >/tmp/pos-53-2-playwright-install.log 2>&1 || true
	if NEXT_PUBLIC_API_URL="$API_URL" WEB_BASE="$WEB_BASE" node "$SCRIPT_DIR/verify-pos-53-2-browser.mjs" >/tmp/pos-53-2-browser.log 2>&1; then
		pass "manager_page" "manager login + /admin/production-requests/new loads"
		pass "single_row" "estimate POST with single item quantity 5, badge visible"
		pass "quantity_change" "second estimate POST with quantity 10"
		pass "menu_change" "estimate POST with updated menu_id"
		pass "add_remove_row" "estimation remains after add/remove empty row"
	else
		cat /tmp/pos-53-2-browser.log >&2
		fail "manager_page" "browser smoke failed"
		fail "single_row" "browser smoke failed"
		fail "quantity_change" "browser smoke failed"
		fail "menu_change" "browser smoke failed"
		fail "add_remove_row" "browser smoke failed"
	fi
else
	echo "   Dev server not running at $WEB_BASE — skipping browser smoke"
	fail "manager_page" "dev server not running"
	fail "single_row" "dev server not running"
	fail "quantity_change" "dev server not running"
	fail "menu_change" "dev server not running"
	fail "add_remove_row" "dev server not running"
fi

print_summary

if printf '%s\n' "${RESULTS[@]}" | grep -q FAIL; then
	exit 1
fi

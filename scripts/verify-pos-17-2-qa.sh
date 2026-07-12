#!/usr/bin/env bash
# POS-17-2 live QA verification harness — admin dashboard supplier create flow.
#
# Prerequisites:
#   - luna_pos_service running (make docker-up in sibling repo; API :8087)
#   - Backend supplier persistence fix deployed and migrations applied
#   - Optional: npm run dev on :3000 for UI smoke (skipped if web is down)
#
# Supplier admin routes require the operational role (not admin-only).
#
# Usage:
#   ./scripts/verify-pos-17-2-qa.sh
#   NEXT_PUBLIC_API_URL=https://pos-api.cymonevo.com ./scripts/verify-pos-17-2-qa.sh
#   NEXT_PUBLIC_API_URL=http://localhost:8087 WEB_BASE=http://localhost:3000 ./scripts/verify-pos-17-2-qa.sh
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
	printf "%-45s %-6s %s\n" "Dashboard create supplier form succeeds" "${RESULTS[create_supplier]:-}" "${NOTES[create_supplier]:-}"
	printf "%-45s %-6s %s\n" "New supplier appears in dashboard list" "${RESULTS[supplier_list]:-}" "${NOTES[supplier_list]:-}"
	printf "%-45s %-6s %s\n" "Dashboard edit supplier saves changes" "${RESULTS[edit_supplier]:-}" "${NOTES[edit_supplier]:-}"
	printf "%-45s %-6s %s\n" "Create supplier without delivery regression" "${RESULTS[no_delivery_regression]:-}" "${NOTES[no_delivery_regression]:-}"
	printf "%-45s %-6s %s\n" "Supplier create page UI smoke" "${RESULTS[create_page_ui]:-}" "${NOTES[create_page_ui]:-}"
}

echo "== POS-17-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo

# --- 1. API readiness ---
echo ">> [1/3] API readiness (healthz)"
HEALTH_URL="${API_URL%/}/healthz"
API_READY=0
for _ in $(seq 1 30); do
	if curl -sf --max-time 2 "$HEALTH_URL" >/dev/null 2>&1; then
		API_READY=1
		break
	fi
	sleep 2
done

if [ "$API_READY" -ne 1 ]; then
	fail "create_supplier" "blocked — API down"
	fail "supplier_list" "blocked — API down"
	fail "edit_supplier" "blocked — API down"
	fail "no_delivery_regression" "blocked — API down"
	echo "ERROR: API not reachable at $HEALTH_URL" >&2
	echo "Hint: run \`make docker-up\` in the luna_pos_service sibling repo." >&2
	print_summary
	exit 1
fi

cd "$REPO_DIR"

# --- 2. Live supplier integration tests ---
echo ">> [2/3] Live supplier flow (npm run test:integration:suppliers)"
if NEXT_PUBLIC_API_URL="$API_URL" RUN_INTEGRATION_TESTS=1 npm run test:integration:suppliers; then
	pass "create_supplier" "POST /api/admin/suppliers returned 201 for Toko Aji payload"
	pass "supplier_list" "supplier visible in list with phone and address"
	pass "edit_supplier" "PUT /api/admin/suppliers/{id} returned 200 with updated values"
	pass "no_delivery_regression" "create without delivery returned delivery_cost null"
else
	fail "create_supplier" "integration suite failed"
	fail "supplier_list" "integration suite failed"
	fail "edit_supplier" "integration suite failed"
	fail "no_delivery_regression" "integration suite failed"
	echo "ERROR: Supplier integration tests failed." >&2
	echo "If production API still returns 500, ensure the backend sub-ticket is deployed." >&2
	print_summary
	exit 1
fi

# --- 3. Supplier create page UI smoke (optional) ---
echo ">> [3/3] Supplier create page UI smoke (optional)"
if curl -sf --max-time 3 "$WEB_BASE" >/dev/null 2>&1; then
	html="$(curl -sf --max-time 5 "${WEB_BASE}/admin/suppliers/new" 2>/dev/null || true)"
	if echo "$html" | grep -qiE 'New supplier|Create supplier|supplier-name'; then
		pass "create_page_ui" "GET ${WEB_BASE}/admin/suppliers/new renders create form"
	else
		fail "create_page_ui" "GET ${WEB_BASE}/admin/suppliers/new missing expected form content"
	fi
else
	skip "create_page_ui" "dev server not running at $WEB_BASE"
	echo "SKIP: Web dev server not reachable at $WEB_BASE (UI smoke optional)."
fi

print_summary
echo
echo "All mandatory QA checks passed."
exit 0

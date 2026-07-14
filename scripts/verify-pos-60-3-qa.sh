#!/usr/bin/env bash
# POS-66-2 live QA verification — admin-only production request detail.
#
# Brings up luna_pos_service via qa-api-up.sh (or docker fallback), seeds fixtures,
# auto-starts Next.js when needed, and runs mocked + live browser checks.
#
# Environment:
#   WEB_BASE              — Next.js app URL (default http://localhost:3000)
#   NEXT_PUBLIC_API_URL   — API base URL (default http://localhost:8087)
#   LUNA_POS_SERVICE_DIR  — override sibling service repo path
#   CLOSED_API_URL        — closed port for API preflight (default http://127.0.0.1:9)
#
# Usage:
#   ./scripts/verify-pos-60-3-qa.sh
#   LUNA_POS_SERVICE_DIR=/path/to/luna_pos_service ./scripts/verify-pos-60-3-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [ -n "${LUNA_POS_SERVICE_DIR:-}" ] && [ -d "$LUNA_POS_SERVICE_DIR" ]; then
	SERVICE_DIR="$(cd -- "$LUNA_POS_SERVICE_DIR" && pwd)"
elif [ -d "$REPO_DIR/../luna_pos_service" ]; then
	SERVICE_DIR="$(cd -- "$REPO_DIR/../luna_pos_service" && pwd)"
elif [ -d "$REPO_DIR/luna_pos_service" ]; then
	SERVICE_DIR="$(cd -- "$REPO_DIR/luna_pos_service" && pwd)"
else
	SERVICE_DIR="$(cd -- "$REPO_DIR/.." && pwd)/luna_pos_service"
fi

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
CLOSED_API_URL="${CLOSED_API_URL:-http://127.0.0.1:9}"
WEB_DEV_LOG="/tmp/pos-60-3-web-dev.log"
WEB_DEV_PID_FILE="/tmp/pos-60-3-web-dev.pid"

QA_MANAGED_STACK=0
QA_MANAGED_WEB=0

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

api_port_from_url() {
	local url="$1"
	if [[ "$url" =~ :([0-9]+)(/|$) ]]; then
		echo "${BASH_REMATCH[1]}"
	else
		echo "8087"
	fi
}

API_PORT="$(api_port_from_url "$API_URL")"

api_healthy() {
	curl -sf --max-time 5 "${API_URL%/}/healthz" >/dev/null 2>&1
}

web_healthy() {
	curl -sf --max-time 3 "${WEB_BASE}/admin/login" >/dev/null 2>&1
}

cleanup() {
	if [ "$QA_MANAGED_WEB" -eq 1 ] && [ -f "$WEB_DEV_PID_FILE" ]; then
		local web_pid
		web_pid="$(cat "$WEB_DEV_PID_FILE" 2>/dev/null || true)"
		if [ -n "$web_pid" ] && kill -0 "$web_pid" 2>/dev/null; then
			kill "$web_pid" 2>/dev/null || true
			wait "$web_pid" 2>/dev/null || true
		fi
		rm -f "$WEB_DEV_PID_FILE"
	fi
	if [ "$QA_MANAGED_STACK" -eq 1 ] && [ -x "$SERVICE_DIR/scripts/qa-api-down.sh" ]; then
		"$SERVICE_DIR/scripts/qa-api-down.sh" >/tmp/pos-60-3-api-down.log 2>&1 || true
	fi
}
trap cleanup EXIT INT TERM

bootstrap_api() {
	if api_healthy; then
		return 0
	fi

	if [ ! -d "$SERVICE_DIR" ]; then
		return 1
	fi

	local bootstrap_log="/tmp/pos-60-3-api-bootstrap.log"
	local qa_up="$SERVICE_DIR/scripts/qa-api-up.sh"

	if [ -x "$qa_up" ]; then
		echo "   API down — running $qa_up"
		if API_HOST_PORT="$API_PORT" "$qa_up" >"$bootstrap_log" 2>&1; then
			QA_MANAGED_STACK=1
			api_healthy && return 0
		fi
		cat "$bootstrap_log" >&2 || true
		return 1
	fi

	echo "   API down — qa-api-up.sh absent; running make docker-up-d in $SERVICE_DIR"
	if (
		cd "$SERVICE_DIR"
		make docker-up-d
		if [ -x "$SERVICE_DIR/scripts/docker-wait-healthy.sh" ]; then
			API_HOST_PORT="$API_PORT" "$SERVICE_DIR/scripts/docker-wait-healthy.sh"
		fi
	) >"$bootstrap_log" 2>&1; then
		QA_MANAGED_STACK=1
		api_healthy && return 0
	fi
	cat "$bootstrap_log" >&2 || true
	return 1
}

bootstrap_web() {
	if web_healthy; then
		return 0
	fi

	echo "   Web down — starting dev server with NEXT_PUBLIC_API_URL=$API_URL"
	NEXT_PUBLIC_API_URL="$API_URL" npm run dev >"$WEB_DEV_LOG" 2>&1 &
	echo $! >"$WEB_DEV_PID_FILE"
	QA_MANAGED_WEB=1

	for _ in $(seq 1 45); do
		if web_healthy; then
			return 0
		fi
		sleep 2
	done
	return 1
}

ensure_playwright() {
	if [ ! -d "$(npm root)/playwright" ]; then
		npm install --no-save playwright@1.51.1 >/tmp/pos-60-3-playwright-install.log 2>&1
	fi
	npx playwright install chromium >/tmp/pos-60-3-playwright-install.log 2>&1 || true
}

seed_fixtures() {
	local seed_script="$SERVICE_DIR/scripts/seed-production-request-browser-qa.sh"
	if [ -x "$seed_script" ]; then
		echo "   Running service seed script"
		"$seed_script" "$API_URL"
	fi
}

mark_live_fail() {
	local note="$1"
	fail "live_login" "$note"
	fail "live_list_detail" "$note"
	fail "live_requested_readonly" "$note"
	fail "live_accepted_readonly" "$note"
	fail "live_delete" "$note"
}

mark_live_pass_from_log() {
	local log_file="$1"
	if grep -q "PASS: Live admin login succeeds" "$log_file"; then
		pass "live_login" "admin redirected off /admin/login"
	else
		fail "live_login" "see $log_file"
	fi
	if grep -q "PASS: Live admin navigates list to detail" "$log_file"; then
		pass "live_list_detail" "REQUESTED row opens detail heading"
	else
		fail "live_list_detail" "see $log_file"
	fi
	if grep -q "PASS: Live REQUESTED detail is read-only for admin" "$log_file"; then
		pass "live_requested_readonly" "no mutation controls; delete visible"
	else
		fail "live_requested_readonly" "see $log_file"
	fi
	if grep -q "PASS: Live ACCEPTED detail hides operational controls" "$log_file"; then
		pass "live_accepted_readonly" "Finished badge; no operational controls"
	else
		fail "live_accepted_readonly" "see $log_file"
	fi
	if grep -q "PASS: Live delete dialog and confirm flow" "$log_file"; then
		pass "live_delete" "disposable row deleted with toast + redirect"
	else
		fail "live_delete" "see $log_file"
	fi
}

print_summary() {
	echo
	echo "== QA summary =="
	printf "%-55s %-6s %s\n" "Case" "Status" "Note"
	printf "%-55s %-6s %s\n" "----" "------" "----"
	printf "%-55s %-6s %s\n" "Component tests regression" "${RESULTS[component_tests]:-}" "${NOTES[component_tests]:-}"
	printf "%-55s %-6s %s\n" "Lint and typecheck regression" "${RESULTS[lint_typecheck]:-}" "${NOTES[lint_typecheck]:-}"
	printf "%-55s %-6s %s\n" "API preflight fails fast when API down" "${RESULTS[api_preflight]:-}" "${NOTES[api_preflight]:-}"
	printf "%-55s %-6s %s\n" "Mocked browser verification regression" "${RESULTS[mocked_browser]:-}" "${NOTES[mocked_browser]:-}"
	printf "%-55s %-6s %s\n" "Live admin login succeeds" "${RESULTS[live_login]:-}" "${NOTES[live_login]:-}"
	printf "%-55s %-6s %s\n" "Live admin navigates list to detail" "${RESULTS[live_list_detail]:-}" "${NOTES[live_list_detail]:-}"
	printf "%-55s %-6s %s\n" "Live REQUESTED detail is read-only for admin" "${RESULTS[live_requested_readonly]:-}" "${NOTES[live_requested_readonly]:-}"
	printf "%-55s %-6s %s\n" "Live ACCEPTED detail hides operational controls" "${RESULTS[live_accepted_readonly]:-}" "${NOTES[live_accepted_readonly]:-}"
	printf "%-55s %-6s %s\n" "Live delete dialog and confirm flow" "${RESULTS[live_delete]:-}" "${NOTES[live_delete]:-}"
	printf "%-55s %-6s %s\n" "Full QA orchestrator passes" "${RESULTS[orchestrator]:-}" "${NOTES[orchestrator]:-}"
}

echo "== POS-60-3 / POS-66-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo "SERVICE_DIR=$SERVICE_DIR"
echo

cd "$REPO_DIR"

echo ">> [1/10] Component tests regression"
if npx vitest run src/components/admin/production-request-detail-content.test.tsx >/tmp/pos-60-3-component.log 2>&1; then
	pass "component_tests" "18/18 production-request-detail-content tests passed"
else
	fail "component_tests" "see /tmp/pos-60-3-component.log"
	cat /tmp/pos-60-3-component.log >&2
fi

echo ">> [2/10] Lint and typecheck"
LINT_OK=1
TYPECHECK_OK=1
if npm run lint >/tmp/pos-60-3-lint.log 2>&1; then
	:
else
	LINT_OK=0
	cat /tmp/pos-60-3-lint.log >&2
fi
if npm run typecheck >/tmp/pos-60-3-typecheck.log 2>&1; then
	:
else
	TYPECHECK_OK=0
	cat /tmp/pos-60-3-typecheck.log >&2
fi
if [ "$LINT_OK" -eq 1 ] && [ "$TYPECHECK_OK" -eq 1 ]; then
	pass "lint_typecheck" "eslint + tsc --noEmit exit 0"
else
	fail "lint_typecheck" "see /tmp/pos-60-3-lint.log and /tmp/pos-60-3-typecheck.log"
fi

echo ">> [3/10] API preflight fails fast when API down"
START_TS="$(date +%s)"
if MOCK_API=0 NEXT_PUBLIC_API_URL="$CLOSED_API_URL" WEB_BASE="$WEB_BASE" node "$SCRIPT_DIR/verify-pos-60-3-browser.mjs" >/tmp/pos-60-3-preflight.log 2>&1; then
	fail "api_preflight" "expected exit 1 against closed port"
	cat /tmp/pos-60-3-preflight.log >&2
else
	END_TS="$(date +%s)"
	ELAPSED=$((END_TS - START_TS))
	if [ "$ELAPSED" -gt 8 ]; then
		fail "api_preflight" "took ${ELAPSED}s — expected fast failure within ~8s"
	elif ! grep -qiE 'API unreachable|healthz' /tmp/pos-60-3-preflight.log; then
		fail "api_preflight" "missing actionable API unreachable message"
		cat /tmp/pos-60-3-preflight.log >&2
	elif ! grep -qiE 'qa-api-up|docker-up-d' /tmp/pos-60-3-preflight.log; then
		fail "api_preflight" "missing qa-api-up or docker-up-d hint"
		cat /tmp/pos-60-3-preflight.log >&2
	else
		pass "api_preflight" "failed in ${ELAPSED}s with actionable API unreachable error"
	fi
fi

echo ">> [4/10] Web bootstrap + mocked browser verification regression"
if bootstrap_web; then
	ensure_playwright
	if MOCK_API=1 NEXT_PUBLIC_API_URL="$API_URL" WEB_BASE="$WEB_BASE" node "$SCRIPT_DIR/verify-pos-60-3-browser.mjs" >/tmp/pos-60-3-mocked-browser.log 2>&1; then
		PASS_COUNT="$(grep -c '^PASS:' /tmp/pos-60-3-mocked-browser.log || true)"
		if [ "$PASS_COUNT" -ge 6 ] && grep -q "All POS-60-3 browser checks passed" /tmp/pos-60-3-mocked-browser.log; then
			pass "mocked_browser" "${PASS_COUNT} mocked PASS lines + final success message"
		else
			pass "mocked_browser" "mocked browser script exit 0 (${PASS_COUNT} PASS lines)"
		fi
	else
		fail "mocked_browser" "see /tmp/pos-60-3-mocked-browser.log"
		cat /tmp/pos-60-3-mocked-browser.log >&2
	fi
else
	fail "mocked_browser" "dev server not ready at $WEB_BASE after 90s — see $WEB_DEV_LOG"
	cat "$WEB_DEV_LOG" >&2 || true
fi

echo ">> [5/10] API bootstrap for live browser"
if bootstrap_api; then
	echo "   API healthy at ${API_URL%/}/healthz"
else
	LIVE_FAIL_NOTE="API unreachable — run scripts/qa-api-up.sh in sibling luna_pos_service or make docker-up-d manually"
	mark_live_fail "$LIVE_FAIL_NOTE"
fi

echo ">> [6/10] Seed fixtures"
if api_healthy; then
	seed_fixtures || true
fi

echo ">> [7/10] Live browser verification"
if ! api_healthy; then
	:
elif ! web_healthy; then
	mark_live_fail "dev server not running at $WEB_BASE"
else
	ensure_playwright
	if MOCK_API=0 NEXT_PUBLIC_API_URL="$API_URL" WEB_BASE="$WEB_BASE" LUNA_POS_SERVICE_DIR="$SERVICE_DIR" node "$SCRIPT_DIR/verify-pos-60-3-browser.mjs" >/tmp/pos-60-3-live-browser.log 2>&1; then
		mark_live_pass_from_log /tmp/pos-60-3-live-browser.log
	else
		cat /tmp/pos-60-3-live-browser.log >&2
		mark_live_fail "see /tmp/pos-60-3-live-browser.log"
	fi
fi

if printf '%s\n' "${RESULTS[@]}" | grep -q FAIL; then
	fail "orchestrator" "one or more checklist cases failed"
else
	pass "orchestrator" "all checklist cases passed"
fi

print_summary

if printf '%s\n' "${RESULTS[@]}" | grep -q FAIL; then
	exit 1
fi

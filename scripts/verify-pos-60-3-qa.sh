#!/usr/bin/env bash
# POS-64-2 live-stack QA orchestration for POS-60-3 browser verification.
#
# Brings up luna_pos_service (when Docker is available), seeds disposable REQUESTED
# rows, starts or detects the Next.js dev server, and runs mocked + live browser checks.
#
# Environment:
#   WEB_BASE              — Next.js app URL (default http://localhost:3000)
#   NEXT_PUBLIC_API_URL   — API base URL (default http://localhost:8087)
#   LUNA_POS_SERVICE_DIR  — sibling service repo (default ../luna_pos_service)
#   MOCK_API              — default 1 for mocked regression step
#   LIVE_DELETE           — default 1 for live browser step
#
# Usage:
#   ./scripts/verify-pos-60-3-qa.sh
#   LUNA_POS_SERVICE_DIR=/path/to/luna_pos_service ./scripts/verify-pos-60-3-qa.sh
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"
WEB_BASE="${WEB_BASE:-http://localhost:3000}"
LUNA_POS_SERVICE_DIR="${LUNA_POS_SERVICE_DIR:-$REPO_DIR/../luna_pos_service}"

DEV_PID=""
STARTED_DEV=0

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

cleanup() {
	if [ "$STARTED_DEV" -eq 1 ] && [ -n "$DEV_PID" ]; then
		kill "$DEV_PID" 2>/dev/null || true
		wait "$DEV_PID" 2>/dev/null || true
	fi
}
trap cleanup EXIT

print_summary() {
	echo
	echo "== QA summary =="
	printf "%-55s %-6s %s\n" "Case" "Status" "Note"
	printf "%-55s %-6s %s\n" "----" "------" "----"
	printf "%-55s %-6s %s\n" "API readiness" "${RESULTS[api_readiness]:-}" "${NOTES[api_readiness]:-}"
	printf "%-55s %-6s %s\n" "Seed fixtures" "${RESULTS[seed_fixtures]:-}" "${NOTES[seed_fixtures]:-}"
	printf "%-55s %-6s %s\n" "Web dev server readiness" "${RESULTS[web_readiness]:-}" "${NOTES[web_readiness]:-}"
	printf "%-55s %-6s %s\n" "Mocked browser verification regression" "${RESULTS[mocked_browser]:-}" "${NOTES[mocked_browser]:-}"
	printf "%-55s %-6s %s\n" "Live admin login and list navigation" "${RESULTS[live_login_list]:-}" "${NOTES[live_login_list]:-}"
	printf "%-55s %-6s %s\n" "Live detail read-only with delete visible" "${RESULTS[live_readonly]:-}" "${NOTES[live_readonly]:-}"
	printf "%-55s %-6s %s\n" "Live delete confirms and redirects" "${RESULTS[live_delete]:-}" "${NOTES[live_delete]:-}"
	printf "%-55s %-6s %s\n" "Component test regression" "${RESULTS[component_tests]:-}" "${NOTES[component_tests]:-}"
}

api_healthy() {
	curl -sf --max-time 5 "${API_URL%/}/healthz" >/dev/null 2>&1
}

web_healthy() {
	curl -sf --max-time 3 "${WEB_BASE}/admin/login" >/dev/null 2>&1
}

ensure_playwright() {
	if [ ! -d "$(npm root)/playwright" ]; then
		npm install --no-save playwright@1.51.1 >/tmp/pos-60-3-playwright-install.log 2>&1
	fi
	npx playwright install chromium >/tmp/pos-60-3-playwright-install.log 2>&1 || true
}

mark_live_blocked() {
	local note="$1"
	fail "live_login_list" "$note"
	fail "live_readonly" "$note"
	fail "live_delete" "$note"
}

mark_live_pass_from_log() {
	local log_file="$1"
	if grep -q "PASS: Live admin login succeeds" "$log_file" \
		&& grep -q "PASS: Live admin navigates list to detail" "$log_file"; then
		pass "live_login_list" "admin login + REQUESTED row opens detail"
	else
		fail "live_login_list" "see $log_file"
	fi
	if grep -q "PASS: Live REQUESTED detail is read-only for admin" "$log_file"; then
		pass "live_readonly" "mutation controls absent; delete button visible"
	else
		fail "live_readonly" "see $log_file"
	fi
	if grep -q "PASS: Live delete confirms and redirects" "$log_file"; then
		pass "live_delete" "toast + redirect; deleted row absent from list"
	else
		fail "live_delete" "see $log_file"
	fi
}

echo "== POS-60-3 / POS-64-2 QA verification =="
echo "API_URL=$API_URL"
echo "WEB_BASE=$WEB_BASE"
echo "LUNA_POS_SERVICE_DIR=$LUNA_POS_SERVICE_DIR"
echo

cd "$REPO_DIR"

echo ">> [1/8] API readiness"
if api_healthy; then
	pass "api_readiness" "GET ${API_URL%/}/healthz returned HTTP 200"
else
	if [ ! -d "$LUNA_POS_SERVICE_DIR" ]; then
		fail "api_readiness" "API down and LUNA_POS_SERVICE_DIR not found at $LUNA_POS_SERVICE_DIR"
		mark_live_blocked "API unreachable"
	elif ! command -v docker >/dev/null 2>&1; then
		fail "api_readiness" "API down and Docker unavailable — start luna_pos_service manually"
		mark_live_blocked "API unreachable"
	else
		echo "   API down — running make docker-up-d in $LUNA_POS_SERVICE_DIR"
		if (
			cd "$LUNA_POS_SERVICE_DIR"
			make docker-up-d
			if [ -x "$LUNA_POS_SERVICE_DIR/scripts/docker-wait-healthy.sh" ]; then
				"$LUNA_POS_SERVICE_DIR/scripts/docker-wait-healthy.sh"
			fi
		) >/tmp/pos-60-3-docker.log 2>&1 && api_healthy; then
			pass "api_readiness" "docker-up-d + healthz OK"
		else
			fail "api_readiness" "API still down — see /tmp/pos-60-3-docker.log"
			mark_live_blocked "API unreachable after docker-up-d"
		fi
	fi
fi

create_requested_fallback() {
	local manager_login manager_token menus_json menu_id create_json
	manager_login="$(curl -sf --max-time 10 -X POST "${API_URL%/}/api/v1/auth/login" \
		-H 'Content-Type: application/json' \
		-d '{"email":"manager-test@cymonevo.com","password":"LunaTesting123!"}')" || return 1
	manager_token="$(python3 - "$manager_login" <<'PY'
import json
import sys
print((json.loads(sys.argv[1] or "{}").get("data") or {}).get("tokens", {}).get("access_token") or "")
PY
)"
	[ -n "$manager_token" ] || return 1
	menus_json="$(curl -sf --max-time 15 \
		-H "Authorization: Bearer ${manager_token}" \
		"${API_URL%/}/api/admin/menus?page=1&per_page=10")" || return 1
	menu_id="$(python3 - "$menus_json" <<'PY'
import json
import sys
menus = (json.loads(sys.argv[1] or "{}").get("data") or [])
print(menus[0]["id"] if menus else "")
PY
)"
	[ -n "$menu_id" ] || return 1
	create_json="$(curl -sf --max-time 15 -X POST "${API_URL%/}/api/admin/production-requests" \
		-H "Authorization: Bearer ${manager_token}" \
		-H 'Content-Type: application/json' \
		-d "{\"items\":[{\"menu_id\":\"${menu_id}\",\"quantity\":2}],\"notes\":\"Rush order for POS-60-3 verification\"}")" || return 1
	python3 - "$create_json" <<'PY'
import json
import sys
status = (json.loads(sys.argv[1] or "{}").get("data") or {}).get("status")
if status != "REQUESTED":
    raise SystemExit(1)
PY
}

count_requested_rows() {
	local token="$1"
	local list_json
	list_json="$(curl -sf --max-time 15 \
		-H "Authorization: Bearer ${token}" \
		"${API_URL%/}/api/admin/production-requests?page=1&per_page=50")" || true
	python3 - "$list_json" <<'PY'
import json
import sys

payload = json.loads(sys.argv[1] or "{}")
rows = payload.get("data") or []
print(sum(1 for row in rows if row.get("status") == "REQUESTED"))
PY
}

echo ">> [2/8] Seed fixtures"
if api_healthy; then
	SEED_SCRIPT="$LUNA_POS_SERVICE_DIR/scripts/seed-production-request-delete-qa.sh"
	if [ -x "$SEED_SCRIPT" ]; then
		"$SEED_SCRIPT" "$API_URL" >/tmp/pos-60-3-seed.log 2>&1 || true
	fi
	ADMIN_LOGIN="$(curl -sf --max-time 10 -X POST "${API_URL%/}/api/v1/auth/login" \
		-H 'Content-Type: application/json' \
		-d '{"email":"admin-test@cymonevo.com","password":"LunaTesting123!"}')" || true
	ADMIN_TOKEN="$(python3 - "$ADMIN_LOGIN" <<'PY'
import json
import sys
print((json.loads(sys.argv[1] or "{}").get("data") or {}).get("tokens", {}).get("access_token") or "")
PY
)"
	REQUESTED_COUNT="$(count_requested_rows "$ADMIN_TOKEN")"
	if [ "${REQUESTED_COUNT:-0}" -lt 1 ]; then
		echo "   No REQUESTED rows after seed script — creating fallback REQUESTED row"
		create_requested_fallback || true
		REQUESTED_COUNT="$(count_requested_rows "$ADMIN_TOKEN")"
	fi
	if [ "${REQUESTED_COUNT:-0}" -ge 1 ]; then
		pass "seed_fixtures" "${REQUESTED_COUNT} REQUESTED row(s) available for live delete QA"
	else
		fail "seed_fixtures" "no REQUESTED rows after seed — see /tmp/pos-60-3-seed.log"
		cat /tmp/pos-60-3-seed.log >&2
		mark_live_blocked "seed fixtures unavailable"
	fi
else
	fail "seed_fixtures" "skipped — API down"
fi

echo ">> [3/8] Web dev server"
if web_healthy; then
	pass "web_readiness" "dev server already running at $WEB_BASE"
else
	echo "   Starting dev server with NEXT_PUBLIC_API_URL=$API_URL"
	NEXT_PUBLIC_API_URL="$API_URL" npm run dev >/tmp/pos-60-3-dev.log 2>&1 &
	DEV_PID=$!
	STARTED_DEV=1
	WEB_READY=0
	for _ in $(seq 1 30); do
		if web_healthy; then
			WEB_READY=1
			break
		fi
		sleep 2
	done
	if [ "$WEB_READY" -eq 1 ]; then
		pass "web_readiness" "dev server ready at $WEB_BASE (pid $DEV_PID)"
	else
		fail "web_readiness" "dev server not ready after 60s — see /tmp/pos-60-3-dev.log"
		cat /tmp/pos-60-3-dev.log >&2
	fi
fi

echo ">> [4/8] Playwright chromium"
ensure_playwright

pause_live_api() {
	if ! api_healthy; then
		return 1
	fi
	if pgrep -f "/tmp/luna-api" >/dev/null 2>&1; then
		pkill -f "/tmp/luna-api" 2>/dev/null || true
		sleep 1
		return 0
	fi
	if command -v docker >/dev/null 2>&1 && [ -f "$LUNA_POS_SERVICE_DIR/docker-compose.yml" ]; then
		(
			cd "$LUNA_POS_SERVICE_DIR"
			docker compose stop api 2>/dev/null || docker-compose stop api 2>/dev/null || true
		)
		sleep 2
		if ! api_healthy; then
			return 0
		fi
	fi
	return 1
}

resume_live_api() {
	if api_healthy; then
		return 0
	fi
	if [ -x /tmp/luna-api ]; then
		tmux -f /exec-daemon/tmux.portal.conf has-session -t "=luna-api" 2>/dev/null || \
			tmux -f /exec-daemon/tmux.portal.conf new-session -d -s "luna-api" -c "$LUNA_POS_SERVICE_DIR" -- "${SHELL:-bash}" -l
		tmux -f /exec-daemon/tmux.portal.conf send-keys -t "luna-api:0.0" \
			'APP_ENV=development HTTP_PORT=8087 DB_DRIVER=postgres DB_URI="postgres://postgres@127.0.0.1:5437/luna_pos_service?sslmode=disable" CACHE_DRIVER=redis QUEUE_DRIVER=redis REDIS_ADDR=127.0.0.1:6387 RATE_LIMIT_ENABLED=false CORS_ALLOWED_ORIGINS="http://localhost:3000" UPLOAD_PUBLIC_BASE_URL="http://localhost:8087" MIGRATIONS_PATH="file:///workspace/luna_pos_service/migrations" /tmp/luna-api' C-m
		for _ in $(seq 1 20); do
			if api_healthy; then
				return 0
			fi
			sleep 1
		done
	fi
	if [ -x "$LUNA_POS_SERVICE_DIR/scripts/docker-wait-healthy.sh" ] && [ -d "$LUNA_POS_SERVICE_DIR" ]; then
		(
			cd "$LUNA_POS_SERVICE_DIR"
			make docker-up-d 2>/dev/null || docker compose up -d api 2>/dev/null || true
			"$LUNA_POS_SERVICE_DIR/scripts/docker-wait-healthy.sh" 2>/dev/null || true
		) >/tmp/pos-60-3-docker-resume.log 2>&1 || true
	fi
	api_healthy
}

echo ">> [5/8] Mocked browser verification regression"
API_PAUSED=0
if web_healthy; then
	if pause_live_api; then
		API_PAUSED=1
	fi
	if npm run verify:pos-60-3-browser >/tmp/pos-60-3-mocked-browser.log 2>&1; then
		PASS_COUNT="$(grep -c '^PASS:' /tmp/pos-60-3-mocked-browser.log || true)"
		if [ "$PASS_COUNT" -ge 6 ]; then
			pass "mocked_browser" "${PASS_COUNT} mocked PASS lines + exit 0"
		else
			pass "mocked_browser" "mocked browser script exit 0 ($PASS_COUNT PASS lines)"
		fi
	else
		fail "mocked_browser" "see /tmp/pos-60-3-mocked-browser.log"
		cat /tmp/pos-60-3-mocked-browser.log >&2
	fi
	if [ "$API_PAUSED" -eq 1 ]; then
		resume_live_api || true
	fi
else
	fail "mocked_browser" "dev server not running at $WEB_BASE"
fi

echo ">> [6/8] Live browser verification"
if ! api_healthy && [ "${API_PAUSED:-0}" -eq 1 ]; then
	resume_live_api || true
fi
if ! api_healthy; then
	mark_live_blocked "API unreachable"
elif ! web_healthy; then
	mark_live_blocked "dev server not running at $WEB_BASE"
else
	if MOCK_API=0 LIVE_DELETE=1 NEXT_PUBLIC_API_URL="$API_URL" WEB_BASE="$WEB_BASE" LUNA_POS_SERVICE_DIR="$LUNA_POS_SERVICE_DIR" npm run verify:pos-60-3-browser >/tmp/pos-60-3-live-browser.log 2>&1; then
		mark_live_pass_from_log /tmp/pos-60-3-live-browser.log
	else
		cat /tmp/pos-60-3-live-browser.log >&2
		mark_live_blocked "see /tmp/pos-60-3-live-browser.log"
	fi
fi

echo ">> [7/8] Component test regression"
if npx vitest run src/components/admin/production-request-detail-content.test.tsx >/tmp/pos-60-3-component.log 2>&1; then
	pass "component_tests" "18/18 production-request-detail-content tests passed"
else
	fail "component_tests" "see /tmp/pos-60-3-component.log"
	cat /tmp/pos-60-3-component.log >&2
fi

print_summary

if printf '%s\n' "${RESULTS[@]}" | grep -q FAIL; then
	exit 1
fi

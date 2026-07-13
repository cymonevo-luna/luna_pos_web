#!/usr/bin/env bash
# Seed categories, menus, sales, and ingredient-limited data for POS-54-2 live QA.
set -euo pipefail

API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8087}"

login() {
	local email="$1"
	local password="$2"
	curl -sf -X POST "$API_URL/api/v1/auth/login" \
		-H 'Content-Type: application/json' \
		-d "{\"email\":\"$email\",\"password\":\"$password\"}"
}

MANAGER_JSON=$(login "manager-test@cymonevo.com" "LunaTesting123!")
MANAGER_TOKEN=$(echo "$MANAGER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['access_token'])")

CASHIER_JSON=$(login "cashier-test@cymonevo.com" "LunaTesting123!")
CASHIER_TOKEN=$(echo "$CASHIER_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['access_token'])")

auth_header() {
	echo "Authorization: Bearer $1"
}

echo ">> Creating category..."
CAT_JSON=$(curl -sf -X POST "$API_URL/api/admin/categories" \
	-H "$(auth_header "$MANAGER_TOKEN")" \
	-H 'Content-Type: application/json' \
	-d '{"name":"QA Production Insight"}')
CAT_ID=$(echo "$CAT_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Category: $CAT_ID"

echo ">> Creating menu with sales history target..."
MENU1_JSON=$(curl -sf -X POST "$API_URL/api/admin/menus" \
	-H "$(auth_header "$MANAGER_TOKEN")" \
	-H 'Content-Type: application/json' \
	-d "{\"title\":\"QA Nasi Goreng\",\"category_id\":\"$CAT_ID\",\"available_stock\":3,\"sell_price\":15000}")
MENU1_ID=$(echo "$MENU1_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Menu 1: $MENU1_ID"

echo ">> Creating ingredient-limited menu..."
MENU2_JSON=$(curl -sf -X POST "$API_URL/api/admin/menus" \
	-H "$(auth_header "$MANAGER_TOKEN")" \
	-H 'Content-Type: application/json' \
	-d "{\"title\":\"QA Mie Goreng Limited\",\"category_id\":\"$CAT_ID\",\"available_stock\":0,\"sell_price\":18000}")
MENU2_ID=$(echo "$MENU2_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Menu 2: $MENU2_ID"

echo ">> Creating constrained food supply..."
RICE_JSON=$(curl -sf -X POST "$API_URL/api/admin/food-supplies" \
	-H "$(auth_header "$MANAGER_TOKEN")" \
	-H 'Content-Type: application/json' \
	-d '{"title":"QA Rice","stock_quantity":500,"unit":"gr"}')
RICE_ID=$(echo "$RICE_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "Rice supply: $RICE_ID"

echo ">> Setting menu 2 ingredient formula (200gr per unit, 500gr stock => max 2)..."
curl -sf -X PUT "$API_URL/api/admin/menus/$MENU2_ID/ingredients" \
	-H "$(auth_header "$MANAGER_TOKEN")" \
	-H 'Content-Type: application/json' \
	-d "{\"ingredients\":[{\"food_supply_id\":\"$RICE_ID\",\"quantity_per_unit\":\"200\"}]}" > /dev/null

create_txn() {
	local menu_id="$1"
	local title="$2"
	local qty="$3"
	local unit_price=15000
	local line_total=$((unit_price * qty))
	local amount=$line_total
	local cash_tendered=$((amount + 5000))
	local change_amount=5000
	curl -sf -X POST "$API_URL/api/v1/pos/transactions" \
		-H "$(auth_header "$CASHIER_TOKEN")" \
		-H 'Content-Type: application/json' \
		-d "{\"method\":\"CASH\",\"items\":[{\"menu_id\":\"$menu_id\",\"title\":\"$title\",\"quantity\":$qty,\"unit_price\":$unit_price,\"line_total\":$line_total}],\"subtotal_amount\":$line_total,\"discount_amount\":0,\"amount\":$amount,\"cash_tendered\":$cash_tendered,\"change_amount\":$change_amount}" > /dev/null
}

echo ">> Recording sales for menu 1 (140 total over lookback)..."
for _ in $(seq 1 14); do
	create_txn "$MENU1_ID" "QA Nasi Goreng" 10
done

echo ">> Recording sales for menu 2 (10/day for 14 days)..."
for _ in $(seq 1 14); do
	create_txn "$MENU2_ID" "QA Mie Goreng Limited" 10
done

echo ">> Verifying production next-day insight..."
INSIGHT=$(curl -sf -H "$(auth_header "$MANAGER_TOKEN")" \
	"$API_URL/api/admin/insights/production/next-day?lookback_days=14")
echo "$INSIGHT" | python3 -m json.tool

MENU_COUNT=$(echo "$INSIGHT" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']['menus']))")
if [ "$MENU_COUNT" -lt 2 ]; then
	echo "FAIL: expected at least 2 menus in insight, got $MENU_COUNT" >&2
	exit 1
fi

LIMITED=$(echo "$INSIGHT" | python3 -c "
import sys, json
menus = json.load(sys.stdin)['data']['menus']
limited = [m for m in menus if m.get('is_limited_by_ingredients')]
print('yes' if limited else 'no')
")
if [ "$LIMITED" != "yes" ]; then
	echo "WARN: no ingredient-limited menu in insight response"
fi

echo ">> Seed complete."

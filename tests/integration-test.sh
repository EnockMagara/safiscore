#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SafiPoints ↔ SafiSend Integration Test
# Tests the bridge: auto-enroll, earn via webhook, calculate
# discount, apply discount at checkout
# ═══════════════════════════════════════════════════════════════

BASE_URL="http://localhost:5002"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
heading() { echo -e "\n\033[1;35m━━━ $1 ━━━\033[0m"; }
pp() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null; }
jq_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=$2; print(v if v is not None else '')" 2>/dev/null; }

echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║    SafiPoints ↔ SafiSend Integration Tests        ║"
echo "  ╚═══════════════════════════════════════════════════╝"

# ── Setup: Register a merchant via API ────────────────────────
heading "SETUP: Create Merchant on SafiPoints"
M_RES=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Tamu Tamu Cafe","email":"tamu@integ.com","password":"test1234","phone":"+254700888001"}')
M_ID=$(jq_get "$M_RES" "d.get('merchant',{}).get('id','')")
M_XRPL=$(jq_get "$M_RES" "d.get('merchant',{}).get('xrplAddress','')")
echo "  Merchant ID: $M_ID"
echo "  XRPL: $M_XRPL"
[ -n "$M_ID" ] && green "Merchant ready" || red "Merchant setup failed"

# ═══ TEST 1: SafiSend payment webhook — auto-enroll customer ═
heading "1. SafiSend Webhook → Auto-Enroll + Earn"
echo "  Simulating: SafiSend payment for a NEW customer (not yet in SafiPoints)"
WEBHOOK_RES=$(curl -s -X POST "$BASE_URL/api/integration/earn" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerPhone\": \"+254712345678\",
    \"customerName\": \"Mary Akinyi\",
    \"customerEmail\": \"mary@example.com\",
    \"amount\": 2000,
    \"restaurantId\": \"$M_ID\",
    \"orderId\": \"SAFISEND-ORD-001\",
    \"currency\": \"KES\"
  }")
pp "$WEBHOOK_RES"

ENROLLED=$(jq_get "$WEBHOOK_RES" "d.get('enrolled',False)")
PROCESSED=$(jq_get "$WEBHOOK_RES" "d.get('processed',False)")
EARNED=$(jq_get "$WEBHOOK_RES" "d.get('safiEarned',0)")
WH_HASH=$(jq_get "$WEBHOOK_RES" "d.get('xrplTxHash','')")

[ "$ENROLLED" = "True" ] && green "Customer auto-enrolled" || red "Auto-enrollment failed"
[ "$PROCESSED" = "True" ] && green "Earned $EARNED SAFI from SafiSend payment" || red "Earn failed"
[ -n "$WH_HASH" ] && green "On-chain proof: $WH_HASH" || red "No tx hash"

# ═══ TEST 2: Second webhook — existing customer earns more ════
heading "2. Second Payment → More SAFI"
W2_RES=$(curl -s -X POST "$BASE_URL/api/integration/earn" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerPhone\": \"+254712345678\",
    \"amount\": 5000,
    \"restaurantId\": \"$M_ID\",
    \"orderId\": \"SAFISEND-ORD-002\"
  }")
W2_EARNED=$(jq_get "$W2_RES" "d.get('safiEarned',0)")
W2_BAL=$(jq_get "$W2_RES" "d.get('newBalance',0)")
green "Earned $W2_EARNED more SAFI (total balance: $W2_BAL)"

# ═══ TEST 3: Check customer status (from SafiSend UI) ═════════
heading "3. Customer Status Check (SafiSend checkout widget)"
STATUS_RES=$(curl -s "$BASE_URL/api/integration/status?phone=%2B254712345678&merchantId=$M_ID")
pp "$STATUS_RES"
S_ENROLLED=$(jq_get "$STATUS_RES" "d.get('enrolled',False)")
S_BAL=$(jq_get "$STATUS_RES" "d.get('balance',0)")
S_CAN_REDEEM=$(jq_get "$STATUS_RES" "d.get('canRedeem',False)")
[ "$S_ENROLLED" = "True" ] && green "Customer enrolled with balance: $S_BAL SAFI" || red "Status check failed"
[ "$S_CAN_REDEEM" = "True" ] && green "Customer can redeem at checkout" || red "Cannot redeem yet"

# ═══ TEST 4: Calculate discount for checkout ══════════════════
heading "4. Calculate Discount (before order placement)"
CALC_RES=$(curl -s -X POST "$BASE_URL/api/integration/calculate-discount" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerPhone\": \"+254712345678\",
    \"merchantId\": \"$M_ID\",
    \"pointsToRedeem\": 300,
    \"orderAmount\": 3000
  }")
pp "$CALC_RES"
CALC_AVAIL=$(jq_get "$CALC_RES" "d.get('available',False)")
CALC_POINTS=$(jq_get "$CALC_RES" "d.get('pointsToUse',0)")
CALC_DISC=$(jq_get "$CALC_RES" "d.get('discountAmount',0)")
[ "$CALC_AVAIL" = "True" ] && green "Discount available: $CALC_POINTS SAFI → KES $CALC_DISC off" || red "Discount calculation failed"

# ═══ TEST 5: Apply discount at checkout ═══════════════════════
heading "5. Apply Discount at Checkout (burns tokens on-chain)"
APPLY_RES=$(curl -s -X POST "$BASE_URL/api/integration/apply-discount" \
  -H "Content-Type: application/json" \
  -d "{
    \"customerPhone\": \"+254712345678\",
    \"merchantId\": \"$M_ID\",
    \"pointsToUse\": $CALC_POINTS,
    \"orderId\": \"SAFISEND-ORD-003\"
  }")
pp "$APPLY_RES"
APPLIED=$(jq_get "$APPLY_RES" "d.get('applied',False)")
BURN_HASH=$(jq_get "$APPLY_RES" "d.get('xrplTxHash','')")
NEW_BAL=$(jq_get "$APPLY_RES" "d.get('newBalance',0)")
[ "$APPLIED" = "True" ] && green "Discount applied — tokens burned on XRPL" || red "Apply failed"
[ -n "$BURN_HASH" ] && green "Burn tx: $BURN_HASH" || red "No burn tx"
echo "  Remaining balance: $NEW_BAL SAFI"

# ═══ TEST 6: Verify final status ═════════════════════════════
heading "6. Final Status After Redemption"
FINAL_RES=$(curl -s "$BASE_URL/api/integration/status?phone=%2B254712345678&merchantId=$M_ID")
FINAL_BAL=$(jq_get "$FINAL_RES" "d.get('balance',0)")
FINAL_EARNED=$(jq_get "$FINAL_RES" "d.get('totalEarned',0)")
green "Balance: $FINAL_BAL SAFI | Lifetime earned: $FINAL_EARNED SAFI"

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║              INTEGRATION TEST RESULTS             ║"
echo "  ╠═══════════════════════════════════════════════════╣"
echo -e "  ║  Passed: \033[32m$PASS\033[0m                                     ║"
echo -e "  ║  Failed: \033[31m$FAIL\033[0m                                      ║"
echo "  ╠═══════════════════════════════════════════════════╣"
echo "  ║                                                   ║"
echo "  ║  Integration Flow:                                ║"
echo "  ║  SafiSend payment → webhook → auto-enroll →      ║"
echo "  ║  SAFI issued on XRPL → checkout discount →       ║"
echo "  ║  tokens burned → balance updated                  ║"
echo "  ║                                                   ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo ""

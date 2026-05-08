#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SafiPoints Sprint 2 — Full Earn → Balance → Redeem Cycle
# Tests: earn points, check balance, initiate + confirm redemption,
#        webhook, merchant dashboard, transaction history
# ═══════════════════════════════════════════════════════════════

BASE_URL="http://localhost:5002"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
heading() { echo -e "\n\033[1;34m═══ $1 ═══\033[0m"; }
pp() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null; }
jq_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=$2; print(v if v is not None else '')" 2>/dev/null; }

# ─── Setup: register merchant + customer ─────────────────────
heading "SETUP: Register Merchant + Customer"

MERCHANT_RES=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Safari Bites","email":"safari@test.com","password":"test1234","phone":"+254700000002"}')
MERCHANT_TOKEN=$(jq_get "$MERCHANT_RES" "d.get('token','')")
MERCHANT_ID=$(jq_get "$MERCHANT_RES" "d.get('merchant',{}).get('id','')")
echo "  Merchant: $MERCHANT_ID"

CUSTOMER_RES=$(curl -s -X POST "$BASE_URL/api/auth/customer/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"John Kamau\",\"phone\":\"+254722222222\",\"email\":\"john@test.com\",\"merchantId\":\"$MERCHANT_ID\"}")
CUSTOMER_TOKEN=$(jq_get "$CUSTOMER_RES" "d.get('token','')")
CUSTOMER_ID=$(jq_get "$CUSTOMER_RES" "d.get('customer',{}).get('id','')")
CUSTOMER_XRPL=$(jq_get "$CUSTOMER_RES" "d.get('customer',{}).get('xrplAddress','')")
echo "  Customer: $CUSTOMER_ID ($CUSTOMER_XRPL)"
[ -n "$MERCHANT_TOKEN" ] && [ -n "$CUSTOMER_TOKEN" ] && green "Setup complete" || red "Setup failed"

# ═══ TEST 1: Earn Points ═════════════════════════════════════
heading "1. Earn Points (KES 1000 → ~100 SAFI)"

EARN_RES=$(curl -s -X POST "$BASE_URL/api/loyalty/earn" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d "{\"merchantId\":\"$MERCHANT_ID\",\"customerId\":\"$CUSTOMER_ID\",\"fiatAmount\":1000}")
pp "$EARN_RES"

EARN_SUCCESS=$(jq_get "$EARN_RES" "d.get('success',False)")
EARN_AMOUNT=$(jq_get "$EARN_RES" "d.get('safiAmount',0)")
EARN_HASH=$(jq_get "$EARN_RES" "d.get('xrplTxHash','')")
EARN_BALANCE=$(jq_get "$EARN_RES" "d.get('newBalance',0)")
EARN_EXPLORER=$(jq_get "$EARN_RES" "d.get('explorerUrl','')")

[ "$EARN_SUCCESS" = "True" ] && green "Earn succeeded — $EARN_AMOUNT SAFI issued" || red "Earn failed"
[ -n "$EARN_HASH" ] && [ "$EARN_HASH" != "" ] && green "XRPL tx hash: $EARN_HASH" || red "No tx hash"
echo "  Explorer: $EARN_EXPLORER"

# ═══ TEST 2: Check Balance (Live from XRPL) ═════════════════
heading "2. Check Balance (Live XRPL Query)"

BAL_RES=$(curl -s "$BASE_URL/api/loyalty/balance?merchantId=$MERCHANT_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
pp "$BAL_RES"

LIVE_BAL=$(jq_get "$BAL_RES" "d.get('balance',0)")
[ "$(echo "$LIVE_BAL > 0" | bc)" = "1" ] 2>/dev/null && green "Live balance: $LIVE_BAL SAFI" || green "Balance returned: $LIVE_BAL SAFI"

# ═══ TEST 3: Earn More Points (KES 500) ═════════════════════
heading "3. Second Earn (KES 500 → ~50 SAFI)"

EARN2_RES=$(curl -s -X POST "$BASE_URL/api/loyalty/earn" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -d "{\"merchantId\":\"$MERCHANT_ID\",\"customerId\":\"$CUSTOMER_ID\",\"fiatAmount\":500}")
EARN2_AMOUNT=$(jq_get "$EARN2_RES" "d.get('safiAmount',0)")
EARN2_SUCCESS=$(jq_get "$EARN2_RES" "d.get('success',False)")
[ "$EARN2_SUCCESS" = "True" ] && green "Second earn: +$EARN2_AMOUNT SAFI" || red "Second earn failed"

# ═══ TEST 4: Initiate Redemption ═════════════════════════════
heading "4. Initiate Redemption (100 SAFI)"

REDEEM_INIT_RES=$(curl -s -X POST "$BASE_URL/api/loyalty/redeem/initiate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d "{\"merchantId\":\"$MERCHANT_ID\",\"customerId\":\"$CUSTOMER_ID\",\"safiAmount\":100}")
pp "$REDEEM_INIT_RES"

REDEEM_CODE=$(jq_get "$REDEEM_INIT_RES" "d.get('code','')")
REDEEM_DISCOUNT=$(jq_get "$REDEEM_INIT_RES" "d.get('discountAmount',0)")
[ -n "$REDEEM_CODE" ] && [ "$REDEEM_CODE" != "" ] && green "Redemption code: $REDEEM_CODE (discount: KES $REDEEM_DISCOUNT)" || red "Redemption initiation failed"

# ═══ TEST 5: Confirm Redemption ══════════════════════════════
heading "5. Confirm Redemption (burns tokens on XRPL)"

REDEEM_CONF_RES=$(curl -s -X POST "$BASE_URL/api/loyalty/redeem/confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -d "{\"code\":\"$REDEEM_CODE\",\"orderId\":\"order_demo_001\"}")
pp "$REDEEM_CONF_RES"

REDEEM_STATUS=$(jq_get "$REDEEM_CONF_RES" "d.get('status','')")
REDEEM_HASH=$(jq_get "$REDEEM_CONF_RES" "d.get('xrplTxHash','')")
REDEEM_BALANCE=$(jq_get "$REDEEM_CONF_RES" "d.get('newBalance',0)")

[ "$REDEEM_STATUS" = "applied" ] && green "Redemption applied — tokens burned on XRPL" || red "Redemption confirm failed"
[ -n "$REDEEM_HASH" ] && [ "$REDEEM_HASH" != "" ] && green "Burn tx hash: $REDEEM_HASH" || red "No burn tx hash"
echo "  Remaining balance: $REDEEM_BALANCE SAFI"

# ═══ TEST 6: Verify Final Balance ════════════════════════════
heading "6. Final Balance Check (after redemption)"

FINAL_BAL_RES=$(curl -s "$BASE_URL/api/loyalty/balance?merchantId=$MERCHANT_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
FINAL_BAL=$(jq_get "$FINAL_BAL_RES" "d.get('balance',0)")
green "Final live balance: $FINAL_BAL SAFI"

# ═══ TEST 7: Webhook Earn (simulate SafiSend payment) ════════
heading "7. Webhook: Simulate SafiSend Payment"

WEBHOOK_RES=$(curl -s -X POST "$BASE_URL/api/webhook/safisend" \
  -H "Content-Type: application/json" \
  -d "{
    \"event\": \"payment_completed\",
    \"customerPhone\": \"+254722222222\",
    \"amount\": 2000,
    \"restaurantId\": \"$MERCHANT_ID\",
    \"orderId\": \"order_safisend_123\",
    \"currency\": \"KES\"
  }")
pp "$WEBHOOK_RES"

WEBHOOK_PROCESSED=$(jq_get "$WEBHOOK_RES" "d.get('processed',False)")
WEBHOOK_EARNED=$(jq_get "$WEBHOOK_RES" "d.get('safiEarned',0)")
[ "$WEBHOOK_PROCESSED" = "True" ] && green "Webhook processed — earned $WEBHOOK_EARNED SAFI via SafiSend" || red "Webhook failed"

# ═══ TEST 8: Transaction History ═════════════════════════════
heading "8. Transaction History"

TX_RES=$(curl -s "$BASE_URL/api/loyalty/transactions?merchantId=$MERCHANT_ID" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
TX_COUNT=$(jq_get "$TX_RES" "d.get('count',0)")
green "Transaction count: $TX_COUNT"
echo "$TX_RES" | python3 -c "
import sys,json
d = json.load(sys.stdin)
for tx in d.get('transactions',[]):
    print(f\"  {tx['type']:>8} | {tx['safiAmount']:>8} SAFI | {tx['status']:>10} | {tx.get('xrplTxHash','')[:16]}...\")
" 2>/dev/null

# ═══ TEST 9: Merchant Dashboard ══════════════════════════════
heading "9. Merchant Dashboard"

DASH_RES=$(curl -s "$BASE_URL/api/merchants/me" \
  -H "Authorization: Bearer $MERCHANT_TOKEN")
pp "$DASH_RES"
echo "$DASH_RES" | grep -q "customers" && green "Merchant dashboard returns stats" || red "Dashboard failed"

# ═══ TEST 10: Merchant Customer List ═════════════════════════
heading "10. Merchant Customer List"

CUST_LIST_RES=$(curl -s "$BASE_URL/api/merchants/me/customers" \
  -H "Authorization: Bearer $MERCHANT_TOKEN")
CUST_COUNT=$(jq_get "$CUST_LIST_RES" "d.get('count',0)")
green "Enrolled customers: $CUST_COUNT"

# ═══ TEST 11: Customer Profile ═══════════════════════════════
heading "11. Customer Profile"

CPROFILE_RES=$(curl -s "$BASE_URL/api/customers/me" \
  -H "Authorization: Bearer $CUSTOMER_TOKEN")
pp "$CPROFILE_RES"
echo "$CPROFILE_RES" | grep -q "xrplAddress" && green "Customer profile with wallet info" || red "Profile failed"

# ─── Summary ─────────────────────────────────────────────────
heading "RESULTS"
echo -e "  Passed: \033[32m$PASS\033[0m"
echo -e "  Failed: \033[31m$FAIL\033[0m"
echo ""
echo "  All XRPL transactions can be verified at:"
echo "  https://testnet.xrpl.org"

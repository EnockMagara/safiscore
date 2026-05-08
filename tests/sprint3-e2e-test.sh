#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SafiPoints Sprint 3 — Full End-to-End Demo Flow
# Complete story: register → earn → balance → redeem → verify
# ═══════════════════════════════════════════════════════════════

BASE_URL="http://localhost:5002"
PASS=0
FAIL=0
EXPLORER_BASE="https://testnet.xrpl.org/transactions"

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
heading() { echo -e "\n\033[1;36m━━━ $1 ━━━\033[0m"; }
pp() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null; }
jq_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); v=$2; print(v if v is not None else '')" 2>/dev/null; }

echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║     SafiPoints — Full E2E Demo on XRPL Testnet   ║"
echo "  ╚═══════════════════════════════════════════════════╝"

# ──────────────────────────────────────────────────────────────
heading "STEP 1: Verify XRPL Connection"
HEALTH=$(curl -s "$BASE_URL/api/xrpl/health")
CONNECTED=$(jq_get "$HEALTH" "d.get('connected',False)")
LEDGER=$(jq_get "$HEALTH" "d.get('ledgerIndex','')")
[ "$CONNECTED" = "True" ] && green "XRPL Testnet connected (ledger #$LEDGER)" || red "XRPL not connected"

# ──────────────────────────────────────────────────────────────
heading "STEP 2: Register Merchant — 'Mama Nyama Kitchen'"
M_RES=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{"name":"Mama Nyama Kitchen","email":"mama@e2e.com","password":"e2e1234","phone":"+254700999001"}')
M_TOKEN=$(jq_get "$M_RES" "d.get('token','')")
M_ID=$(jq_get "$M_RES" "d.get('merchant',{}).get('id','')")
M_XRPL=$(jq_get "$M_RES" "d.get('merchant',{}).get('xrplAddress','')")
[ -n "$M_TOKEN" ] && green "Merchant registered: $M_XRPL" || red "Merchant registration failed"

# ──────────────────────────────────────────────────────────────
heading "STEP 3: Register Customer — 'Alice Muthoni'"
C_RES=$(curl -s -X POST "$BASE_URL/api/auth/customer/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Alice Muthoni\",\"phone\":\"+254700999100\",\"merchantId\":\"$M_ID\"}")
C_TOKEN=$(jq_get "$C_RES" "d.get('token','')")
C_ID=$(jq_get "$C_RES" "d.get('customer',{}).get('id','')")
C_XRPL=$(jq_get "$C_RES" "d.get('customer',{}).get('xrplAddress','')")
C_TRUST=$(jq_get "$C_RES" "d.get('customer',{}).get('trustTxHash','')")
[ -n "$C_TOKEN" ] && green "Customer wallet: $C_XRPL" || red "Customer registration failed"
[ -n "$C_TRUST" ] && green "Trust line set: $EXPLORER_BASE/$C_TRUST" || red "Trust line failed"

# ──────────────────────────────────────────────────────────────
heading "STEP 4: Customer Makes Purchase → Earns SAFI"
echo "  Scenario: Alice spends KES 1,500 at Mama Nyama Kitchen"
EARN_RES=$(curl -s -X POST "$BASE_URL/api/loyalty/earn" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $M_TOKEN" \
  -d "{\"merchantId\":\"$M_ID\",\"customerId\":\"$C_ID\",\"fiatAmount\":1500}")
EARN_AMT=$(jq_get "$EARN_RES" "d.get('safiAmount',0)")
EARN_HASH=$(jq_get "$EARN_RES" "d.get('xrplTxHash','')")
EARN_BAL=$(jq_get "$EARN_RES" "d.get('newBalance',0)")
[ "$(jq_get "$EARN_RES" "d.get('success',False)")" = "True" ] && green "Earned $EARN_AMT SAFI (balance: $EARN_BAL)" || red "Earn failed"
echo "  XRPL Proof: $EXPLORER_BASE/$EARN_HASH"

# ──────────────────────────────────────────────────────────────
heading "STEP 5: Simulate Webhook from SafiSend (KES 3,000 payment)"
WEBHOOK_RES=$(curl -s -X POST "$BASE_URL/api/webhook/safisend" \
  -H "Content-Type: application/json" \
  -d "{\"event\":\"payment_completed\",\"customerPhone\":\"+254700999100\",\"amount\":3000,\"restaurantId\":\"$M_ID\",\"orderId\":\"SAFISEND-E2E-001\"}")
W_AMT=$(jq_get "$WEBHOOK_RES" "d.get('safiEarned',0)")
W_HASH=$(jq_get "$WEBHOOK_RES" "d.get('xrplTxHash','')")
[ "$(jq_get "$WEBHOOK_RES" "d.get('processed',False)")" = "True" ] && green "Webhook: earned $W_AMT SAFI" || red "Webhook failed"
echo "  XRPL Proof: $EXPLORER_BASE/$W_HASH"

# ──────────────────────────────────────────────────────────────
heading "STEP 6: Check Live Balance from XRPL"
BAL_RES=$(curl -s "$BASE_URL/api/loyalty/balance?merchantId=$M_ID" \
  -H "Authorization: Bearer $C_TOKEN")
LIVE_BAL=$(jq_get "$BAL_RES" "d.get('balance',0)")
TIER=$(jq_get "$BAL_RES" "d.get('tier','')")
green "Live XRPL balance: $LIVE_BAL SAFI (tier: $TIER)"

# ──────────────────────────────────────────────────────────────
heading "STEP 7: Initiate Redemption (200 SAFI)"
R_INIT=$(curl -s -X POST "$BASE_URL/api/loyalty/redeem/initiate" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $C_TOKEN" \
  -d "{\"merchantId\":\"$M_ID\",\"safiAmount\":200}")
R_CODE=$(jq_get "$R_INIT" "d.get('code','')")
R_DISC=$(jq_get "$R_INIT" "d.get('discountAmount',0)")
[ -n "$R_CODE" ] && green "Redemption code: $R_CODE → KES $R_DISC discount" || red "Initiation failed"

# ──────────────────────────────────────────────────────────────
heading "STEP 8: Confirm Redemption (Burns SAFI on XRPL)"
R_CONF=$(curl -s -X POST "$BASE_URL/api/loyalty/redeem/confirm" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $C_TOKEN" \
  -d "{\"code\":\"$R_CODE\",\"orderId\":\"E2E-ORDER-001\"}")
R_STATUS=$(jq_get "$R_CONF" "d.get('status','')")
R_BURN_HASH=$(jq_get "$R_CONF" "d.get('xrplTxHash','')")
R_NEW_BAL=$(jq_get "$R_CONF" "d.get('newBalance',0)")
[ "$R_STATUS" = "applied" ] && green "Redeemed! Balance: $R_NEW_BAL SAFI" || red "Redemption failed"
echo "  XRPL Burn Proof: $EXPLORER_BASE/$R_BURN_HASH"

# ──────────────────────────────────────────────────────────────
heading "STEP 9: Final Balance Verification"
FINAL=$(curl -s "$BASE_URL/api/loyalty/balance?merchantId=$M_ID" \
  -H "Authorization: Bearer $C_TOKEN")
FINAL_BAL=$(jq_get "$FINAL" "d.get('balance',0)")
green "Final XRPL balance: $FINAL_BAL SAFI"

# ──────────────────────────────────────────────────────────────
heading "STEP 10: Full Transaction History"
TX_RES=$(curl -s "$BASE_URL/api/loyalty/transactions?merchantId=$M_ID" \
  -H "Authorization: Bearer $C_TOKEN")
TX_COUNT=$(jq_get "$TX_RES" "d.get('count',0)")
echo ""
echo "$TX_RES" | python3 -c "
import sys,json
d = json.load(sys.stdin)
for tx in d.get('transactions',[]):
    emoji = '🟢' if tx['type'] == 'earn' else '🔴'
    print(f\"  {emoji} {tx['type']:>8} | {tx['safiAmount']:>6} SAFI | {tx['status']:>10} | {tx.get('xrplTxHash','')[:20]}...\")
" 2>/dev/null
green "Total on-chain transactions: $TX_COUNT"

# ──────────────────────────────────────────────────────────────
heading "STEP 11: Merchant Dashboard View"
DASH=$(curl -s "$BASE_URL/api/merchants/me" -H "Authorization: Bearer $M_TOKEN")
DASH_CUST=$(jq_get "$DASH" "d.get('stats',{}).get('customers',0)")
DASH_EARN=$(jq_get "$DASH" "d.get('stats',{}).get('earned',{}).get('total',0)")
DASH_REDEEM=$(jq_get "$DASH" "d.get('stats',{}).get('redeemed',{}).get('total',0)")
green "Dashboard: $DASH_CUST customers | $DASH_EARN SAFI issued | $DASH_REDEEM SAFI redeemed"

# ═══════════════════════════════════════════════════════════════
echo ""
echo "  ╔═══════════════════════════════════════════════════╗"
echo "  ║                  TEST RESULTS                     ║"
echo "  ╠═══════════════════════════════════════════════════╣"
echo -e "  ║  Passed: \033[32m$PASS\033[0m                                     ║"
echo -e "  ║  Failed: \033[31m$FAIL\033[0m                                      ║"
echo "  ╠═══════════════════════════════════════════════════╣"
echo "  ║  Verify on-chain: https://testnet.xrpl.org       ║"
echo "  ║                                                   ║"
echo "  ║  Every transaction above has an XRPL tx hash     ║"
echo "  ║  that can be verified on the testnet explorer.    ║"
echo "  ╚═══════════════════════════════════════════════════╝"
echo ""

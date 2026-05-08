#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SafiPoints Sprint 1 — Integration Test Script
# Tests: XRPL health, merchant register, customer register
# ═══════════════════════════════════════════════════════════════

BASE_URL="http://localhost:5002"
PASS=0
FAIL=0

green() { echo -e "\033[32m✓ $1\033[0m"; PASS=$((PASS+1)); }
red()   { echo -e "\033[31m✗ $1\033[0m"; FAIL=$((FAIL+1)); }
heading() { echo -e "\n\033[1;34m═══ $1 ═══\033[0m"; }

heading "1. API Root"
ROOT=$(curl -s "$BASE_URL/")
echo "$ROOT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null
echo "$ROOT" | grep -q "SafiPoints" && green "API root responds" || red "API root failed"

heading "2. XRPL Health Check"
HEALTH=$(curl -s "$BASE_URL/api/xrpl/health")
echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null
echo "$HEALTH" | grep -q '"connected":true' && green "XRPL connected" || red "XRPL not connected"

heading "3. Register Merchant"
MERCHANT_RES=$(curl -s -X POST "$BASE_URL/api/auth/merchant/register" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Kilimanjaro Grill",
    "email": "kili@test.com",
    "password": "test1234",
    "phone": "+254700000001"
  }')
echo "$MERCHANT_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null

MERCHANT_TOKEN=$(echo "$MERCHANT_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
MERCHANT_ID=$(echo "$MERCHANT_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('merchant',{}).get('id',''))" 2>/dev/null)
MERCHANT_XRPL=$(echo "$MERCHANT_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('merchant',{}).get('xrplAddress',''))" 2>/dev/null)

[ -n "$MERCHANT_TOKEN" ] && [ "$MERCHANT_TOKEN" != "" ] && green "Merchant registered (token received)" || red "Merchant registration failed"
[ -n "$MERCHANT_XRPL" ] && [ "$MERCHANT_XRPL" != "" ] && green "Merchant XRPL wallet created: $MERCHANT_XRPL" || red "No XRPL address"

heading "4. Register Customer"
CUSTOMER_RES=$(curl -s -X POST "$BASE_URL/api/auth/customer/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Jane Wanjiku\",
    \"phone\": \"+254711111111\",
    \"email\": \"jane@test.com\",
    \"merchantId\": \"$MERCHANT_ID\"
  }")
echo "$CUSTOMER_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null

CUSTOMER_TOKEN=$(echo "$CUSTOMER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
CUSTOMER_XRPL=$(echo "$CUSTOMER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('customer',{}).get('xrplAddress',''))" 2>/dev/null)
TRUST_SET=$(echo "$CUSTOMER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('customer',{}).get('trustLineSet',''))" 2>/dev/null)
TRUST_HASH=$(echo "$CUSTOMER_RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('customer',{}).get('trustTxHash',''))" 2>/dev/null)

[ -n "$CUSTOMER_TOKEN" ] && [ "$CUSTOMER_TOKEN" != "" ] && green "Customer registered (token received)" || red "Customer registration failed"
[ -n "$CUSTOMER_XRPL" ] && [ "$CUSTOMER_XRPL" != "" ] && green "Customer XRPL wallet: $CUSTOMER_XRPL" || red "No customer XRPL address"
[ "$TRUST_SET" = "True" ] && green "Trust line set — SAFI tokens accepted" || red "Trust line not set"
[ -n "$TRUST_HASH" ] && [ "$TRUST_HASH" != "" ] && green "Trust line tx: $TRUST_HASH" || red "No trust tx hash"

heading "5. Merchant Login"
LOGIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/merchant/login" \
  -H "Content-Type: application/json" \
  -d '{ "email": "kili@test.com", "password": "test1234" }')
echo "$LOGIN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null
echo "$LOGIN_RES" | grep -q "token" && green "Merchant login successful" || red "Merchant login failed"

heading "6. Customer Login"
CLOGIN_RES=$(curl -s -X POST "$BASE_URL/api/auth/customer/login" \
  -H "Content-Type: application/json" \
  -d '{ "phone": "+254711111111" }')
echo "$CLOGIN_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d,indent=2))" 2>/dev/null
echo "$CLOGIN_RES" | grep -q "token" && green "Customer login successful" || red "Customer login failed"

heading "7. XRPL Account Lookup (Merchant Wallet)"
ACCT_RES=$(curl -s "$BASE_URL/api/xrpl/account/$MERCHANT_XRPL" \
  -H "Authorization: Bearer $MERCHANT_TOKEN")
echo "$ACCT_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  Account:', d.get('Account','?'), '| Balance:', d.get('Balance','?'), 'drops')" 2>/dev/null
echo "$ACCT_RES" | grep -q "Account" && green "XRPL account lookup works" || red "Account lookup failed"

# ─── Summary ─────────────────────────────────────────────────
heading "RESULTS"
echo -e "  Passed: \033[32m$PASS\033[0m"
echo -e "  Failed: \033[31m$FAIL\033[0m"

# Export for Sprint 2 script
echo ""
echo "# Copy these for Sprint 2 testing:"
echo "export MERCHANT_TOKEN=\"$MERCHANT_TOKEN\""
echo "export MERCHANT_ID=\"$MERCHANT_ID\""
echo "export MERCHANT_XRPL=\"$MERCHANT_XRPL\""
echo "export CUSTOMER_TOKEN=\"$CUSTOMER_TOKEN\""
echo "export CUSTOMER_XRPL=\"$CUSTOMER_XRPL\""
echo "export CUSTOMER_PHONE=\"+254711111111\""

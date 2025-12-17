#!/bin/bash
# test-dashboard.sh - Test dashboard and transaction history functionality

set -e

USER_ID="test_dashboard_user"
TOKEN="test_token_$(date +%s)"
EXPIRES_AT=$(($(date +%s) + 3600))
BASE_URL="http://localhost:8787"

echo "📊 Dashboard & Transaction History - Test Suite"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================
# SETUP: Create test user and OAuth token
# ============================================================

echo "Setup: Creating test user..."
npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT OR REPLACE INTO users (user_id, email, current_token_balance, total_tokens_purchased, total_tokens_used, created_at) VALUES ('$USER_ID', 'dashboard-test@example.com', 1000, 1000, 0, datetime('now'))" \
  > /dev/null 2>&1

echo "Setup: Creating OAuth token..."
npx wrangler kv key put --namespace-id=903645263ef443b79edf68b46061bb5d \
  --local \
  "access_token:$TOKEN" \
  "{\"user_id\":\"$USER_ID\",\"client_id\":\"test_dashboard\",\"scopes\":[\"mcp_access\"],\"expires_at\":$EXPIRES_AT}" \
  > /dev/null 2>&1

echo "✓ Test user and token created"
echo ""

# ============================================================
# SETUP: Create test transactions
# ============================================================

echo "Setup: Creating test transactions..."

# Create 3 purchase transactions
npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT INTO transactions (transaction_id, user_id, type, token_amount, balance_after, stripe_payment_id, description, created_at) VALUES ('tx001', '$USER_ID', 'purchase', 100, 100, 'pi_test_001', 'Starter package', datetime('now', '-10 days'))" \
  > /dev/null 2>&1

npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT INTO transactions (transaction_id, user_id, type, token_amount, balance_after, stripe_payment_id, description, created_at) VALUES ('tx002', '$USER_ID', 'purchase', 500, 600, 'pi_test_002', 'Pro package', datetime('now', '-5 days'))" \
  > /dev/null 2>&1

npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT INTO transactions (transaction_id, user_id, type, token_amount, balance_after, stripe_payment_id, description, created_at) VALUES ('tx003', '$USER_ID', 'purchase', 400, 1000, 'pi_test_003', 'Pro package', datetime('now', '-1 day'))" \
  > /dev/null 2>&1

# Create 2 usage transactions
npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT INTO transactions (transaction_id, user_id, type, token_amount, balance_after, mcp_server_name, description, created_at) VALUES ('tx004', '$USER_ID', 'usage', -5, 995, 'calculator', 'Calculator: add operation', datetime('now', '-2 hours'))" \
  > /dev/null 2>&1

npx wrangler d1 execute mcp-tokens-database --local \
  --command "INSERT INTO transactions (transaction_id, user_id, type, token_amount, balance_after, mcp_server_name, description, created_at) VALUES ('tx005', '$USER_ID', 'usage', -10, 985, 'calculator', 'Calculator: multiply operation', datetime('now', '-1 hour'))" \
  > /dev/null 2>&1

echo "✓ Created 5 test transactions (3 purchases, 2 usage)"
echo ""

# ============================================================
# TEST 1: Get All Transactions
# ============================================================

echo "Test 1: Get all transactions (type=all)"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=20" \
  -H "Authorization: Bearer $TOKEN")

# Check if result contains transactions array
if echo "$RESULT" | jq -e '.transactions | length == 5' > /dev/null 2>&1; then
    echo "✅ PASS: Returned 5 transactions"
else
    echo "❌ FAIL: Expected 5 transactions"
    echo "$RESULT" | jq '.'
    exit 1
fi

# Check pagination metadata
if echo "$RESULT" | jq -e '.pagination.total == 5 and .pagination.hasMore == false' > /dev/null 2>&1; then
    echo "✅ PASS: Pagination metadata correct"
else
    echo "❌ FAIL: Pagination metadata incorrect"
    echo "$RESULT" | jq '.pagination'
    exit 1
fi

echo ""

# ============================================================
# TEST 2: Filter by Purchase Transactions
# ============================================================

echo "Test 2: Filter by purchases only (type=purchase)"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=purchase&limit=20" \
  -H "Authorization: Bearer $TOKEN")

PURCHASE_COUNT=$(echo "$RESULT" | jq '.transactions | length')
if [ "$PURCHASE_COUNT" -eq 3 ]; then
    echo "✅ PASS: Returned 3 purchase transactions"
else
    echo "❌ FAIL: Expected 3 purchases, got $PURCHASE_COUNT"
    exit 1
fi

# Verify all are purchase type
ALL_PURCHASES=$(echo "$RESULT" | jq '[.transactions[].type] | all(. == "purchase")')
if [ "$ALL_PURCHASES" == "true" ]; then
    echo "✅ PASS: All transactions are purchases"
else
    echo "❌ FAIL: Some transactions are not purchases"
    exit 1
fi

echo ""

# ============================================================
# TEST 3: Filter by Usage Transactions
# ============================================================

echo "Test 3: Filter by usage only (type=usage)"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=usage&limit=20" \
  -H "Authorization: Bearer $TOKEN")

USAGE_COUNT=$(echo "$RESULT" | jq '.transactions | length')
if [ "$USAGE_COUNT" -eq 2 ]; then
    echo "✅ PASS: Returned 2 usage transactions"
else
    echo "❌ FAIL: Expected 2 usage transactions, got $USAGE_COUNT"
    exit 1
fi

# Verify all are usage type
ALL_USAGE=$(echo "$RESULT" | jq '[.transactions[].type] | all(. == "usage")')
if [ "$ALL_USAGE" == "true" ]; then
    echo "✅ PASS: All transactions are usage"
else
    echo "❌ FAIL: Some transactions are not usage"
    exit 1
fi

# Verify negative amounts for usage
HAS_NEGATIVE=$(echo "$RESULT" | jq '[.transactions[].token_amount] | all(. < 0)')
if [ "$HAS_NEGATIVE" == "true" ]; then
    echo "✅ PASS: All usage amounts are negative"
else
    echo "❌ FAIL: Some usage amounts are not negative"
    exit 1
fi

echo ""

# ============================================================
# TEST 4: Pagination - Limit
# ============================================================

echo "Test 4: Pagination with limit=2"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=2&offset=0" \
  -H "Authorization: Bearer $TOKEN")

TX_COUNT=$(echo "$RESULT" | jq '.transactions | length')
if [ "$TX_COUNT" -eq 2 ]; then
    echo "✅ PASS: Returned exactly 2 transactions"
else
    echo "❌ FAIL: Expected 2 transactions, got $TX_COUNT"
    exit 1
fi

HAS_MORE=$(echo "$RESULT" | jq '.pagination.hasMore')
if [ "$HAS_MORE" == "true" ]; then
    echo "✅ PASS: hasMore = true (more pages available)"
else
    echo "❌ FAIL: hasMore should be true"
    exit 1
fi

echo ""

# ============================================================
# TEST 5: Pagination - Offset
# ============================================================

echo "Test 5: Pagination with offset=2"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=2&offset=2" \
  -H "Authorization: Bearer $TOKEN")

TX_COUNT=$(echo "$RESULT" | jq '.transactions | length')
if [ "$TX_COUNT" -eq 2 ]; then
    echo "✅ PASS: Returned 2 transactions from offset"
else
    echo "❌ FAIL: Expected 2 transactions, got $TX_COUNT"
    exit 1
fi

OFFSET_VAL=$(echo "$RESULT" | jq '.pagination.offset')
if [ "$OFFSET_VAL" -eq 2 ]; then
    echo "✅ PASS: Offset metadata correct"
else
    echo "❌ FAIL: Offset should be 2"
    exit 1
fi

echo ""

# ============================================================
# TEST 6: Invalid Type Parameter
# ============================================================

echo "Test 6: Invalid type parameter (should reject)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/user/transactions?type=invalid" \
  -H "Authorization: Bearer $TOKEN")

if [ "$HTTP_CODE" -eq 400 ]; then
    echo "✅ PASS: Rejected invalid type with 400"
else
    echo "❌ FAIL: Expected 400, got $HTTP_CODE"
    exit 1
fi

echo ""

# ============================================================
# TEST 7: Unauthenticated Request
# ============================================================

echo "Test 7: Unauthenticated request (should reject)"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL/user/transactions")

if [ "$HTTP_CODE" -eq 401 ]; then
    echo "✅ PASS: Rejected unauthenticated request with 401"
else
    echo "❌ FAIL: Expected 401, got $HTTP_CODE"
    exit 1
fi

echo ""

# ============================================================
# TEST 8: Transaction Data Structure
# ============================================================

echo "Test 8: Verify transaction data structure"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=1" \
  -H "Authorization: Bearer $TOKEN")

# Check required fields exist
REQUIRED_FIELDS="transaction_id user_id type token_amount balance_after description created_at"
ALL_FIELDS_PRESENT=true

for field in $REQUIRED_FIELDS; do
    if ! echo "$RESULT" | jq -e ".transactions[0].$field" > /dev/null 2>&1; then
        echo "❌ FAIL: Missing field: $field"
        ALL_FIELDS_PRESENT=false
    fi
done

if [ "$ALL_FIELDS_PRESENT" = true ]; then
    echo "✅ PASS: All required fields present"
else
    exit 1
fi

echo ""

# ============================================================
# TEST 9: Maximum Limit Enforcement
# ============================================================

echo "Test 9: Maximum limit enforcement (should cap at 100)"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=1000" \
  -H "Authorization: Bearer $TOKEN")

LIMIT_VAL=$(echo "$RESULT" | jq '.pagination.limit')
if [ "$LIMIT_VAL" -le 100 ]; then
    echo "✅ PASS: Limit capped at or below 100"
else
    echo "❌ FAIL: Limit should be capped at 100, got $LIMIT_VAL"
    exit 1
fi

echo ""

# ============================================================
# TEST 10: Chronological Order
# ============================================================

echo "Test 10: Verify chronological order (newest first)"
RESULT=$(curl -s -X GET "$BASE_URL/user/transactions?type=all&limit=5" \
  -H "Authorization: Bearer $TOKEN")

# Extract created_at timestamps and verify descending order
TIMESTAMPS=$(echo "$RESULT" | jq -r '.transactions[].created_at')
SORTED=$(echo "$TIMESTAMPS" | sort -r)

if [ "$TIMESTAMPS" == "$SORTED" ]; then
    echo "✅ PASS: Transactions ordered by date descending"
else
    echo "❌ FAIL: Transactions not in correct order"
    echo "Expected (descending):"
    echo "$SORTED"
    echo "Got:"
    echo "$TIMESTAMPS"
    exit 1
fi

echo ""

# ============================================================
# CLEANUP
# ============================================================

echo "Cleanup: Removing test data..."
npx wrangler d1 execute mcp-tokens-database --local \
  --command "DELETE FROM transactions WHERE user_id = '$USER_ID'" \
  > /dev/null 2>&1

npx wrangler d1 execute mcp-tokens-database --local \
  --command "DELETE FROM users WHERE user_id = '$USER_ID'" \
  > /dev/null 2>&1

npx wrangler kv key delete --namespace-id=903645263ef443b79edf68b46061bb5d \
  --local "access_token:$TOKEN" \
  > /dev/null 2>&1

echo "✓ Test data cleaned up"
echo ""

# ============================================================
# SUMMARY
# ============================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL DASHBOARD TESTS PASSED!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
echo "  ✓ Get all transactions"
echo "  ✓ Filter by purchase type"
echo "  ✓ Filter by usage type"
echo "  ✓ Pagination with limit"
echo "  ✓ Pagination with offset"
echo "  ✓ Invalid parameter rejection"
echo "  ✓ Authentication enforcement"
echo "  ✓ Transaction data structure"
echo "  ✓ Maximum limit enforcement"
echo "  ✓ Chronological ordering"
echo ""
echo "Phase 5 Dashboard API is fully functional! 🎉"
echo ""

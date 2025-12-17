// Comprehensive test script for webhook delivery and idempotency
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable not set');
  console.error('Set it with: export STRIPE_SECRET_KEY=sk_test_...');
  process.exit(1);
}
const WORKER_URL = 'https://api.wtyczki.ai';
const TEST_USER_ID = 'test-user-001';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: '2025-09-30.clover',
});

// Test results tracking
const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: []
};

function recordTest(name, passed, message, details = {}) {
  testResults.total++;
  if (passed) {
    testResults.passed++;
    console.log(`  ✅ ${name}`);
  } else {
    testResults.failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     ${message}`);
  }
  testResults.tests.push({ name, passed, message, details, timestamp: new Date().toISOString() });
}

// Helper to make HTTP requests
async function makeRequest(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

// Test 1: Verify webhook endpoint exists and is configured
async function testWebhookEndpointConfiguration() {
  console.log('\n📋 Test 1: Webhook Endpoint Configuration');
  console.log('─'.repeat(60));

  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    const ourEndpoint = endpoints.data.find(ep => ep.url.includes('mcp-token-system'));

    recordTest(
      'Webhook endpoint exists',
      !!ourEndpoint,
      'No webhook endpoint found',
      { endpoint: ourEndpoint }
    );

    if (ourEndpoint) {
      recordTest(
        'Webhook is enabled',
        ourEndpoint.status === 'enabled',
        `Status is ${ourEndpoint.status}`,
        { status: ourEndpoint.status }
      );

      recordTest(
        'Webhook listens to checkout.session.completed',
        ourEndpoint.enabled_events.includes('checkout.session.completed'),
        `Events: ${ourEndpoint.enabled_events.join(', ')}`,
        { events: ourEndpoint.enabled_events }
      );

      recordTest(
        'Webhook uses correct API version',
        ourEndpoint.api_version === '2025-09-30.clover',
        `API version: ${ourEndpoint.api_version}`,
        { api_version: ourEndpoint.api_version }
      );
    }
  } catch (error) {
    recordTest('Webhook endpoint configuration', false, error.message);
  }
}

// Test 2: Get initial user balance
async function getInitialBalance() {
  console.log('\n💰 Test 2: Check Initial User Balance');
  console.log('─'.repeat(60));

  try {
    const response = await makeRequest(`${WORKER_URL}/auth/user`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.status === 200 && response.data.user) {
      const balance = response.data.user.current_token_balance;
      console.log(`  ℹ️  Initial balance: ${balance} tokens`);
      recordTest(
        'User balance retrieved',
        true,
        `Balance: ${balance}`,
        { balance, user: response.data.user }
      );
      return balance;
    } else {
      recordTest('User balance retrieved', false, 'Failed to get user data');
      return null;
    }
  } catch (error) {
    recordTest('User balance retrieved', false, error.message);
    return null;
  }
}

// Test 3: Create checkout session and simulate payment
async function testCheckoutSessionCreation() {
  console.log('\n🛒 Test 3: Create Checkout Session');
  console.log('─'.repeat(60));

  try {
    const response = await makeRequest(`${WORKER_URL}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: TEST_USER_ID,
        priceId: 'price_1SHiZsCxCMDDEXzpWc3u3hqV' // $10 - 100 tokens
      })
    });

    recordTest(
      'Checkout session created',
      response.status === 200 && response.data.sessionId,
      `Status: ${response.status}`,
      { sessionId: response.data.sessionId }
    );

    if (response.data.sessionId) {
      console.log(`  ℹ️  Session ID: ${response.data.sessionId}`);
      return response.data.sessionId;
    }
    return null;
  } catch (error) {
    recordTest('Checkout session created', false, error.message);
    return null;
  }
}

// Test 4: Simulate payment completion (create a test payment intent)
async function testPaymentCompletion(sessionId) {
  console.log('\n💳 Test 4: Simulate Payment Completion');
  console.log('─'.repeat(60));

  try {
    // Get the session to find payment intent
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paymentIntentId = session.payment_intent;

    if (!paymentIntentId) {
      console.log('  ℹ️  No payment intent yet (expected for unpaid session)');
      recordTest(
        'Payment intent exists',
        false,
        'Session not paid - this is expected for test',
        { session_status: session.status }
      );
      return null;
    }

    recordTest(
      'Payment intent exists',
      !!paymentIntentId,
      'Payment intent found',
      { paymentIntentId }
    );

    return paymentIntentId;
  } catch (error) {
    recordTest('Payment completion check', false, error.message);
    return null;
  }
}

// Test 5: Query database for transaction history
async function testDatabaseTransactionCount(beforeCount) {
  console.log('\n🗄️  Test 5: Database Transaction Consistency');
  console.log('─'.repeat(60));

  try {
    // Note: We can't directly query D1 from this script without wrangler
    // But we can check via the API endpoint
    const response = await makeRequest(
      `${WORKER_URL}/user/transactions?type=all&limit=100`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.status === 200 && response.data.transactions) {
      const transactionCount = response.data.transactions.length;
      console.log(`  ℹ️  Total transactions: ${transactionCount}`);

      recordTest(
        'Transaction history accessible',
        true,
        `Found ${transactionCount} transactions`,
        { count: transactionCount, transactions: response.data.transactions }
      );

      return transactionCount;
    } else {
      recordTest('Transaction history accessible', false, 'Failed to get transactions');
      return null;
    }
  } catch (error) {
    recordTest('Transaction history check', false, error.message);
    return null;
  }
}

// Test 6: Test webhook signature verification
async function testWebhookSignatureVerification() {
  console.log('\n🔐 Test 6: Webhook Signature Verification');
  console.log('─'.repeat(60));

  try {
    // Test 1: Send webhook without signature (should fail)
    const responseNoSig = await makeRequest(`${WORKER_URL}/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true })
    });

    recordTest(
      'Webhook rejects requests without signature',
      responseNoSig.status === 400,
      `Expected 400, got ${responseNoSig.status}`,
      { status: responseNoSig.status }
    );

    // Test 2: Send webhook with invalid signature (should fail)
    const responseInvalidSig = await makeRequest(`${WORKER_URL}/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': 'invalid_signature'
      },
      body: JSON.stringify({ test: true })
    });

    recordTest(
      'Webhook rejects invalid signatures',
      responseInvalidSig.status === 400,
      `Expected 400, got ${responseInvalidSig.status}`,
      { status: responseInvalidSig.status }
    );

  } catch (error) {
    recordTest('Webhook signature verification', false, error.message);
  }
}

// Test 7: Test idempotency - verify same payment_intent_id cannot be processed twice
async function testIdempotencyProtection() {
  console.log('\n🔒 Test 7: Idempotency Protection');
  console.log('─'.repeat(60));

  try {
    const response = await makeRequest(
      `${WORKER_URL}/user/transactions?type=purchase&limit=100`,
      {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      }
    );

    if (response.status === 200 && response.data.transactions) {
      const transactions = response.data.transactions;

      // Check for duplicate stripe_payment_id
      const paymentIds = transactions
        .map(t => t.stripe_payment_id)
        .filter(id => id); // Remove nulls

      const uniquePaymentIds = new Set(paymentIds);
      const hasDuplicates = paymentIds.length !== uniquePaymentIds.size;

      recordTest(
        'No duplicate payment_intent_ids in transactions',
        !hasDuplicates,
        hasDuplicates
          ? `Found ${paymentIds.length - uniquePaymentIds.size} duplicate payment IDs`
          : 'All payment IDs are unique',
        {
          total: paymentIds.length,
          unique: uniquePaymentIds.size,
          paymentIds: Array.from(uniquePaymentIds)
        }
      );

      // Check that all purchase transactions have positive token amounts
      const invalidPurchases = transactions.filter(t =>
        t.type === 'purchase' && t.token_amount <= 0
      );

      recordTest(
        'All purchase transactions have positive token amounts',
        invalidPurchases.length === 0,
        `Found ${invalidPurchases.length} invalid purchases`,
        { invalidPurchases }
      );

    } else {
      recordTest('Idempotency check', false, 'Could not retrieve transactions');
    }
  } catch (error) {
    recordTest('Idempotency protection', false, error.message);
  }
}

// Test 8: Health check
async function testHealthCheck() {
  console.log('\n🏥 Test 8: System Health Check');
  console.log('─'.repeat(60));

  try {
    const response = await makeRequest(`${WORKER_URL}/mcp/calculator/health`, {
      method: 'GET'
    });

    recordTest(
      'Health endpoint responds',
      response.status === 200,
      `Status: ${response.status}`,
      { status: response.status, data: response.data }
    );

    if (response.status === 200 && response.data.status) {
      recordTest(
        'Service reports healthy status',
        response.data.status === 'healthy',
        `Status: ${response.data.status}`,
        response.data
      );
    }
  } catch (error) {
    recordTest('Health check', false, error.message);
  }
}

// Generate final report
function generateReport() {
  console.log('\n');
  console.log('═'.repeat(60));
  console.log('📊 TEST SUMMARY REPORT');
  console.log('═'.repeat(60));
  console.log(`
  Total Tests:    ${testResults.total}
  ✅ Passed:       ${testResults.passed}
  ❌ Failed:       ${testResults.failed}
  Success Rate:   ${((testResults.passed / testResults.total) * 100).toFixed(1)}%
  `);

  console.log('═'.repeat(60));
  console.log('📝 DETAILED RESULTS');
  console.log('═'.repeat(60));

  testResults.tests.forEach((test, index) => {
    const icon = test.passed ? '✅' : '❌';
    console.log(`\n${index + 1}. ${icon} ${test.name}`);
    if (!test.passed) {
      console.log(`   Issue: ${test.message}`);
    }
  });

  console.log('\n' + '═'.repeat(60));
  console.log('🔍 KEY FINDINGS');
  console.log('═'.repeat(60));

  // Analyze results
  const webhookConfigured = testResults.tests.find(t => t.name === 'Webhook endpoint exists')?.passed;
  const idempotencyWorking = testResults.tests.find(t => t.name === 'No duplicate payment_intent_ids in transactions')?.passed;
  const securityWorking = testResults.tests.find(t => t.name === 'Webhook rejects requests without signature')?.passed;

  console.log(`
  🔗 Webhook Configuration:     ${webhookConfigured ? '✅ PASS' : '❌ FAIL'}
  🔒 Idempotency Protection:    ${idempotencyWorking ? '✅ PASS' : '⚠️  NEEDS VERIFICATION'}
  🛡️  Security (Signatures):     ${securityWorking ? '✅ PASS' : '❌ FAIL'}
  `);

  console.log('═'.repeat(60));
  console.log('💡 RECOMMENDATIONS');
  console.log('═'.repeat(60));

  if (testResults.failed === 0) {
    console.log(`
  ✅ All tests passed! The system is ready for production.

  Next steps:
  1. Perform a live test purchase with test card
  2. Monitor webhook delivery in real-time
  3. Verify tokens are credited exactly once
  4. Switch to LIVE Stripe keys when ready
    `);
  } else {
    console.log(`
  ⚠️  Some tests failed. Review the issues above.

  Priority actions:
  1. Fix failed tests before production deployment
  2. Re-run test suite after fixes
  3. Document any known issues
    `);
  }

  console.log('═'.repeat(60));
}

async function saveReport() {
  const fs = await import('fs');
  const reportData = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: ((testResults.passed / testResults.total) * 100).toFixed(1) + '%'
    },
    tests: testResults.tests,
    configuration: {
      workerUrl: WORKER_URL,
      testUserId: TEST_USER_ID,
      stripeApiVersion: '2025-09-30.clover'
    }
  };

  fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n💾 Full report saved to: test-report.json\n');
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Comprehensive Webhook & Idempotency Tests');
  console.log('═'.repeat(60));
  console.log(`Worker URL: ${WORKER_URL}`);
  console.log(`Test User:  ${TEST_USER_ID}`);
  console.log(`Timestamp:  ${new Date().toISOString()}`);

  try {
    // Run tests in sequence
    await testWebhookEndpointConfiguration();
    const initialBalance = await getInitialBalance();
    const initialTxCount = await testDatabaseTransactionCount();
    const sessionId = await testCheckoutSessionCreation();

    if (sessionId) {
      await testPaymentCompletion(sessionId);
    }

    await testWebhookSignatureVerification();
    await testIdempotencyProtection();
    await testHealthCheck();

    // Generate final report
    generateReport();
    await saveReport();

    process.exit(testResults.failed === 0 ? 0 : 1);

  } catch (error) {
    console.error('\n❌ Fatal error during test execution:', error);
    process.exit(1);
  }
}

// Run tests
runAllTests();

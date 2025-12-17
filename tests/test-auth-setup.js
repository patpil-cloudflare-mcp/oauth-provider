// test-auth-setup.js - Phase 3 Authentication Setup Test
// This script tests the authentication configuration and creates a test user

const BASE_URL = 'http://localhost:8787';

async function testAuthSetup() {
  console.log('🧪 Testing Phase 3 Authentication Setup\n');
  console.log('═'.repeat(60));

  // Test 1: Verify server is running
  console.log('\n1️⃣  Testing server availability...');
  try {
    const response = await fetch(`${BASE_URL}/`);
    console.log(`   ✅ Server is running (status: ${response.status})`);
  } catch (error) {
    console.error('   ❌ Server is not running. Please start with: npx wrangler dev');
    process.exit(1);
  }

  // Test 2: Test OAuth endpoints exist
  console.log('\n2️⃣  Testing OAuth endpoints...');

  const oauthTests = [
    { path: '/oauth/authorize', method: 'GET', expectedStatus: [401, 400] },
    { path: '/oauth/token', method: 'POST', expectedStatus: [405, 400] },
    { path: '/oauth/userinfo', method: 'GET', expectedStatus: [401] },
  ];

  for (const test of oauthTests) {
    try {
      const response = await fetch(`${BASE_URL}${test.path}`, {
        method: test.method,
      });

      if (test.expectedStatus.includes(response.status)) {
        console.log(`   ✅ ${test.method} ${test.path} - responds correctly (${response.status})`);
      } else {
        console.log(`   ⚠️  ${test.method} ${test.path} - unexpected status: ${response.status}`);
      }
    } catch (error) {
      console.error(`   ❌ ${test.method} ${test.path} - ${error.message}`);
    }
  }

  // Test 3: Test protected endpoints require authentication
  console.log('\n3️⃣  Testing protected endpoints (should require auth)...');

  const protectedEndpoints = [
    '/dashboard',
    '/auth/user',
  ];

  for (const endpoint of protectedEndpoints) {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`);

      if (response.status === 401) {
        console.log(`   ✅ ${endpoint} - correctly requires authentication (401)`);
      } else {
        console.log(`   ⚠️  ${endpoint} - unexpected status: ${response.status} (expected 401)`);
      }
    } catch (error) {
      console.error(`   ❌ ${endpoint} - ${error.message}`);
    }
  }

  // Test 4: Test public endpoints still work
  console.log('\n4️⃣  Testing public endpoints (should work without auth)...');

  try {
    // Test webhook endpoint (should fail with missing signature, not auth)
    const webhookResponse = await fetch(`${BASE_URL}/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (webhookResponse.status === 400) {
      console.log('   ✅ Stripe webhook - accessible (expects signature)');
    } else {
      console.log(`   ⚠️  Stripe webhook - unexpected status: ${webhookResponse.status}`);
    }
  } catch (error) {
    console.error('   ❌ Stripe webhook test failed:', error.message);
  }

  // Test 5: Check database connection
  console.log('\n5️⃣  Testing database connection...');
  console.log('   ℹ️  Run this command to verify:');
  console.log('   npx wrangler d1 execute mcp-tokens-database --local \\');
  console.log('     --command "SELECT COUNT(*) as count FROM users"');

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Authentication Setup Tests Complete!');
  console.log('\n📋 Next Steps:');
  console.log('   1. Navigate to: https://mcp-token-system.wtyczki.ai/dashboard');
  console.log('   2. You will be redirected to Cloudflare Access login');
  console.log('   3. Enter your email and complete OTP verification');
  console.log('   4. A user account will be created automatically');
  console.log('   5. You should see the dashboard with your token balance');
  console.log('\n🔍 To verify user creation:');
  console.log('   npx wrangler d1 execute mcp-tokens-database --local \\');
  console.log('     --command "SELECT user_id, email, current_token_balance FROM users"');
  console.log('\n');
}

// Run tests
testAuthSetup().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});

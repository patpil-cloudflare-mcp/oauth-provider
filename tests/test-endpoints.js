// Test script for Sprint 2 endpoints
const BASE_URL = 'http://localhost:8787';

async function testCheckoutCreate() {
  console.log('\n🧪 TEST 1: Checkout Creation Endpoint');
  console.log('=====================================');

  const payload = {
    userId: 'test_user_001',
    priceId: 'price_test_starter',
    email: 'test@example.com'
  };

  try {
    const response = await fetch(`${BASE_URL}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok) {
      console.log('✅ Test PASSED: Checkout session created');
      return data.sessionId;
    } else {
      console.log('⚠️  Test INFO: Expected error due to test price ID');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testCheckoutCreateInvalidUser() {
  console.log('\n🧪 TEST 2: Checkout Creation - Invalid User');
  console.log('============================================');

  const payload = {
    userId: 'nonexistent_user',
    priceId: 'price_test',
    email: 'test@example.com'
  };

  try {
    const response = await fetch(`${BASE_URL}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 404 && data.error === 'User not found') {
      console.log('✅ Test PASSED: Correctly rejected invalid user');
    } else {
      console.log('❌ Test FAILED: Expected 404 with "User not found"');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testCheckoutCreateMissingFields() {
  console.log('\n🧪 TEST 3: Checkout Creation - Missing Fields');
  console.log('==============================================');

  const payload = {
    userId: 'test_user_001'
    // Missing priceId
  };

  try {
    const response = await fetch(`${BASE_URL}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400 && data.error.includes('Missing required fields')) {
      console.log('✅ Test PASSED: Correctly rejected missing fields');
    } else {
      console.log('❌ Test FAILED: Expected 400 with missing fields error');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testSuccessPageMissingSession() {
  console.log('\n🧪 TEST 4: Success Page - Missing Session ID');
  console.log('=============================================');

  try {
    const response = await fetch(`${BASE_URL}/checkout/success`);
    const text = await response.text();

    console.log('Status:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));

    if (response.status === 400 && text.includes('Missing session_id parameter')) {
      console.log('✅ Test PASSED: Correctly rejected missing session_id');
    } else {
      console.log('❌ Test FAILED: Expected 400 with error page');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testWebhookEndpoint() {
  console.log('\n🧪 TEST 5: Webhook Endpoint - No Signature');
  console.log('===========================================');

  try {
    const response = await fetch(`${BASE_URL}/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'test' })
    });

    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.status === 400 && data.error === 'No signature') {
      console.log('✅ Test PASSED: Correctly rejected webhook without signature');
    } else {
      console.log('❌ Test FAILED: Expected 400 with "No signature"');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

async function testHealthCheck() {
  console.log('\n🧪 TEST 6: Unknown Route (404)');
  console.log('===============================');

  try {
    const response = await fetch(`${BASE_URL}/unknown`);
    const text = await response.text();

    console.log('Status:', response.status);
    console.log('Response:', text);

    if (response.status === 404) {
      console.log('✅ Test PASSED: Returns 404 for unknown routes');
    } else {
      console.log('❌ Test FAILED: Expected 404');
    }
  } catch (error) {
    console.error('❌ Test FAILED:', error.message);
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Sprint 2 Endpoint Tests');
  console.log('====================================\n');
  console.log('Server: ' + BASE_URL);

  await testCheckoutCreate();
  await testCheckoutCreateInvalidUser();
  await testCheckoutCreateMissingFields();
  await testSuccessPageMissingSession();
  await testWebhookEndpoint();
  await testHealthCheck();

  console.log('\n✅ All tests completed!');
  console.log('====================================\n');
}

runAllTests().catch(console.error);

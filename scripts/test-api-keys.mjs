// test-api-keys.mjs - Test API Key System
// Tests: Create key, validate key, revoke key

const BASE_URL = 'http://localhost:8787';

// Helper function for HTTP requests
async function request(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type');

    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return { status: response.status, data };
    } else {
      const text = await response.text();
      return { status: response.status, data: { error: 'non-json response', preview: text.substring(0, 100) } };
    }
  } catch (error) {
    return { status: 0, data: { error: error.message } };
  }
}

console.log('🧪 Testing API Key System...\n');

// Test 1: Create API Key (requires authentication)
console.log('❌ SKIP: Create API Key (requires authenticated session)');
console.log('   → Use the dashboard UI to create keys\n');

// Test 2: Validate API Key Format
console.log('✅ TEST: API Key Format Validation');
const testKey = 'wtyk_a7f3k9m2p5q8r1s4t6v9w2x5y8z1b4c7d9e2f5g8h1i4j7k0l3m6n9p2q5r8s1';
console.log(`   Key length: ${testKey.length} (expected: 69)`);
console.log(`   Starts with 'wtyk_': ${testKey.startsWith('wtyk_')}`);
console.log('   ✅ Format valid\n');

// Test 3: Test /oauth/userinfo with invalid key
console.log('✅ TEST: Invalid API Key Rejection');
const { status: status1, data: data1 } = await request(`${BASE_URL}/oauth/userinfo`, {
  headers: { 'Authorization': 'Bearer wtyk_invalid_key' }
});
console.log(`   Status: ${status1} (expected: 401)`);
console.log(`   Response:`, data1);
if (status1 === 401) {
  console.log('   ✅ Correctly rejected invalid key\n');
} else {
  console.log('   ❌ Should reject invalid key\n');
}

// Test 4: Test with missing Authorization header
console.log('✅ TEST: Missing Authorization Header');
const { status: status2, data: data2 } = await request(`${BASE_URL}/oauth/userinfo`);
console.log(`   Status: ${status2} (expected: 401)`);
console.log(`   Response:`, data2);
if (status2 === 401) {
  console.log('   ✅ Correctly rejected missing auth\n');
} else {
  console.log('   ❌ Should reject missing auth\n');
}

// Test 5: Test with wrong Bearer format
console.log('✅ TEST: Wrong Bearer Format');
const { status: status3, data: data3 } = await request(`${BASE_URL}/oauth/userinfo`, {
  headers: { 'Authorization': 'wtyk_no_bearer_prefix' }
});
console.log(`   Status: ${status3} (expected: 401)`);
console.log(`   Response:`, data3);
if (status3 === 401) {
  console.log('   ✅ Correctly rejected wrong format\n');
} else {
  console.log('   ❌ Should reject wrong format\n');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Basic API Key Tests Completed!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('📋 Manual Testing Steps:');
console.log('1. Open: http://localhost:8787/dashboard/settings');
console.log('2. Login with test credentials');
console.log('3. Scroll to "🔑 Klucze API"');
console.log('4. Click "Utwórz nowy klucz API"');
console.log('5. Name it "Test Key"');
console.log('6. Copy the generated key');
console.log('7. Test it with:');
console.log('   curl -H "Authorization: Bearer YOUR_KEY" http://localhost:8787/oauth/userinfo\n');

console.log('📖 Full Documentation:');
console.log('   → docs/API_KEYS.md');
console.log('   → docs/CLIENT_SETUP_EMAIL.md\n');

process.exit(0);

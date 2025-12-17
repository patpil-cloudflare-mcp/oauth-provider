// Test real checkout creation with Stripe products
const BASE_URL = 'http://localhost:8787';

// Real price IDs from Stripe
const PRICE_ID_STARTER = 'price_1SJdj8CxCMDDEXzpiZ9SYQ7x';
const PRICE_ID_PLUS = 'price_1SIlbLCxCMDDEXzpnDMP47aj';
const PRICE_ID_PRO = 'price_1SIlbLCxCMDDEXzpBbdn6o22';
const PRICE_ID_GOLD = 'price_1SIlbLCxCMDDEXzpf7YBJcBY';

async function testRealCheckout() {
  console.log('\n🧪 Testing Real Checkout Creation');
  console.log('='.repeat(60));

  try {
    console.log('\n📦 Test 1: Creating Starter Package checkout session...');
    console.log('Price: 10 PLN → 500 tokens\n');

    const response = await fetch(`${BASE_URL}/checkout/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test_user_001',
        priceId: PRICE_ID_STARTER,
        email: 'test@example.com'
      })
    });

    const data = await response.json();

    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));

    if (response.ok && data.url) {
      console.log('\n✅ SUCCESS! Checkout session created');
      console.log('━'.repeat(60));
      console.log('Session ID:', data.sessionId);
      console.log('Checkout URL:', data.url);
      console.log('━'.repeat(60));
      console.log('\n📝 Next Steps:');
      console.log('1. Open the checkout URL in your browser');
      console.log('2. Use test card: 4242 4242 4242 4242');
      console.log('3. Any future expiry date + any CVC');
      console.log('4. Complete payment');
      console.log('5. You\'ll be redirected to success page');
      console.log('\n🔗 Or use Stripe CLI to test webhook:');
      console.log('   stripe listen --forward-to localhost:8787/stripe/webhook');

      return { success: true, data };
    } else {
      console.log('\n❌ FAILED: Could not create checkout session');
      return { success: false, data };
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    return { success: false, error: error.message };
  }
}

async function testAllPackages() {
  console.log('\n🧪 Testing All Package Types');
  console.log('='.repeat(60));

  const packages = [
    { name: 'Starter', priceId: PRICE_ID_STARTER, amount: '10 PLN', tokens: 500 },
    { name: 'Plus', priceId: PRICE_ID_PLUS, amount: '25 PLN', tokens: 2000 },
    { name: 'Pro', priceId: PRICE_ID_PRO, amount: '59 PLN', tokens: 5500 },
    { name: 'Gold', priceId: PRICE_ID_GOLD, amount: '119 PLN', tokens: 12000 }
  ];

  for (const pkg of packages) {
    console.log(`\n📦 Testing ${pkg.name} Package (${pkg.amount} → ${pkg.tokens} tokens)...`);

    try {
      const response = await fetch(`${BASE_URL}/checkout/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'test_user_001',
          priceId: pkg.priceId,
          email: 'test@example.com'
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log(`✅ ${pkg.name}: Session created - ${data.sessionId}`);
      } else {
        const error = await response.json();
        console.log(`❌ ${pkg.name}: Failed -`, error.error);
      }
    } catch (error) {
      console.log(`❌ ${pkg.name}: Error -`, error.message);
    }
  }

  console.log('\n' + '='.repeat(60));
}

// Run tests
console.log('\n🚀 Phase 2 - End-to-End Checkout Testing');
console.log('Server:', BASE_URL);
console.log('User:', 'test_user_001');

testRealCheckout()
  .then((result) => {
    if (result.success) {
      console.log('\n\n💡 Want to test all packages?');
      return testAllPackages();
    }
  })
  .then(() => {
    console.log('\n✅ All tests completed!\n');
  })
  .catch(console.error);

// Script to verify and rotate Stripe webhook
import Stripe from 'stripe';

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
  console.error('❌ Error: STRIPE_SECRET_KEY environment variable not set');
  console.error('Set it with: export STRIPE_SECRET_KEY=sk_test_...');
  process.exit(1);
}

const EXPECTED_URL = 'https://api.wtyczki.ai/stripe/webhook';
const EXPECTED_API_VERSION = '2025-09-30.clover';
const REQUIRED_EVENT = 'checkout.session.completed';

const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: EXPECTED_API_VERSION,
});

async function verifyAndRotateWebhook() {
  console.log('🔍 Checking current webhook configuration...\n');
  console.log('═'.repeat(60));

  try {
    // Step 1: List all webhooks
    const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
    console.log(`📋 Found ${endpoints.data.length} webhook endpoint(s)\n`);

    // Step 2: Find webhook for our worker
    const ourEndpoints = endpoints.data.filter(ep =>
      ep.url.includes('api.wtyczki.ai') || ep.url.includes('mcp-token-system')
    );

    if (ourEndpoints.length === 0) {
      console.log('⚠️  No webhook found for api.wtyczki.ai or mcp-token-system');
      console.log('   This is expected if the old webhook was deleted.\n');
    } else {
      console.log(`🔗 Found ${ourEndpoints.length} webhook(s) for our worker:\n`);

      ourEndpoints.forEach((ep, index) => {
        console.log(`   Webhook ${index + 1}:`);
        console.log(`   - ID: ${ep.id}`);
        console.log(`   - URL: ${ep.url}`);
        console.log(`   - Status: ${ep.status}`);
        console.log(`   - API Version: ${ep.api_version}`);
        console.log(`   - Events: ${ep.enabled_events.join(', ')}`);
        console.log(`   - Created: ${new Date(ep.created * 1000).toISOString()}`);
        console.log();
      });
    }

    // Step 3: Check if correct webhook exists
    const correctWebhook = endpoints.data.find(ep =>
      ep.url === EXPECTED_URL &&
      ep.api_version === EXPECTED_API_VERSION &&
      ep.enabled_events.includes(REQUIRED_EVENT) &&
      ep.status === 'enabled'
    );

    if (correctWebhook) {
      console.log('✅ WEBHOOK CORRECTLY CONFIGURED');
      console.log('═'.repeat(60));
      console.log(`   URL: ${correctWebhook.url}`);
      console.log(`   API Version: ${correctWebhook.api_version}`);
      console.log(`   Events: ${correctWebhook.enabled_events.join(', ')}`);
      console.log(`   Status: ${correctWebhook.status}`);
      console.log('\n⚠️  Webhook Secret:');
      console.log('   The signing secret (whsec_...) is only shown once during creation.');
      console.log('   If you need to verify it, you must create a new webhook.\n');
      console.log('💡 Next steps:');
      console.log('   1. If you suspect the secret was compromised, delete this webhook and create a new one');
      console.log('   2. Otherwise, you can keep using this webhook');
      return;
    }

    // Step 4: If no correct webhook, offer to create one
    console.log('❌ NO CORRECT WEBHOOK FOUND');
    console.log('═'.repeat(60));
    console.log('Expected configuration:');
    console.log(`   - URL: ${EXPECTED_URL}`);
    console.log(`   - API Version: ${EXPECTED_API_VERSION}`);
    console.log(`   - Event: ${REQUIRED_EVENT}`);
    console.log(`   - Status: enabled`);
    console.log();

    // Step 5: Delete old webhooks (if any)
    if (ourEndpoints.length > 0) {
      console.log('🗑️  Deleting old webhook(s)...\n');

      for (const ep of ourEndpoints) {
        console.log(`   Deleting webhook: ${ep.id} (${ep.url})`);
        try {
          await stripe.webhookEndpoints.del(ep.id);
          console.log(`   ✅ Deleted successfully`);
        } catch (error) {
          console.log(`   ❌ Failed to delete: ${error.message}`);
        }
        console.log();
      }
    }

    // Step 6: Create new webhook
    console.log('🔧 Creating new webhook...\n');

    const newEndpoint = await stripe.webhookEndpoints.create({
      url: EXPECTED_URL,
      enabled_events: [REQUIRED_EVENT],
      api_version: EXPECTED_API_VERSION,
      description: 'MCP Token System - Production webhook'
    });

    console.log('✅ NEW WEBHOOK CREATED SUCCESSFULLY!');
    console.log('═'.repeat(60));
    console.log(`   Webhook ID: ${newEndpoint.id}`);
    console.log(`   URL: ${newEndpoint.url}`);
    console.log(`   API Version: ${newEndpoint.api_version}`);
    console.log(`   Events: ${newEndpoint.enabled_events.join(', ')}`);
    console.log(`   Status: ${newEndpoint.status}`);
    console.log();
    console.log('🔐 SIGNING SECRET (SAVE THIS - SHOWN ONLY ONCE):');
    console.log('═'.repeat(60));
    console.log(`   ${newEndpoint.secret}`);
    console.log('═'.repeat(60));
    console.log();
    console.log('📝 NEXT STEPS:');
    console.log('   1. Copy the signing secret above (starts with whsec_...)');
    console.log('   2. Update Cloudflare Worker secret:');
    console.log('      npx wrangler secret put STRIPE_WEBHOOK_SECRET');
    console.log('   3. Paste the secret when prompted');
    console.log('   4. Test the webhook with a purchase');
    console.log();

    // Save webhook configuration to file for reference
    const config = {
      webhook_id: newEndpoint.id,
      url: newEndpoint.url,
      api_version: newEndpoint.api_version,
      events: newEndpoint.enabled_events,
      created_at: new Date().toISOString(),
      note: 'IMPORTANT: The signing secret (whsec_...) is NOT saved here. Update it in Cloudflare Worker secrets immediately.'
    };

    const fs = await import('fs');
    fs.writeFileSync('webhook-config.json', JSON.stringify(config, null, 2));
    console.log('💾 Webhook configuration saved to: webhook-config.json');
    console.log('   (Note: Secret is NOT saved in this file for security)');
    console.log();

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    process.exit(1);
  }
}

// Run the verification and rotation
verifyAndRotateWebhook();

#!/usr/bin/env node

/**
 * Test Webhook Endpoint
 * This script tests if the webhook endpoint is accessible and responding
 */

const http = require('http');

console.log('Testing webhook endpoint accessibility...\n');

// Test 1: Health check
console.log('Test 1: Health Check Endpoint');
http.get('http://localhost:8080/api/health', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Backend is running!');
      console.log('Response:', data);
      console.log('');

      // Test 2: Webhook endpoint (should fail without signature)
      console.log('Test 2: Webhook Endpoint (expect 400 error - this is normal)');
      const postData = JSON.stringify({ test: 'data' });

      const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/webhook/stripe',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode === 400 && data.includes('Webhook Error')) {
            console.log('✅ Webhook endpoint is accessible!');
            console.log('Status Code:', res.statusCode);
            console.log('Response:', data);
            console.log('');
            console.log('========================================');
            console.log('✅ Backend is properly configured!');
            console.log('========================================');
            console.log('');
            console.log('Next steps:');
            console.log('1. Make sure Stripe CLI is running:');
            console.log('   stripe listen --forward-to http://localhost:8080/api/webhook/stripe');
            console.log('');
            console.log('2. Copy the webhook secret from Stripe CLI output');
            console.log('3. Update .env file with the secret');
            console.log('4. Restart backend server');
            console.log('5. Make a test payment');
          } else {
            console.log('⚠️  Unexpected response from webhook endpoint');
            console.log('Status Code:', res.statusCode);
            console.log('Response:', data);
          }
        });
      });

      req.on('error', (e) => {
        console.error('❌ Error accessing webhook endpoint:', e.message);
      });

      req.write(postData);
      req.end();

    } else {
      console.log('❌ Backend returned unexpected status:', res.statusCode);
    }
  });
}).on('error', (e) => {
  console.error('❌ Cannot connect to backend!');
  console.error('Error:', e.message);
  console.error('');
  console.error('Make sure the backend is running:');
  console.error('  cd /home/user/fraud-risk-detection-payment-gateway/fraudwallet/backend');
  console.error('  npm start');
});

#!/usr/bin/env node

/**
 * Generate proper bcrypt hashes for seed data passwords
 */

const bcrypt = require('bcrypt');

const password = 'Test1234!';
const saltRounds = 10;

async function generateHashes() {
  console.log('Generating bcrypt hash for password: Test1234!');
  console.log('This will be used for all test users\n');

  try {
    const hash = await bcrypt.hash(password, saltRounds);
    console.log('Generated hash:');
    console.log(hash);
    console.log('\n✅ Copy this hash into seed.sql to replace $2b$10$YourBcryptHashHere');
    console.log('\nTest users will be:');
    console.log('  - john@test.com / Test1234!');
    console.log('  - jane@test.com / Test1234!');
    console.log('  - bob@test.com / Test1234!');
    console.log('  - alice@test.com / Test1234!');
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

generateHashes();

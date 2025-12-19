#!/usr/bin/env node

/**
 * Auto-Approval Cron Job
 *
 * Automatically approves fraud detections that have been idle for 24+ hours
 * Only approves REVIEW actions with LOW/MEDIUM/MINIMAL risk levels
 *
 * Run this script via cron every hour:
 * 0 * * * * /usr/bin/node /path/to/auto-approve-cron.js >> /var/log/fraud-auto-approve.log 2>&1
 */

const path = require('path');

// Set up database path
process.chdir(path.join(__dirname, '..'));

const fraudLogger = require('../src/fraud-detection/monitoring/fraudLogger');

console.log('='.repeat(60));
console.log(`⏰ Auto-Approval Job Started: ${new Date().toISOString()}`);
console.log('='.repeat(60));

try {
  const result = fraudLogger.autoApprovePendingReviews();

  if (result.success) {
    console.log(`✅ Auto-approval completed successfully`);
    console.log(`   - Logs processed: ${result.count}`);
    if (result.count > 0) {
      console.log(`   - Approved IDs: ${result.logs.join(', ')}`);
    }
  } else {
    console.error(`❌ Auto-approval failed: ${result.error}`);
    process.exit(1);
  }
} catch (error) {
  console.error(`❌ Fatal error during auto-approval:`, error);
  process.exit(1);
}

console.log('='.repeat(60));
console.log(`✅ Auto-Approval Job Completed: ${new Date().toISOString()}`);
console.log('='.repeat(60));

process.exit(0);

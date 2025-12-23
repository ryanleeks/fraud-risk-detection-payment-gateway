// Fraud Monitoring Tool
// Run this to check fraud detection results

const db = require('../../database');

console.log('='.repeat(80));
console.log('🚨 FRAUD DETECTION MONITORING DASHBOARD');
console.log('='.repeat(80));
console.log();

// 1. High-risk users (users with high fraud scores)
console.log('📊 HIGH-RISK USERS (Risk Score >= 60):');
console.log('-'.repeat(80));

const highRiskUsers = db.prepare(`
  SELECT
    u.id,
    u.full_name,
    u.account_id,
    fl.risk_score,
    fl.risk_level,
    fl.action_taken,
    fl.amount,
    fl.transaction_type,
    fl.rules_triggered,
    fl.created_at
  FROM fraud_logs fl
  JOIN users u ON fl.user_id = u.id
  WHERE fl.risk_score >= 60
  ORDER BY fl.created_at DESC
  LIMIT 20
`).all();

if (highRiskUsers.length === 0) {
  console.log('✅ No high-risk transactions detected');
} else {
  highRiskUsers.forEach((user, index) => {
    console.log(`${index + 1}. User: ${user.full_name} (ID: ${user.id}, Account: ${user.account_id})`);
    console.log(`   Risk Score: ${user.risk_score}/100 (${user.risk_level})`);
    console.log(`   Action: ${user.action_taken}`);
    console.log(`   Transaction: ${user.transaction_type} - RM${user.amount.toFixed(2)}`);
    console.log(`   Rules: ${user.rules_triggered}`);
    console.log(`   Time: ${user.created_at}`);
    console.log();
  });
}

console.log();
console.log('='.repeat(80));

// 2. Users with most fraud flags
console.log('👥 TOP 10 USERS BY FRAUD FLAGS:');
console.log('-'.repeat(80));

const topFlaggedUsers = db.prepare(`
  SELECT
    u.id,
    u.full_name,
    u.account_id,
    COUNT(*) as total_flags,
    AVG(fl.risk_score) as avg_risk_score,
    MAX(fl.risk_score) as max_risk_score,
    SUM(CASE WHEN fl.action_taken = 'BLOCK' THEN 1 ELSE 0 END) as blocked_count,
    SUM(CASE WHEN fl.action_taken = 'REVIEW' THEN 1 ELSE 0 END) as review_count
  FROM fraud_logs fl
  JOIN users u ON fl.user_id = u.id
  WHERE fl.created_at > datetime('now', '-7 days')
  GROUP BY u.id
  ORDER BY avg_risk_score DESC
  LIMIT 10
`).all();

if (topFlaggedUsers.length === 0) {
  console.log('✅ No fraud flags in last 7 days');
} else {
  topFlaggedUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.full_name} (${user.account_id})`);
    console.log(`   Total Flags: ${user.total_flags}`);
    console.log(`   Avg Risk Score: ${user.avg_risk_score.toFixed(1)}/100`);
    console.log(`   Max Risk Score: ${user.max_risk_score}/100`);
    console.log(`   Blocked: ${user.blocked_count} | Review: ${user.review_count}`);
    console.log();
  });
}

console.log();
console.log('='.repeat(80));

// 3. Most triggered fraud rules
console.log('🔥 MOST TRIGGERED FRAUD RULES (Last 7 Days):');
console.log('-'.repeat(80));

const topRules = db.prepare(`
  SELECT
    rules_triggered,
    COUNT(*) as frequency,
    AVG(risk_score) as avg_score
  FROM fraud_logs
  WHERE created_at > datetime('now', '-7 days')
  AND rules_triggered != '[]'
  GROUP BY rules_triggered
  ORDER BY frequency DESC
  LIMIT 10
`).all();

if (topRules.length === 0) {
  console.log('✅ No rules triggered in last 7 days');
} else {
  topRules.forEach((rule, index) => {
    const rules = JSON.parse(rule.rules_triggered);
    console.log(`${index + 1}. Rules: ${rules.join(', ')}`);
    console.log(`   Triggered: ${rule.frequency} times`);
    console.log(`   Avg Score: ${rule.avg_score.toFixed(1)}/100`);
    console.log();
  });
}

console.log();
console.log('='.repeat(80));

// 4. System-wide statistics
console.log('📈 SYSTEM-WIDE FRAUD STATISTICS (Last 24 Hours):');
console.log('-'.repeat(80));

const systemStats = db.prepare(`
  SELECT
    COUNT(*) as total_checks,
    AVG(risk_score) as avg_risk_score,
    SUM(CASE WHEN action_taken = 'BLOCK' THEN 1 ELSE 0 END) as blocked,
    SUM(CASE WHEN action_taken = 'REVIEW' THEN 1 ELSE 0 END) as review,
    SUM(CASE WHEN action_taken = 'CHALLENGE' THEN 1 ELSE 0 END) as challenge,
    SUM(CASE WHEN action_taken = 'ALLOW' THEN 1 ELSE 0 END) as allowed,
    AVG(execution_time_ms) as avg_execution_time
  FROM fraud_logs
  WHERE created_at > datetime('now', '-24 hours')
`).get();

console.log(`Total Fraud Checks: ${systemStats.total_checks || 0}`);
console.log(`Average Risk Score: ${systemStats.avg_risk_score ? systemStats.avg_risk_score.toFixed(2) : 0}/100`);
console.log(`Blocked Transactions: ${systemStats.blocked || 0}`);
console.log(`Flagged for Review: ${systemStats.review || 0}`);
console.log(`Challenge Required: ${systemStats.challenge || 0}`);
console.log(`Allowed: ${systemStats.allowed || 0}`);
console.log(`Avg Execution Time: ${systemStats.avg_execution_time ? systemStats.avg_execution_time.toFixed(2) : 0}ms`);

if (systemStats.total_checks > 0) {
  const detectionRate = ((systemStats.blocked + systemStats.review) / systemStats.total_checks * 100).toFixed(2);
  console.log(`Detection Rate: ${detectionRate}%`);
}

console.log();
console.log('='.repeat(80));

// 5. Risk level distribution
console.log('📊 RISK LEVEL DISTRIBUTION (Last 24 Hours):');
console.log('-'.repeat(80));

const riskDistribution = db.prepare(`
  SELECT
    risk_level,
    COUNT(*) as count
  FROM fraud_logs
  WHERE created_at > datetime('now', '-24 hours')
  GROUP BY risk_level
  ORDER BY
    CASE risk_level
      WHEN 'CRITICAL' THEN 1
      WHEN 'HIGH' THEN 2
      WHEN 'MEDIUM' THEN 3
      WHEN 'LOW' THEN 4
      WHEN 'MINIMAL' THEN 5
      ELSE 6
    END
`).all();

if (riskDistribution.length === 0) {
  console.log('✅ No fraud checks in last 24 hours');
} else {
  riskDistribution.forEach(level => {
    const bar = '█'.repeat(Math.ceil(level.count / 2));
    console.log(`${level.risk_level.padEnd(10)}: ${bar} (${level.count})`);
  });
}

console.log();
console.log('='.repeat(80));
console.log('✅ Fraud monitoring dashboard complete!');
console.log('='.repeat(80));

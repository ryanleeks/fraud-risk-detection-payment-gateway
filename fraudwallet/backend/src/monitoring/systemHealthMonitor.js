/**
 * System Health Monitor
 * Records system performance metrics every 1 minute
 * For academic research and system performance analysis
 */

const db = require('../database');
const os = require('os');

class SystemHealthMonitor {
  constructor() {
    this.interval = null;
    this.isRunning = false;
  }

  /**
   * Calculate fraud detection metrics from last minute
   */
  getRecentFraudMetrics() {
    try {
      const metrics = db.prepare(`
        SELECT
          COUNT(*) as total_checks,
          AVG(execution_time_ms) as avg_response_time,
          AVG(ai_response_time) as ai_avg_response_time,
          AVG(execution_time_ms - COALESCE(ai_response_time, 0)) as rule_avg_response_time,
          MAX(execution_time_ms) as peak_response_time,
          MIN(execution_time_ms) as min_response_time
        FROM fraud_logs
        WHERE created_at >= datetime('now', '-1 minute')
      `).get();

      return metrics || {
        total_checks: 0,
        avg_response_time: 0,
        ai_avg_response_time: 0,
        rule_avg_response_time: 0,
        peak_response_time: 0,
        min_response_time: 0
      };
    } catch (error) {
      console.error('Error getting fraud metrics:', error);
      return {
        total_checks: 0,
        avg_response_time: 0,
        ai_avg_response_time: 0,
        rule_avg_response_time: 0,
        peak_response_time: 0,
        min_response_time: 0
      };
    }
  }

  /**
   * Get current system health metrics
   */
  getCurrentHealth() {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    // Calculate CPU usage
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (let type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

    // Test database latency
    const dbStart = Date.now();
    try {
      db.prepare('SELECT 1').get();
    } catch (e) {
      console.error('DB health check error:', e);
    }
    const dbLatency = Date.now() - dbStart;

    // Check AI connection status
    let aiStatus = 'unknown';
    try {
      const geminiAI = require('../fraud-detection/geminiAI');
      aiStatus = geminiAI.enabled ? 'connected' : 'disabled';
    } catch (e) {
      aiStatus = 'error';
    }

    return {
      cpu_usage: cpuUsage,
      cpu_cores: cpus.length,
      memory_usage_percent: (usedMem / totalMem) * 100,
      memory_used_mb: usedMem / 1024 / 1024,
      memory_total_mb: totalMem / 1024 / 1024,
      db_latency_ms: dbLatency,
      ai_connection_status: aiStatus,
      uptime_seconds: os.uptime()
    };
  }

  /**
   * Record current metrics to database
   */
  recordMetrics() {
    try {
      const health = this.getCurrentHealth();
      const fraudMetrics = this.getRecentFraudMetrics();

      db.prepare(`
        INSERT INTO system_health_logs (
          cpu_usage, cpu_cores, memory_usage_percent, memory_used_mb, memory_total_mb,
          db_latency_ms, ai_connection_status, uptime_seconds,
          ai_avg_response_time, rule_avg_response_time, total_checks,
          peak_response_time, min_response_time, avg_response_time, checks_per_minute
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        health.cpu_usage,
        health.cpu_cores,
        health.memory_usage_percent,
        health.memory_used_mb,
        health.memory_total_mb,
        health.db_latency_ms,
        health.ai_connection_status,
        health.uptime_seconds,
        fraudMetrics.ai_avg_response_time || 0,
        fraudMetrics.rule_avg_response_time || 0,
        fraudMetrics.total_checks || 0,
        fraudMetrics.peak_response_time || 0,
        fraudMetrics.min_response_time || 0,
        fraudMetrics.avg_response_time || 0,
        fraudMetrics.total_checks || 0
      );

      // Cleanup old records (keep last 30 days only)
      db.prepare(`
        DELETE FROM system_health_logs
        WHERE created_at < datetime('now', '-30 days')
      `).run();

    } catch (error) {
      console.error('❌ Health monitoring error:', error);
    }
  }

  /**
   * Start monitoring service
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️  System health monitoring is already running');
      return;
    }

    console.log('📊 Starting system health monitoring (1-minute interval)...');

    // Record immediately on start
    this.recordMetrics();

    // Then record every 1 minute (60000 ms)
    this.interval = setInterval(() => {
      this.recordMetrics();
    }, 60000);

    this.isRunning = true;
    console.log('✅ System health monitoring started');
  }

  /**
   * Stop monitoring service
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      this.isRunning = false;
      console.log('🛑 System health monitoring stopped');
    }
  }

  /**
   * Get monitoring status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.interval ? '1 minute' : 'stopped'
    };
  }
}

// Export singleton instance
module.exports = new SystemHealthMonitor();

"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Shield,
  Clock,
  Zap,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Brain,
  Info,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Cpu,
  MemoryStick,
  Database,
  Wifi
} from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"

// Rule definitions
const RULE_CATALOG = {
  velocity: [
    { id: "VEL-001", name: "High Frequency", description: "More than 5 transactions per minute", weight: 25 },
    { id: "VEL-002", name: "Rapid Sequential", description: "Transactions less than 5 seconds apart", weight: 20 },
    { id: "VEL-003", name: "Excessive Daily", description: "More than 20 transactions in 24 hours", weight: 15 },
    { id: "VEL-004", name: "Velocity Spike", description: "Transaction rate 5x higher than average", weight: 20 },
    { id: "VEL-005", name: "Multiple Failed Attempts", description: "Multiple failed transactions in short period", weight: 15 },
  ],
  amount: [
    { id: "AMT-001", name: "Large Transaction", description: "Single transaction exceeds RM50,000", weight: 30 },
    { id: "AMT-002", name: "Structuring", description: "Amount between RM9,500-9,999 (just under reporting threshold)", weight: 25 },
    { id: "AMT-003", name: "Round Numbers", description: "Suspiciously round amounts (e.g., RM10,000)", weight: 10 },
    { id: "AMT-004", name: "Micro-transactions", description: "Very small amounts under RM1 (card testing)", weight: 15 },
    { id: "AMT-005", name: "Repetitive Amounts", description: "Same exact amount sent multiple times", weight: 15 },
    { id: "AMT-006", name: "Pattern Deviation", description: "Amount 10x higher than user's average", weight: 20 },
    { id: "AMT-007", name: "Daily Limit Exceeded", description: "Total daily amount exceeds RM100,000", weight: 25 },
    { id: "AMT-008", name: "Unusual Decimal Precision", description: "Oddly specific decimal amounts", weight: 5 },
  ],
  behavioral: [
    { id: "BEH-001", name: "New Account High-Value", description: "High-value transaction from account less than 7 days old", weight: 30 },
    { id: "BEH-002", name: "First Transaction High-Value", description: "User's very first transaction is unusually large", weight: 20 },
    { id: "BEH-003", name: "Dormant Account Reactivation", description: "Account inactive for 90+ days suddenly active", weight: 15 },
    { id: "BEH-004", name: "Unusual Time", description: "Transaction at odd hours (2-6 AM)", weight: 10 },
    { id: "BEH-005", name: "Circular Transfers", description: "Money sent and received in circular pattern", weight: 25 },
    { id: "BEH-006", name: "Multiple Recipients", description: "Sending to many different recipients in short time", weight: 20 },
    { id: "BEH-007", name: "Rapid Withdrawal", description: "Quick withdrawal after deposit (possible money laundering)", weight: 15 },
    { id: "BEH-008", name: "High Weekend Activity", description: "Unusually high transaction volume on weekends", weight: 8 },
    { id: "BEH-009", name: "Repetitive Recipient", description: "Multiple transactions to same recipient", weight: 12 },
    { id: "BEH-010", name: "Account Balance Draining", description: "Attempting to drain entire account balance", weight: 15 },
  ]
}

interface SystemMetrics {
  totalChecks: number
  avgResponseTime: number
  riskDistribution: {
    minimal: number
    low: number
    medium: number
    high: number
    critical: number
  }
  actionDistribution: {
    allow: number
    challenge: number
    review: number
    block: number
  }
  topRules: Array<{ ruleId: string; count: number }>
}

interface AIMetrics {
  totalAnalyses: number
  avgConfidence: number
  avgRiskScore: number
  avgResponseTime: number
  topRedFlags: Array<{ flag: string; count: number }>
  disagreementRate: number
  aiEnabled: boolean
}

interface SystemHealth {
  cpu: {
    usage: number
    cores: number
    model: string
  }
  memory: {
    totalMB: number
    usedMB: number
    freeMB: number
    usagePercent: number
    process: {
      heapUsedMB: number
      heapTotalMB: number
      rssMB: number
    }
  }
  latency: {
    api: number
    database: number
  }
  connections: {
    ai: {
      status: string
      latency: number
    }
    database: {
      status: string
    }
  }
  uptime: number
  timestamp: string
}

export function FraudEngineTab() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [aiMetrics, setAIMetrics] = useState<AIMetrics | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedCategory, setExpandedCategory] = useState<string | null>("velocity")

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      // Fetch system metrics
      const systemResponse = await fetch("/api/fraud/system-metrics", { headers })
      const systemData = await systemResponse.json()

      // Fetch AI metrics
      const aiResponse = await fetch("/api/fraud/ai-metrics", { headers })
      const aiData = await aiResponse.json()

      // Fetch system health
      const healthResponse = await fetch("/api/fraud/system-health", { headers })
      const healthData = await healthResponse.json()

      if (systemData.success) {
        setSystemMetrics(systemData.metrics)
      }

      if (aiData.success) {
        setAIMetrics(aiData.metrics)
      }

      if (healthData.success) {
        setSystemHealth(healthData.health)
      }
    } catch (err) {
      console.error("Load metrics error:", err)
    } finally {
      setLoading(false)
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadData,
  })

  useEffect(() => {
    loadData()
  }, [])

  if (loading || !systemMetrics || !aiMetrics) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-sm text-muted-foreground">Loading fraud engine details...</p>
      </div>
    )
  }

  const toggleCategory = (category: string) => {
    setExpandedCategory(expandedCategory === category ? null : category)
  }

  const getRuleCount = (ruleId: string) => {
    const rule = systemMetrics?.topRules?.find(r => r.ruleId === ruleId)
    return rule ? rule.count : 0
  }

  // Safe access helpers with defaults
  const safeNum = (value: number | undefined, decimals = 0): string => {
    return (value ?? 0).toFixed(decimals)
  }

  const safePercent = (numerator: number | undefined, denominator: number | undefined): string => {
    const num = numerator ?? 0
    const denom = denominator ?? 1
    if (denom === 0) return "0.0"
    return ((num / denom) * 100).toFixed(1)
  }

  return (
    <div ref={containerRef} className="space-y-6 pb-20 overflow-y-auto h-full">
      <PullToRefreshIndicator
        isPulling={isPulling}
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={threshold}
      />

      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">Fraud Engine Details</h2>
        <p className="text-sm text-muted-foreground">
          How our fraud detection system works - rules, scoring, and AI analysis
        </p>
      </div>

      {/* Section 1: System Status */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">System Status</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">AI Detection</p>
            </div>
            <Badge variant={aiMetrics?.aiEnabled ? "default" : "secondary"} className="text-sm">
              {aiMetrics?.aiEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">AI Response Time</p>
            </div>
            <p className="text-xl font-bold">{safeNum(aiMetrics?.avgResponseTime)}ms</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Rule Response Time</p>
            </div>
            <p className="text-xl font-bold">{safeNum(systemMetrics?.avgResponseTime)}ms</p>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Checks (24h)</p>
            </div>
            <p className="text-xl font-bold">{systemMetrics?.totalChecks ?? 0}</p>
          </div>
        </div>

        {/* Resource Usage & Latency */}
        {systemHealth && (
          <div className="mt-6 pt-6 border-t">
            <h4 className="font-semibold mb-4 text-sm">Resource Usage & Performance</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* CPU Usage */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">CPU Usage</p>
                </div>
                <p className="text-xl font-bold">{safeNum(systemHealth.cpu?.usage, 1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">{systemHealth.cpu?.cores} cores</p>
              </div>

              {/* Memory Usage */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MemoryStick className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Memory Usage</p>
                </div>
                <p className="text-xl font-bold">{safeNum(systemHealth.memory?.usagePercent, 1)}%</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {systemHealth.memory?.usedMB}MB / {systemHealth.memory?.totalMB}MB
                </p>
              </div>

              {/* Database Latency */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">Database Latency</p>
                </div>
                <p className="text-xl font-bold">{systemHealth.latency?.database ?? 0}ms</p>
                <Badge variant="outline" className="mt-1 text-xs">
                  {systemHealth.connections?.database?.status}
                </Badge>
              </div>

              {/* AI Connection */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wifi className="h-4 w-4 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">AI Connection</p>
                </div>
                <Badge
                  variant={systemHealth.connections?.ai?.status === 'connected' ? "default" : "secondary"}
                  className="text-sm"
                >
                  {systemHealth.connections?.ai?.status}
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  Uptime: {Math.floor((systemHealth.uptime ?? 0) / 60)}m
                </p>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Section 2: Rule Analytics & Catalog */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Rule Analytics & Catalog</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Our fraud detection system uses 23 rules across 3 categories. Each rule contributes points to the overall risk score.
        </p>

        {/* Top Triggered Rules */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-sm">Most Triggered Rules</h4>
          <div className="space-y-2">
            {(systemMetrics?.topRules ?? []).slice(0, 5).map((rule, idx) => {
              // Find rule details
              const allRules = [...RULE_CATALOG.velocity, ...RULE_CATALOG.amount, ...RULE_CATALOG.behavioral]
              const ruleDetails = allRules.find(r => r.id === rule.ruleId)

              return (
                <div key={rule.ruleId} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                      {idx + 1}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{ruleDetails?.name || rule.ruleId}</p>
                      <p className="text-xs text-muted-foreground">{ruleDetails?.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{rule.count}</p>
                    <p className="text-xs text-muted-foreground">triggers</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Rule Categories */}
        <div className="space-y-3">
          {/* Velocity Rules */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleCategory("velocity")}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-yellow-600" />
                <div className="text-left">
                  <h4 className="font-semibold">Velocity Rules</h4>
                  <p className="text-xs text-muted-foreground">Transaction frequency and speed patterns</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{RULE_CATALOG.velocity.length} rules</Badge>
                {expandedCategory === "velocity" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {expandedCategory === "velocity" && (
              <div className="p-4 pt-0 space-y-2">
                {RULE_CATALOG.velocity.map(rule => (
                  <div key={rule.id} className="p-3 rounded bg-muted/30">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-semibold">{rule.id}</span>
                      <Badge variant="secondary" className="text-xs">{rule.weight} points</Badge>
                    </div>
                    <p className="font-semibold text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Triggered {getRuleCount(rule.id)} times recently
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Amount Rules */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleCategory("amount")}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div className="text-left">
                  <h4 className="font-semibold">Amount Rules</h4>
                  <p className="text-xs text-muted-foreground">Transaction amount and pattern analysis</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{RULE_CATALOG.amount.length} rules</Badge>
                {expandedCategory === "amount" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {expandedCategory === "amount" && (
              <div className="p-4 pt-0 space-y-2">
                {RULE_CATALOG.amount.map(rule => (
                  <div key={rule.id} className="p-3 rounded bg-muted/30">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-semibold">{rule.id}</span>
                      <Badge variant="secondary" className="text-xs">{rule.weight} points</Badge>
                    </div>
                    <p className="font-semibold text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Triggered {getRuleCount(rule.id)} times recently
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Behavioral Rules */}
          <div className="border rounded-lg">
            <button
              onClick={() => toggleCategory("behavioral")}
              className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Activity className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <h4 className="font-semibold">Behavioral Rules</h4>
                  <p className="text-xs text-muted-foreground">User behavior and account activity patterns</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{RULE_CATALOG.behavioral.length} rules</Badge>
                {expandedCategory === "behavioral" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </button>
            {expandedCategory === "behavioral" && (
              <div className="p-4 pt-0 space-y-2">
                {RULE_CATALOG.behavioral.map(rule => (
                  <div key={rule.id} className="p-3 rounded bg-muted/30">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs font-semibold">{rule.id}</span>
                      <Badge variant="secondary" className="text-xs">{rule.weight} points</Badge>
                    </div>
                    <p className="font-semibold text-sm">{rule.name}</p>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Triggered {getRuleCount(rule.id)} times recently
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Section 3: Risk Scoring Explained */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Risk Scoring System</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Risk scores range from 0-100 and determine the action taken on each transaction.
        </p>

        {/* Risk Thresholds */}
        <div className="space-y-3 mb-6">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border-l-4 border-green-500">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">0-19: MINIMAL</span>
              <Badge className="bg-green-600">ALLOW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Very low risk - transaction proceeds immediately</p>
          </div>

          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border-l-4 border-green-400">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">20-39: LOW</span>
              <Badge className="bg-green-600">ALLOW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Low risk - transaction proceeds with logging</p>
          </div>

          <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">40-59: MEDIUM</span>
              <Badge className="bg-yellow-600">CHALLENGE</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Moderate risk - requires 2FA or additional verification</p>
          </div>

          <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border-l-4 border-orange-500">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">60-79: HIGH</span>
              <Badge className="bg-orange-600">REVIEW</Badge>
            </div>
            <p className="text-xs text-muted-foreground">High risk - flagged for manual review by fraud team</p>
          </div>

          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border-l-4 border-red-500">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold">80-100: CRITICAL</span>
              <Badge className="bg-red-600">BLOCK</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Critical risk - transaction blocked immediately</p>
          </div>
        </div>

        {/* Action Distribution */}
        <div>
          <h4 className="font-semibold mb-3 text-sm">Action Distribution (Recent Transactions)</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-3 bg-green-50 dark:bg-green-950/20">
              <p className="text-xs text-muted-foreground mb-1">ALLOW</p>
              <p className="text-2xl font-bold text-green-600">{systemMetrics?.actionDistribution?.allow ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {safePercent(systemMetrics?.actionDistribution?.allow, systemMetrics?.totalChecks)}%
              </p>
            </Card>

            <Card className="p-3 bg-yellow-50 dark:bg-yellow-950/20">
              <p className="text-xs text-muted-foreground mb-1">CHALLENGE</p>
              <p className="text-2xl font-bold text-yellow-600">{systemMetrics?.actionDistribution?.challenge ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {safePercent(systemMetrics?.actionDistribution?.challenge, systemMetrics?.totalChecks)}%
              </p>
            </Card>

            <Card className="p-3 bg-orange-50 dark:bg-orange-950/20">
              <p className="text-xs text-muted-foreground mb-1">REVIEW</p>
              <p className="text-2xl font-bold text-orange-600">{systemMetrics?.actionDistribution?.review ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {safePercent(systemMetrics?.actionDistribution?.review, systemMetrics?.totalChecks)}%
              </p>
            </Card>

            <Card className="p-3 bg-red-50 dark:bg-red-950/20">
              <p className="text-xs text-muted-foreground mb-1">BLOCK</p>
              <p className="text-2xl font-bold text-red-600">{systemMetrics?.actionDistribution?.block ?? 0}</p>
              <p className="text-xs text-muted-foreground">
                {safePercent(systemMetrics?.actionDistribution?.block, systemMetrics?.totalChecks)}%
              </p>
            </Card>
          </div>
        </div>

        {/* Score Calculation */}
        <Card className="mt-6 p-4 bg-blue-50/50 dark:bg-blue-950/20">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">How Scores are Calculated:</p>
              <ol className="space-y-1 text-muted-foreground list-decimal list-inside">
                <li><strong>Base Score:</strong> Sum of all triggered rule weights</li>
                <li><strong>Severity Multiplier:</strong> 1.0-1.5x based on HIGH severity rules</li>
                <li><strong>Rule Count Multiplier:</strong> 1.0-1.5x based on number of rules triggered</li>
                <li><strong>Final Score:</strong> Base × Severity × Count (capped at 100)</li>
              </ol>
            </div>
          </div>
        </Card>
      </Card>

      {/* Section 4: AI Analysis Insights */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">AI Analysis Insights</h3>
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Our AI (Google Gemini Pro) provides advanced fraud detection beyond rule-based systems.
        </p>

        {/* AI Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">AI Confidence</p>
            </div>
            <p className="text-3xl font-bold">{safeNum(aiMetrics?.avgConfidence, 1)}%</p>
            <p className="text-xs text-muted-foreground mt-1">Average confidence score</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">AI Risk Score</p>
            </div>
            <p className="text-3xl font-bold">{safeNum(aiMetrics?.avgRiskScore, 1)}</p>
            <p className="text-xs text-muted-foreground mt-1">Average AI-assigned risk</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Total Analyses</p>
            </div>
            <p className="text-3xl font-bold">{aiMetrics?.totalAnalyses ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">AI fraud checks performed</p>
          </Card>
        </div>

        {/* Most Common Red Flags */}
        <div className="mb-6">
          <h4 className="font-semibold mb-3 text-sm">Most Common AI-Identified Red Flags</h4>
          <div className="space-y-2">
            {(aiMetrics?.topRedFlags ?? []).slice(0, 8).map((redFlag, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-red-50 dark:bg-red-950/20">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <p className="text-sm">{redFlag.flag}</p>
                </div>
                <Badge variant="secondary">{redFlag.count} times</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* AI vs Rules Comparison */}
        <Card className="p-4 bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex gap-3">
            <Brain className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold">AI vs Rules</p>
              <p className="text-muted-foreground">
                AI disagreement rate: <strong>{safeNum((aiMetrics?.disagreementRate ?? 0) * 100, 1)}%</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                The AI analyzes context that rules can't capture, such as complex patterns, user behavior anomalies,
                and sophisticated fraud techniques. When AI and rules disagree, it's often because the AI detected
                subtle indicators that rules miss, or identified a legitimate edge case that triggered rule thresholds.
              </p>
            </div>
          </div>
        </Card>
      </Card>
    </div>
  )
}

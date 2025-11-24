"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Shield, Activity, TrendingUp, Users, AlertCircle, CheckCircle, XCircle } from "lucide-react"

interface FraudLog {
  id: number
  user_id: number
  full_name: string
  account_id: string
  transaction_type: string
  amount: number
  risk_score: number
  risk_level: string
  action_taken: string
  rules_triggered: any[]
  created_at: string
}

interface SystemMetrics {
  totalChecks: number
  blockedTransactions: number
  reviewedTransactions: number
  averageRiskScore: number
  highRiskUsers: number
}

interface TopFlaggedUser {
  user_id: number
  full_name: string
  account_id: string
  total_flags: number
  avg_risk_score: number
  max_risk_score: number
  blocked_count: number
  review_count: number
  last_flagged: string
}

export function FraudDashboardTab() {
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [highRiskUsers, setHighRiskUsers] = useState<FraudLog[]>([])
  const [topFlaggedUsers, setTopFlaggedUsers] = useState<TopFlaggedUser[]>([])
  const [recentLogs, setRecentLogs] = useState<FraudLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<"overview" | "high-risk" | "flagged" | "recent">("overview")

  useEffect(() => {
    loadFraudData()
  }, [])

  const loadFraudData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      // Fetch system metrics
      const metricsResponse = await fetch("http://localhost:8080/api/fraud/system-metrics", { headers })
      const metricsData = await metricsResponse.json()
      if (metricsData.success) {
        setSystemMetrics(metricsData.metrics)
      }

      // Fetch high-risk users
      const highRiskResponse = await fetch("http://localhost:8080/api/fraud/high-risk-users?limit=10&minScore=60", { headers })
      const highRiskData = await highRiskResponse.json()
      if (highRiskData.success && highRiskData.users) {
        setHighRiskUsers(highRiskData.users)
      } else {
        setHighRiskUsers([])
      }

      // Fetch top flagged users
      const flaggedResponse = await fetch("http://localhost:8080/api/fraud/top-flagged-users?limit=10&days=7", { headers })
      const flaggedData = await flaggedResponse.json()
      if (flaggedData.success && flaggedData.users) {
        setTopFlaggedUsers(flaggedData.users)
      } else {
        setTopFlaggedUsers([])
      }

      // Fetch recent logs
      const logsResponse = await fetch("http://localhost:8080/api/fraud/recent-logs?limit=20", { headers })
      const logsData = await logsResponse.json()
      if (logsData.success && logsData.logs) {
        setRecentLogs(logsData.logs)
      } else {
        setRecentLogs([])
      }
    } catch (err) {
      console.error("Load fraud data error:", err)
      // Reset to safe defaults on error
      setHighRiskUsers([])
      setTopFlaggedUsers([])
      setRecentLogs([])
    } finally {
      setLoading(false)
    }
  }

  const getRiskLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "critical":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      case "high":
        return "bg-orange-500/10 text-orange-600 border-orange-500/20"
      case "medium":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
      case "low":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  const getActionIcon = (action: string) => {
    switch (action.toLowerCase()) {
      case "block":
        return <XCircle className="h-4 w-4" />
      case "review":
        return <AlertCircle className="h-4 w-4" />
      case "challenge":
        return <AlertTriangle className="h-4 w-4" />
      case "allow":
        return <CheckCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading fraud data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="h-7 w-7 text-primary" />
            SecureTrack
          </h1>
          <p className="text-sm text-muted-foreground">Track your wallet's fraud risks and patterns</p>
        </div>
        <Button onClick={loadFraudData} variant="outline" size="sm">
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      {activeView === "overview" && (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total Checks</p>
                  <p className="text-2xl font-bold">{systemMetrics?.totalChecks || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Last 24h</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Activity className="h-6 w-6 text-primary" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Blocked</p>
                  <p className="text-2xl font-bold text-red-600">{systemMetrics?.blockedTransactions || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Transactions</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Avg Risk Score</p>
                  <p className="text-2xl font-bold">{systemMetrics?.averageRiskScore?.toFixed(1) || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Out of 100</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">High Risk</p>
                  <p className="text-2xl font-bold text-orange-600">{systemMetrics?.highRiskUsers || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Users</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                  <Users className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </Card>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              onClick={() => setActiveView("high-risk")}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              High Risk Users
            </Button>
            <Button
              onClick={() => setActiveView("flagged")}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Top Flagged
            </Button>
            <Button
              onClick={() => setActiveView("recent")}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              Recent Logs
            </Button>
          </div>
        </>
      )}

      {/* High-Risk Users View */}
      {activeView === "high-risk" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">High-Risk Users (Score ≥ 60)</h2>
            <Button onClick={() => setActiveView("overview")} variant="ghost" size="sm">
              Back
            </Button>
          </div>

          {!highRiskUsers || highRiskUsers.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
              <p>No high-risk users found</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {highRiskUsers?.map((user) => (
                <Card key={user.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.account_id}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full border ${getRiskLevelColor(user.risk_level)}`}>
                      {user.risk_level}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{user.transaction_type} • RM {user.amount.toFixed(2)}</span>
                    <div className="flex items-center gap-1">
                      {getActionIcon(user.action_taken)}
                      <span className="font-semibold">Score: {user.risk_score}</span>
                    </div>
                  </div>
                  {user.rules_triggered && user.rules_triggered.length > 0 && (
                    <div className="mt-2 pt-2 border-t">
                      <p className="text-xs text-muted-foreground mb-1">Triggered Rules:</p>
                      <div className="flex flex-wrap gap-1">
                        {user.rules_triggered.slice(0, 3).map((rule: any, idx: number) => (
                          <span key={idx} className="text-xs px-2 py-0.5 bg-muted rounded">
                            {rule.ruleId}
                          </span>
                        ))}
                        {user.rules_triggered.length > 3 && (
                          <span className="text-xs px-2 py-0.5 bg-muted rounded">
                            +{user.rules_triggered.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top Flagged Users View */}
      {activeView === "flagged" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Top Flagged Users (Last 7 Days)</h2>
            <Button onClick={() => setActiveView("overview")} variant="ghost" size="sm">
              Back
            </Button>
          </div>

          {!topFlaggedUsers || topFlaggedUsers.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
              <p>No flagged users in the last 7 days</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {topFlaggedUsers?.map((user, idx) => (
                <Card key={user.user_id} className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.account_id}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Flags</p>
                      <p className="text-sm font-bold">{user.total_flags}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Avg Score</p>
                      <p className="text-sm font-bold">{user.avg_risk_score.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Max Score</p>
                      <p className="text-sm font-bold">{user.max_risk_score}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{user.blocked_count} blocked • {user.review_count} reviewed</span>
                    <span>{formatDate(user.last_flagged)}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Logs View */}
      {activeView === "recent" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent Fraud Checks</h2>
            <Button onClick={() => setActiveView("overview")} variant="ghost" size="sm">
              Back
            </Button>
          </div>

          {!recentLogs || recentLogs.length === 0 ? (
            <Card className="p-6 text-center text-muted-foreground">
              <Activity className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No recent fraud checks</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {recentLogs?.map((log) => (
                <Card key={log.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      {getActionIcon(log.action_taken)}
                      <span className="text-sm font-medium">{log.transaction_type}</span>
                    </div>
                    <span className="text-sm font-bold">RM {log.amount.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{formatDate(log.created_at)}</span>
                    <span className={`px-2 py-0.5 rounded-full border ${getRiskLevelColor(log.risk_level)}`}>
                      Score: {log.risk_score}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

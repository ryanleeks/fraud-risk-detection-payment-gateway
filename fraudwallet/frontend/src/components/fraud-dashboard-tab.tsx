"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Shield, Activity, TrendingUp, Users, AlertCircle, CheckCircle, XCircle, Heart, FileQuestion, MessageSquare, Clock } from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"
import { TimeDisplay } from "@/components/TimeDisplay"

interface DashboardMetrics {
  scannedTotal: number
  blocked: number
  highRisk: number
  appeals: number
}

interface FraudFlag {
  id: number
  risk_score: number
  risk_level: string
  action_taken: string
  amount: number
  transaction_type: string
  created_at: string
  ground_truth?: string
  auto_approved_at?: string
  auto_approval_source?: string
  appeal_status: string
  status_label: string
}

interface Appeal {
  id: number
  fraud_log_id: number
  reason: string
  status: string
  created_at: string
  resolved_at?: string
  admin_notes?: string
  resolved_by_name?: string
}

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

interface UserStats {
  total_checks: number
  avg_risk_score: number
  max_risk_score: number
  blocked_count: number
  review_count: number
  critical_count: number
  high_count: number
  simple_avg_risk_score?: number
  health?: {
    score: number
    simpleAverage: number
    improvement: number
    transactionCount: number
    method: string
    dateRange?: {
      oldest: string
      newest: string
      spanDays: number
    }
  }
  recovery?: {
    recovered: boolean
    currentScore: number
    targetScore: number
    estimatedDays?: number
    estimatedWeeks?: number
    message?: string
    advice?: string[]
  }
  trend?: Array<{
    period: string
    days: number
    avgScore: number | null
    transactionCount: number
  }>
  improving?: boolean
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
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetrics | null>(null)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [highRiskUsers, setHighRiskUsers] = useState<FraudLog[]>([])
  const [topFlaggedUsers, setTopFlaggedUsers] = useState<TopFlaggedUser[]>([])
  const [recentLogs, setRecentLogs] = useState<FraudLog[]>([])
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([])
  const [myAppeals, setMyAppeals] = useState<Appeal[]>([])
  const [appealing, setAppealing] = useState<number | null>(null)
  const [appealReason, setAppealReason] = useState<{ [key: number]: string }>({})
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<"dashboard" | "scanned" | "blocked" | "highRisk" | "appeals" | "overview" | "high-risk" | "flagged" | "recent">("dashboard")

  const submitAppeal = async (fraudLogId: number) => {
    const reason = appealReason[fraudLogId]
    if (!reason || reason.trim().length === 0) {
      alert("Please provide a reason for your appeal")
      return
    }

    setAppealing(fraudLogId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/fraud/appeal/${fraudLogId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      })

      const data = await response.json()
      if (data.success) {
        // Clear appeal reason
        setAppealReason((prev) => {
          const updated = { ...prev }
          delete updated[fraudLogId]
          return updated
        })
        // Reload data
        await loadFraudData()
        alert("Appeal submitted successfully")
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (err) {
      console.error("Submit appeal error:", err)
      alert("Failed to submit appeal")
    } finally {
      setAppealing(null)
    }
  }

  const getStatusBadge = (flag: FraudFlag) => {
    switch (flag.status_label) {
      case "pending_review":
        return (
          <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        )
      case "blocked":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        )
      case "auto_approved":
        return (
          <Badge variant="outline" className="bg-blue-50 border-blue-300 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Auto-Approved
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 border-green-300 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "confirmed_fraud":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Confirmed Fraud
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getAppealStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-800">
            Pending Review
          </Badge>
        )
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-50 border-green-300 text-green-800">
            Approved
          </Badge>
        )
      case "rejected":
        return <Badge variant="destructive">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const canAppeal = (flag: FraudFlag) => {
    return (
      (flag.status_label === "blocked" || flag.status_label === "confirmed_fraud") &&
      flag.appeal_status === "none"
    )
  }

  // Calculate weekly stats from recent logs
  const getWeeklyStats = () => {
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const weeklyLogs = recentLogs.filter(log => {
      const logDate = new Date(log.created_at)
      return logDate >= sevenDaysAgo
    })

    const blocked = weeklyLogs.filter(log => log.action_taken.toLowerCase() === 'block').length
    const highRisk = weeklyLogs.filter(log => ['high', 'critical'].includes(log.risk_level.toLowerCase())).length
    const total = weeklyLogs.length

    return { total, blocked, highRisk }
  }

  // Check if risk score is trending up (alert condition)
  const isRiskTrendingUp = () => {
    const avgScore = userStats?.avg_risk_score || 0
    const maxScore = userStats?.max_risk_score || 0

    // Alert if average is high or if max score is significantly higher than average
    return avgScore >= 60 || (maxScore - avgScore) >= 30
  }

  const loadFraudData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      // Fetch dashboard metrics
      const dashboardResponse = await fetch("/api/fraud/user-dashboard", { headers })
      const dashboardData = await dashboardResponse.json()
      if (dashboardData.success && dashboardData.metrics) {
        setDashboardMetrics(dashboardData.metrics)
      } else {
        setDashboardMetrics({
          scannedTotal: 0,
          blocked: 0,
          highRisk: 0,
          appeals: 0
        })
      }

      // Fetch user's personal stats
      const userStatsResponse = await fetch("/api/fraud/user-stats", { headers })
      const userStatsData = await userStatsResponse.json()
      if (userStatsData.success && userStatsData.stats) {
        setUserStats(userStatsData.stats)
      } else {
        // Set default values when no data
        setUserStats({
          total_checks: 0,
          avg_risk_score: 0,
          max_risk_score: 0,
          blocked_count: 0,
          review_count: 0,
          critical_count: 0,
          high_count: 0
        })
      }

      // Fetch system metrics
      const metricsResponse = await fetch("/api/fraud/system-metrics", { headers })
      const metricsData = await metricsResponse.json()
      if (metricsData.success && metricsData.metrics) {
        setSystemMetrics(metricsData.metrics)
      } else {
        // Set default values when no data
        setSystemMetrics({
          totalChecks: 0,
          blockedTransactions: 0,
          reviewedTransactions: 0,
          averageRiskScore: 0,
          highRiskUsers: 0
        })
      }

      // Fetch high-risk users
      const highRiskResponse = await fetch("/api/fraud/high-risk-users?limit=10&minScore=60", { headers })
      const highRiskData = await highRiskResponse.json()
      if (highRiskData.success && highRiskData.users) {
        setHighRiskUsers(highRiskData.users)
      } else {
        setHighRiskUsers([])
      }

      // Fetch top flagged users
      const flaggedResponse = await fetch("/api/fraud/top-flagged-users?limit=10&days=7", { headers })
      const flaggedData = await flaggedResponse.json()
      if (flaggedData.success && flaggedData.users) {
        setTopFlaggedUsers(flaggedData.users)
      } else {
        setTopFlaggedUsers([])
      }

      // Fetch recent logs
      const logsResponse = await fetch("/api/fraud/recent-logs?limit=20", { headers })
      const logsData = await logsResponse.json()
      if (logsData.success && logsData.logs) {
        setRecentLogs(logsData.logs)
      } else {
        setRecentLogs([])
      }

      // Fetch fraud flags
      const flagsResponse = await fetch("/api/fraud/my-flags", { headers })
      const flagsData = await flagsResponse.json()
      if (flagsData.success) {
        setFraudFlags(flagsData.flags || [])
      } else {
        setFraudFlags([])
      }

      // Fetch my appeals
      const appealsResponse = await fetch("/api/fraud/appeals/my-appeals", { headers })
      const appealsData = await appealsResponse.json()
      if (appealsData.success) {
        setMyAppeals(appealsData.appeals || [])
      } else {
        setMyAppeals([])
      }
    } catch (err) {
      console.error("Load fraud data error:", err)
      // Reset to safe defaults on error
      setDashboardMetrics({
        scannedTotal: 0,
        blocked: 0,
        highRisk: 0,
        appeals: 0
      })
      setUserStats({
        total_checks: 0,
        avg_risk_score: 0,
        max_risk_score: 0,
        blocked_count: 0,
        review_count: 0,
        critical_count: 0,
        high_count: 0
      })
      setSystemMetrics({
        totalChecks: 0,
        blockedTransactions: 0,
        reviewedTransactions: 0,
        averageRiskScore: 0,
        highRiskUsers: 0
      })
      setHighRiskUsers([])
      setTopFlaggedUsers([])
      setRecentLogs([])
    } finally {
      setLoading(false)
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadFraudData,
  })

  useEffect(() => {
    loadFraudData()
  }, [])

  const getTrustworthinessLevel = (avgRiskScore: number) => {
    if (avgRiskScore === 0) return { level: "Excellent", color: "bg-green-600", textColor: "text-green-600", percentage: 100 }
    if (avgRiskScore < 20) return { level: "Excellent", color: "bg-green-600", textColor: "text-green-600", percentage: 90 }
    if (avgRiskScore < 40) return { level: "Good", color: "bg-blue-600", textColor: "text-blue-600", percentage: 70 }
    if (avgRiskScore < 60) return { level: "Fair", color: "bg-yellow-600", textColor: "text-yellow-600", percentage: 50 }
    if (avgRiskScore < 80) return { level: "Poor", color: "bg-orange-600", textColor: "text-orange-600", percentage: 30 }
    return { level: "Critical", color: "bg-red-600", textColor: "text-red-600", percentage: 10 }
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
    <div ref={containerRef} className="relative h-full overflow-y-auto">
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={threshold}
      />
      <div
        className="space-y-6 p-6"
        style={{
          transform: `translateY(${isPulling ? pullDistance : 0}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-7 w-7 text-primary" />
              SecureTrack
            </h1>
            <p className="text-sm text-muted-foreground">Track your wallet's fraud risks and patterns</p>
          </div>
        </div>

        {/* Dashboard Metrics */}
        {activeView === "dashboard" && (
          <>
            {/* Risk Score Health Bar */}
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className={`h-5 w-5 ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).textColor}`} />
                    <h3 className="font-semibold">Account Security Status</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Alert Notification */}
                    {isRiskTrendingUp() && (
                      <Badge variant="destructive" className="text-xs animate-pulse">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Alert
                      </Badge>
                    )}
                    <span className={`text-sm font-bold ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).textColor}`}>
                      {getTrustworthinessLevel(userStats?.avg_risk_score || 0).level}
                    </span>
                  </div>
                </div>

                {/* Health Bar */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).color} transition-all duration-500`}
                      style={{ width: `${getTrustworthinessLevel(userStats?.avg_risk_score || 0).percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avg Risk Score: {userStats?.avg_risk_score?.toFixed(1) || 0}/100</span>
                    <span>{userStats?.total_checks || 0} transactions scanned</span>
                  </div>
                </div>

                {/* Quick Stats Summary (Last 7 Days) */}
                {recentLogs.length > 0 && (
                  <div className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded-lg">
                    <Activity className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Last 7 days:</span>
                    <span className="font-medium">{getWeeklyStats().total} scanned</span>
                    {getWeeklyStats().blocked > 0 && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-medium text-red-600">{getWeeklyStats().blocked} blocked</span>
                      </>
                    )}
                    {getWeeklyStats().highRisk > 0 && (
                      <>
                        <span className="text-muted-foreground">•</span>
                        <span className="font-medium text-orange-600">{getWeeklyStats().highRisk} high risk</span>
                      </>
                    )}
                  </div>
                )}

                {/* Status Message */}
                {(userStats?.total_checks || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(userStats?.avg_risk_score || 0) < 40
                      ? "🎉 Excellent! Your account shows low risk activity. Keep up the secure practices!"
                      : (userStats?.avg_risk_score || 0) < 60
                      ? "⚠️ Your account has moderate risk. Consider reviewing your transaction patterns."
                      : "🚨 Your account shows high risk activity. Please contact support if you need assistance."}
                  </p>
                )}

                {/* Health Regeneration Info */}
                {userStats?.health && userStats.health.improvement > 0 && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-semibold text-green-700 dark:text-green-400">
                        Health Regeneration Active!
                      </span>
                    </div>
                    <p className="text-xs text-green-600 dark:text-green-500 mb-2">
                      Your score has improved by <strong>{userStats.health.improvement.toFixed(1)} points</strong> thanks to time-weighted decay.
                      Old transactions matter less over time.
                    </p>
                    {userStats.simple_avg_risk_score && (
                      <div className="text-xs text-muted-foreground">
                        Simple average: {userStats.simple_avg_risk_score.toFixed(1)} → Time-weighted: {userStats.avg_risk_score.toFixed(1)}
                      </div>
                    )}
                  </div>
                )}

                {/* Recovery Estimate */}
                {userStats?.recovery && !userStats.recovery.recovered && (userStats?.avg_risk_score || 0) > 20 && (
                  <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">
                        Recovery Timeline
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-500 mb-2">
                      {userStats.recovery.message}
                    </p>
                    {userStats.recovery.estimatedDays && (
                      <div className="text-xs text-muted-foreground mb-2">
                        Estimated time to reach "Good" health (score ≤20): <strong>~{userStats.recovery.estimatedWeeks} weeks</strong>
                      </div>
                    )}
                    {userStats.recovery.advice && userStats.recovery.advice.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs font-medium text-blue-700 dark:text-blue-400">How to improve:</div>
                        {userStats.recovery.advice.map((tip, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                            <span className="text-blue-500">•</span>
                            <span>{tip}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Trend Indicator */}
                {userStats?.improving && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-green-600 dark:text-green-500">
                    <TrendingUp className="h-3 w-3" />
                    <span>Your health is improving over time!</span>
                  </div>
                )}
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              {/* Scanned Total Card */}
              <Card
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveView("scanned")}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Scanned Total</p>
                    <p className="text-3xl font-bold text-blue-600">{dashboardMetrics?.scannedTotal || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">All logs</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/10">
                    <Shield className="h-6 w-6 text-blue-600" />
                  </div>
                </div>
              </Card>

              {/* Blocked Card */}
              <Card
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveView("blocked")}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Blocked</p>
                    <p className="text-3xl font-bold text-red-600">{dashboardMetrics?.blocked || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Transactions</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
                    <XCircle className="h-6 w-6 text-red-600" />
                  </div>
                </div>
              </Card>

              {/* High Risk Card */}
              <Card
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveView("highRisk")}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">High Risk</p>
                    <p className="text-3xl font-bold text-orange-600">{dashboardMetrics?.highRisk || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Transactions</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/10">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </Card>

              {/* Appeals Card */}
              <Card
                className="p-4 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setActiveView("appeals")}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Appeals</p>
                    <p className="text-3xl font-bold text-purple-600">{dashboardMetrics?.appeals || 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Under review</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10">
                    <FileQuestion className="h-6 w-6 text-purple-600" />
                  </div>
                </div>
              </Card>
            </div>
          </>
        )}

        {/* Overview Cards */}
        {activeView === "overview" && (
          <>
            {/* Trustworthiness Health Bar */}
            <Card className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className={`h-5 w-5 ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).textColor}`} />
                    <h3 className="font-semibold">Account Trustworthiness</h3>
                  </div>
                  <span className={`text-sm font-bold ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).textColor}`}>
                    {getTrustworthinessLevel(userStats?.avg_risk_score || 0).level}
                  </span>
                </div>

                {/* Health Bar */}
                <div className="space-y-2">
                  <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${getTrustworthinessLevel(userStats?.avg_risk_score || 0).color} transition-all duration-500`}
                      style={{ width: `${getTrustworthinessLevel(userStats?.avg_risk_score || 0).percentage}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Avg Risk Score: {userStats?.avg_risk_score?.toFixed(1) || 0}/100</span>
                    <span>{userStats?.total_checks || 0} transactions checked</span>
                  </div>
                </div>

                {(userStats?.avg_risk_score || 0) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {(userStats?.avg_risk_score || 0) < 40
                      ? "Great! Your account shows low risk activity. Keep up the secure practices!"
                      : (userStats?.avg_risk_score || 0) < 60
                      ? "Your account has moderate risk. Consider reviewing your transaction patterns."
                      : "Your account shows high risk activity. Please contact support if you need assistance."}
                  </p>
                )}
              </div>
            </Card>

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
            <h2 className="text-lg font-semibold">High-Risk Users (Risk Score ≥ 60)</h2>
            <Button onClick={() => setActiveView("overview")} variant="ghost" size="sm">
              ← Back
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
                      <span className="font-semibold">Risk Score: {user.risk_score}</span>
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
              ← Back
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
                      <p className="text-xs text-muted-foreground">Avg Risk</p>
                      <p className="text-sm font-bold">{user.avg_risk_score.toFixed(1)}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-2">
                      <p className="text-xs text-muted-foreground">Max Risk</p>
                      <p className="text-sm font-bold">{user.max_risk_score}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{user.blocked_count} blocked • {user.review_count} reviewed</span>
                    <TimeDisplay
                      utcDate={user.last_flagged}
                      format="full"
                      showBadge={true}
                      className="text-xs"
                    />
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
              ← Back
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
                    <TimeDisplay
                      utcDate={log.created_at}
                      format="full"
                      showBadge={true}
                      className="text-xs text-muted-foreground"
                    />
                    <span className={`px-2 py-0.5 rounded-full border ${getRiskLevelColor(log.risk_level)}`}>
                      Risk Score: {log.risk_score}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
          </div>
        )}

        {/* Scanned Total View - All Logs */}
        {activeView === "scanned" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">All Scanned Transactions</h2>
              <Button onClick={() => setActiveView("dashboard")} variant="ghost" size="sm">
                ← Back to Dashboard
              </Button>
            </div>

            {!recentLogs || recentLogs.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-2 opacity-50 text-blue-600" />
                <p>No transactions scanned yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentLogs.map((log) => (
                  <Card key={log.id} className="p-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.action_taken)}
                        <span className="text-sm font-medium">{log.transaction_type}</span>
                      </div>
                      <span className="text-sm font-bold">RM {log.amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <TimeDisplay
                        utcDate={log.created_at}
                        format="full"
                        showBadge={true}
                        className="text-xs text-muted-foreground"
                      />
                      <span className={`px-2 py-0.5 rounded-full border ${getRiskLevelColor(log.risk_level)}`}>
                        Risk Score: {log.risk_score}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Blocked Transactions View */}
        {activeView === "blocked" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Blocked Transactions</h2>
              <Button onClick={() => setActiveView("dashboard")} variant="ghost" size="sm">
                ← Back to Dashboard
              </Button>
            </div>

            {recentLogs.filter(log => log.action_taken.toLowerCase() === 'block').length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
                <p>No blocked transactions</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentLogs
                  .filter(log => log.action_taken.toLowerCase() === 'block')
                  .map((log) => (
                    <Card key={log.id} className="p-3 border-red-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <XCircle className="h-4 w-4 text-red-600" />
                          <span className="text-sm font-medium">{log.transaction_type}</span>
                        </div>
                        <span className="text-sm font-bold">RM {log.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <TimeDisplay
                          utcDate={log.created_at}
                          format="full"
                          showBadge={true}
                          className="text-xs text-muted-foreground"
                        />
                        <span className={`px-2 py-0.5 rounded-full border ${getRiskLevelColor(log.risk_level)}`}>
                          Risk Score: {log.risk_score}
                        </span>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* High Risk Transactions View */}
        {activeView === "highRisk" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">High Risk Transactions</h2>
              <Button onClick={() => setActiveView("dashboard")} variant="ghost" size="sm">
                ← Back to Dashboard
              </Button>
            </div>

            {recentLogs.filter(log => ['high', 'critical'].includes(log.risk_level.toLowerCase())).length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50 text-green-600" />
                <p>No high risk transactions</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {recentLogs
                  .filter(log => ['high', 'critical'].includes(log.risk_level.toLowerCase()))
                  .map((log) => (
                    <Card key={log.id} className="p-3 border-orange-200">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium">{log.transaction_type}</span>
                        </div>
                        <span className="text-sm font-bold">RM {log.amount.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <TimeDisplay
                          utcDate={log.created_at}
                          format="full"
                          showBadge={true}
                          className="text-xs text-muted-foreground"
                        />
                        <span className={`px-2 py-0.5 rounded-full border ${getRiskLevelColor(log.risk_level)}`}>
                          Risk Score: {log.risk_score}
                        </span>
                      </div>
                    </Card>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Appeals View */}
        {activeView === "appeals" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">My Fraud Alerts & Appeals</h2>
              <Button onClick={() => setActiveView("dashboard")} variant="ghost" size="sm">
                ← Back to Dashboard
              </Button>
            </div>

            {/* Fraud Flags Section */}
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Fraud Detection Flags</h3>
              {fraudFlags.length === 0 ? (
                <Card className="p-8 text-center">
                  <Shield className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h4 className="font-semibold mb-1">No Fraud Flags</h4>
                  <p className="text-sm text-muted-foreground">
                    Your account has no fraud detections
                  </p>
                </Card>
              ) : (
                fraudFlags.map((flag) => (
                  <Card key={flag.id} className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-5 w-5 text-orange-500" />
                            <h4 className="font-semibold">Fraud Detection Alert</h4>
                          </div>
                          {getStatusBadge(flag)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Risk: {flag.risk_score}/100
                        </Badge>
                      </div>

                      {/* Transaction Info */}
                      <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="ml-2 font-medium">RM{flag.amount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-medium">{flag.transaction_type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Action:</span>
                          <span className="ml-2 font-medium">{flag.action_taken}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Risk Level:</span>
                          <span className="ml-2 font-medium">{flag.risk_level}</span>
                        </div>
                      </div>

                      {/* Timestamp */}
                      <div className="text-xs text-muted-foreground">
                        Detected: <TimeDisplay utcDate={flag.created_at} format="full" />
                      </div>

                      {/* Auto-approval info */}
                      {flag.auto_approval_source === "auto_24hr" && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm text-blue-800">
                          This transaction was automatically approved after 24 hours of review
                        </div>
                      )}

                      {/* Appeal Section */}
                      {canAppeal(flag) && (
                        <div className="border-t pt-3 mt-3">
                          <p className="text-sm font-medium mb-2">
                            Think this was a mistake? Submit an appeal:
                          </p>
                          <Textarea
                            value={appealReason[flag.id] || ""}
                            onChange={(e) =>
                              setAppealReason((prev) => ({ ...prev, [flag.id]: e.target.value }))
                            }
                            placeholder="Explain why this detection was incorrect..."
                            rows={3}
                            className="text-sm mb-2"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => submitAppeal(flag.id)}
                            disabled={appealing === flag.id}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            {appealing === flag.id ? "Submitting..." : "Submit Appeal"}
                          </Button>
                        </div>
                      )}

                      {/* Appeal Status */}
                      {flag.appeal_status !== "none" && (
                        <div className="bg-muted/30 p-3 rounded-lg text-sm">
                          <span className="font-medium">Appeal Status: </span>
                          {getAppealStatusBadge(flag.appeal_status)}
                        </div>
                      )}
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* My Appeals Section */}
            {myAppeals.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold">My Appeals History</h3>
                {myAppeals.map((appeal) => (
                  <Card key={appeal.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            <h4 className="font-semibold text-sm">Appeal #{appeal.id}</h4>
                          </div>
                          {getAppealStatusBadge(appeal.status)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <TimeDisplay utcDate={appeal.created_at} format="relative" />
                        </div>
                      </div>

                      <div className="bg-muted/30 p-3 rounded-lg text-sm">
                        <p className="font-medium mb-1">Your Reason:</p>
                        <p className="text-muted-foreground">{appeal.reason}</p>
                      </div>

                      {appeal.resolved_at && (
                        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 text-sm">
                          <p className="font-medium text-blue-900 mb-1">
                            Admin Decision {appeal.resolved_by_name ? `(${appeal.resolved_by_name})` : ''}:
                          </p>
                          <p className="text-blue-800">
                            {appeal.admin_notes || "No additional notes provided"}
                          </p>
                          <p className="text-xs text-blue-600 mt-2">
                            Resolved: <TimeDisplay utcDate={appeal.resolved_at} format="full" />
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

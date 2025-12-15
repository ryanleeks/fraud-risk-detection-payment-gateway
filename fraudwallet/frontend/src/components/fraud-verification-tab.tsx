"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, XCircle, Clock, ShieldCheck } from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"

interface FraudLog {
  id: number
  user_id: number
  full_name: string
  account_id: string
  email: string
  transaction_type: string
  amount: number
  ai_risk_score: number
  ai_confidence: number
  ai_reasoning: string
  ai_red_flags: string[]
  action_taken: string
  created_at: string
  ground_truth?: string
  ip_address?: string
  country?: string
  city?: string
  location_changed?: number
}

export function FraudVerificationTab() {
  const [unverifiedLogs, setUnverifiedLogs] = useState<FraudLog[]>([])
  const [verifiedLogs, setVerifiedLogs] = useState<FraudLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<"unverified" | "verified">("unverified")
  const [verifying, setVerifying] = useState<number | null>(null)

  const loadLogs = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      // Fetch unverified logs
      const unverifiedResponse = await fetch("http://localhost:8080/api/fraud/unverified-logs?limit=50", { headers })
      const unverifiedData = await unverifiedResponse.json()
      if (unverifiedData.success) {
        setUnverifiedLogs(unverifiedData.logs || [])
      }

      // Fetch verified logs
      const verifiedResponse = await fetch("http://localhost:8080/api/fraud/verified-logs?limit=100", { headers })
      const verifiedData = await verifiedResponse.json()
      if (verifiedData.success) {
        setVerifiedLogs(verifiedData.logs || [])
      }
    } catch (err) {
      console.error("Load logs error:", err)
    } finally {
      setLoading(false)
    }
  }

  const verifyLog = async (logId: number, groundTruth: "fraud" | "legitimate") => {
    setVerifying(logId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:8080/api/fraud/verify/${logId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ groundTruth })
      })

      const data = await response.json()
      if (data.success) {
        // Reload logs to update UI
        await loadLogs()
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (err) {
      console.error("Verify log error:", err)
      alert("Failed to verify transaction")
    } finally {
      setVerifying(null)
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadLogs,
  })

  useEffect(() => {
    loadLogs()
  }, [])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getRiskColor = (score: number) => {
    if (score >= 80) return "text-red-600"
    if (score >= 60) return "text-orange-600"
    if (score >= 40) return "text-yellow-600"
    return "text-green-600"
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
        <h2 className="text-2xl font-bold mb-2">Ground Truth Verification</h2>
        <p className="text-sm text-muted-foreground">
          Review AI fraud detection results and mark as fraud or legitimate for academic metrics
        </p>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeView === "unverified" ? "default" : "outline"}
          onClick={() => setActiveView("unverified")}
          className="flex-1"
        >
          <Clock className="h-4 w-4 mr-2" />
          Pending ({unverifiedLogs.length})
        </Button>
        <Button
          variant={activeView === "verified" ? "default" : "outline"}
          onClick={() => setActiveView("verified")}
          className="flex-1"
        >
          <ShieldCheck className="h-4 w-4 mr-2" />
          Verified ({verifiedLogs.length})
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading fraud logs...</p>
        </div>
      ) : (
        <>
          {activeView === "unverified" && (
            <div className="space-y-4">
              {unverifiedLogs.length === 0 ? (
                <Card className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">All Caught Up!</h3>
                  <p className="text-sm text-muted-foreground">
                    No pending transactions to verify
                  </p>
                </Card>
              ) : (
                unverifiedLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="space-y-3">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{log.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {log.account_id} • {log.email}
                          </p>
                        </div>
                        <Badge className={getRiskColor(log.ai_risk_score)}>
                          {log.ai_risk_score}/100
                        </Badge>
                      </div>

                      {/* Transaction Details */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="ml-2 font-medium">RM{log.amount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Type:</span>
                          <span className="ml-2 font-medium">{log.transaction_type}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Action:</span>
                          <span className="ml-2 font-medium">{log.action_taken}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="ml-2 font-medium">{log.ai_confidence}%</span>
                        </div>
                        {log.ip_address && (
                          <>
                            <div>
                              <span className="text-muted-foreground">IP Address:</span>
                              <span className="ml-2 font-medium font-mono text-xs">{log.ip_address}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Location:</span>
                              <span className="ml-2 font-medium">
                                {log.city}, {log.country}
                                {log.location_changed === 1 && (
                                  <Badge variant="outline" className="ml-2 text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Location Changed
                                  </Badge>
                                )}
                              </span>
                            </div>
                          </>
                        )}
                      </div>

                      {/* AI Reasoning */}
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-sm font-medium mb-1">AI Analysis:</p>
                        <p className="text-sm text-muted-foreground">{log.ai_reasoning}</p>
                      </div>

                      {/* Red Flags */}
                      {log.ai_red_flags && log.ai_red_flags.length > 0 && (
                        <div>
                          <p className="text-sm font-medium mb-2">Red Flags:</p>
                          <div className="flex flex-wrap gap-2">
                            {log.ai_red_flags.map((flag, idx) => (
                              <Badge key={idx} variant="destructive" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {flag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </p>

                      {/* Verification Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1"
                          onClick={() => verifyLog(log.id, "fraud")}
                          disabled={verifying === log.id}
                        >
                          <XCircle className="h-4 w-4 mr-2" />
                          Mark as Fraud
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => verifyLog(log.id, "legitimate")}
                          disabled={verifying === log.id}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark as Legitimate
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeView === "verified" && (
            <div className="space-y-4">
              {verifiedLogs.length === 0 ? (
                <Card className="p-8 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold mb-1">No Verified Logs</h3>
                  <p className="text-sm text-muted-foreground">
                    Start verifying transactions to build your dataset
                  </p>
                </Card>
              ) : (
                verifiedLogs.map((log) => (
                  <Card key={log.id} className="p-4">
                    <div className="space-y-3">
                      {/* Header with Ground Truth */}
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">{log.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {log.account_id}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className={getRiskColor(log.ai_risk_score)}>
                            AI: {log.ai_risk_score}/100
                          </Badge>
                          <Badge
                            className={`mt-1 ${log.ground_truth === "fraud" ? "bg-red-500" : "bg-green-500"}`}
                          >
                            {log.ground_truth === "fraud" ? "Fraud" : "Legitimate"}
                          </Badge>
                        </div>
                      </div>

                      {/* Transaction Details */}
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Amount:</span>
                          <span className="ml-2 font-medium">RM{log.amount.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Action:</span>
                          <span className="ml-2 font-medium">{log.action_taken}</span>
                        </div>
                      </div>

                      {/* AI Reasoning */}
                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground">{log.ai_reasoning}</p>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </Card>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

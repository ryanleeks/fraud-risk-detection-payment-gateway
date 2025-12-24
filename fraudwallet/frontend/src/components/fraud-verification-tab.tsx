"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, CheckCircle, XCircle, Clock, ShieldCheck } from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"
import { TimeDisplay } from "@/components/TimeDisplay"

interface FraudLog {
  id: number
  user_id: number
  risk_score: number
  risk_level: string
  sender_name: string
  sender_account_id: string
  sender_email: string
  recipient_name?: string
  recipient_account_id?: string
  recipient_email?: string
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
  auto_approved_at?: string
  auto_approval_source?: string
  revoked_at?: string
  revoked_by?: number
  revoked_reason?: string
  appeal_status?: string
}

export function FraudVerificationTab() {
  const [unverifiedLogs, setUnverifiedLogs] = useState<FraudLog[]>([])
  const [verifiedLogs, setVerifiedLogs] = useState<FraudLog[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<"unverified" | "verified">("unverified")
  const [verifying, setVerifying] = useState<number | null>(null)
  const [revoking, setRevoking] = useState<number | null>(null)

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

  const revokeLog = async (logId: number) => {
    const reason = prompt("Please provide a reason for revoking this auto-approval:")
    if (!reason || reason.trim().length === 0) {
      return
    }

    setRevoking(logId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:8080/api/fraud/revoke/${logId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      })

      const data = await response.json()
      if (data.success) {
        // Reload logs to update UI
        await loadLogs()
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (err) {
      console.error("Revoke log error:", err)
      alert("Failed to revoke auto-approval")
    } finally {
      setRevoking(null)
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

  const getRiskLevel = (score: number): string => {
    if (score >= 80) return "CRITICAL"
    if (score >= 60) return "HIGH"
    if (score >= 40) return "MEDIUM"
    if (score >= 20) return "LOW"
    return "MINIMAL"
  }

  const getRiskBadgeClasses = (score: number): string => {
    if (score >= 80) return "bg-red-600 text-white hover:bg-red-700"
    if (score >= 60) return "bg-orange-600 text-white hover:bg-orange-700"
    if (score >= 40) return "bg-yellow-500 text-gray-900 hover:bg-yellow-600"
    if (score >= 20) return "bg-green-400 text-gray-900 hover:bg-green-500"
    return "bg-green-600 text-white hover:bg-green-700"
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
                      {/* Header with Risk Badge */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground mb-1">Transaction Parties</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">From:</span>
                                <span className="font-semibold">{log.sender_name}</span>
                                <span className="text-xs text-muted-foreground">({log.sender_account_id})</span>
                              </div>
                              {log.recipient_name && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">To:</span>
                                  <span className="font-semibold">{log.recipient_name}</span>
                                  <span className="text-xs text-muted-foreground">({log.recipient_account_id})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={`${getRiskBadgeClasses(log.risk_score)} px-3 py-1`}>
                            <div className="text-center">
                              <div className="text-xs font-semibold">{getRiskLevel(log.risk_score)}</div>
                              <div className="text-lg font-bold">{log.risk_score}/100</div>
                            </div>
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
                      <TimeDisplay
                        utcDate={log.created_at}
                        format="full"
                        showBadge={true}
                        className="text-xs text-muted-foreground"
                      />

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
                      {/* Header with Risk Badge and Ground Truth */}
                      <div className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="mb-2">
                            <p className="text-xs text-muted-foreground mb-1">Transaction Parties</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-muted-foreground">From:</span>
                                <span className="font-semibold">{log.sender_name}</span>
                                <span className="text-xs text-muted-foreground">({log.sender_account_id})</span>
                              </div>
                              {log.recipient_name && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-muted-foreground">To:</span>
                                  <span className="font-semibold">{log.recipient_name}</span>
                                  <span className="text-xs text-muted-foreground">({log.recipient_account_id})</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <Badge className={`${getRiskBadgeClasses(log.risk_score)} px-3 py-1`}>
                            <div className="text-center">
                              <div className="text-xs font-semibold">{getRiskLevel(log.risk_score)}</div>
                              <div className="text-lg font-bold">{log.risk_score}/100</div>
                            </div>
                          </Badge>
                          <Badge
                            className={`${log.ground_truth === "fraud" ? "bg-red-600 text-white hover:bg-red-700" : "bg-green-600 text-white hover:bg-green-700"} px-3 py-1`}
                          >
                            {log.ground_truth === "fraud" ? "✓ Fraud" : "✓ Legitimate"}
                          </Badge>
                          {log.auto_approval_source === "auto_24hr" && (
                            <Badge variant="outline" className="px-2 py-1 text-xs bg-blue-50 border-blue-300">
                              🤖 Auto-Approved
                            </Badge>
                          )}
                          {log.revoked_at && (
                            <Badge variant="destructive" className="px-2 py-1 text-xs">
                              Revoked
                            </Badge>
                          )}
                        </div>
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
                          <span className="text-muted-foreground">AI Confidence:</span>
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
                        <p className="text-xs text-muted-foreground">{log.ai_reasoning}</p>
                      </div>

                      {/* Timestamp */}
                      <TimeDisplay
                        utcDate={log.created_at}
                        format="full"
                        showBadge={true}
                        className="text-xs text-muted-foreground"
                      />

                      {/* Revoke Button (for auto-approved only) */}
                      {log.auto_approval_source === "auto_24hr" && !log.revoked_at && (
                        <div className="pt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="w-full"
                            onClick={() => revokeLog(log.id)}
                            disabled={revoking === log.id}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            Revoke Auto-Approval (Mark as Fraud)
                          </Button>
                        </div>
                      )}

                      {/* Revocation Info */}
                      {log.revoked_at && log.revoked_reason && (
                        <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                          <p className="text-sm font-medium text-red-900 mb-1">Revocation Reason:</p>
                          <p className="text-sm text-red-700">{log.revoked_reason}</p>
                        </div>
                      )}
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

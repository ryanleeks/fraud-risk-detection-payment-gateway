"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, CheckCircle, XCircle, MessageSquare } from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"
import { TimeDisplay } from "@/components/TimeDisplay"

interface Appeal {
  id: number
  fraud_log_id: number
  user_id: number
  reason: string
  status: string
  created_at: string
  resolved_at?: string
  resolved_by?: number
  admin_notes?: string
  user_name: string
  user_account_id: string
  user_email: string
  risk_score: number
  risk_level: string
  action_taken: string
  amount: number
  transaction_type: string
  ground_truth?: string
  fraud_detected_at: string
}

export function FraudAppealsTab() {
  const [pendingAppeals, setPendingAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [resolving, setResolving] = useState<number | null>(null)
  const [adminNotes, setAdminNotes] = useState<{ [key: number]: string }>({})

  const loadAppeals = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/fraud/appeals/pending", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      const data = await response.json()
      if (data.success) {
        setPendingAppeals(data.appeals || [])
      }
    } catch (err) {
      console.error("Load appeals error:", err)
    } finally {
      setLoading(false)
    }
  }

  const resolveAppeal = async (appealId: number, status: "approved" | "rejected") => {
    setResolving(appealId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`/api/fraud/appeals/${appealId}/resolve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          adminNotes: adminNotes[appealId] || ""
        })
      })

      const data = await response.json()
      if (data.success) {
        // Clear admin note
        setAdminNotes((prev) => {
          const updated = { ...prev }
          delete updated[appealId]
          return updated
        })
        // Reload appeals
        await loadAppeals()
      } else {
        alert(`Error: ${data.message}`)
      }
    } catch (err) {
      console.error("Resolve appeal error:", err)
      alert("Failed to resolve appeal")
    } finally {
      setResolving(null)
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadAppeals,
  })

  useEffect(() => {
    loadAppeals()
  }, [])

  const getRiskBadgeClasses = (score: number): string => {
    if (score >= 80) return "bg-red-600 text-white hover:bg-red-700"
    if (score >= 60) return "bg-orange-600 text-white hover:bg-orange-700"
    if (score >= 40) return "bg-yellow-500 text-gray-900 hover:bg-yellow-600"
    if (score >= 20) return "bg-green-400 text-gray-900 hover:bg-green-500"
    return "bg-green-600 text-white hover:bg-green-700"
  }

  const getRiskLevel = (score: number): string => {
    if (score >= 80) return "CRITICAL"
    if (score >= 60) return "HIGH"
    if (score >= 40) return "MEDIUM"
    if (score >= 20) return "LOW"
    return "MINIMAL"
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
        <h2 className="text-2xl font-bold mb-2">Fraud Detection Appeals</h2>
        <p className="text-sm text-muted-foreground">
          Review and resolve user appeals for fraud detections
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading appeals...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingAppeals.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No Pending Appeals</h3>
              <p className="text-sm text-muted-foreground">
                All appeals have been resolved
              </p>
            </Card>
          ) : (
            pendingAppeals.map((appeal) => (
              <Card key={appeal.id} className="p-4">
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="h-5 w-5 text-orange-500" />
                        <h3 className="font-semibold">{appeal.user_name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {appeal.user_account_id}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{appeal.user_email}</p>
                    </div>
                    <Badge className={`${getRiskBadgeClasses(appeal.risk_score)} px-3 py-1`}>
                      <div className="text-center">
                        <div className="text-xs font-semibold">{getRiskLevel(appeal.risk_score)}</div>
                        <div className="text-lg font-bold">{appeal.risk_score}/100</div>
                      </div>
                    </Badge>
                  </div>

                  {/* Transaction Info */}
                  <div className="grid grid-cols-2 gap-2 text-sm bg-muted/30 p-3 rounded-lg">
                    <div>
                      <span className="text-muted-foreground">Amount:</span>
                      <span className="ml-2 font-medium">RM{appeal.amount.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Type:</span>
                      <span className="ml-2 font-medium">{appeal.transaction_type}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Action:</span>
                      <span className="ml-2 font-medium">{appeal.action_taken}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Status:</span>
                      <span className="ml-2 font-medium">
                        {appeal.ground_truth ? appeal.ground_truth : "Pending"}
                      </span>
                    </div>
                  </div>

                  {/* User's Appeal Reason */}
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-2">
                      <MessageSquare className="h-4 w-4 text-blue-600" />
                      <p className="text-sm font-medium text-blue-900">User's Appeal:</p>
                    </div>
                    <p className="text-sm text-blue-800">{appeal.reason}</p>
                  </div>

                  {/* Detection & Appeal Timestamps */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Detected:</span>
                      <TimeDisplay
                        utcDate={appeal.fraud_detected_at}
                        format="relative"
                        className="ml-2"
                      />
                    </div>
                    <div>
                      <span className="text-muted-foreground">Appealed:</span>
                      <TimeDisplay
                        utcDate={appeal.created_at}
                        format="relative"
                        className="ml-2"
                      />
                    </div>
                  </div>

                  {/* Admin Notes */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Admin Notes (optional):</label>
                    <Textarea
                      value={adminNotes[appeal.id] || ""}
                      onChange={(e) => setAdminNotes((prev) => ({ ...prev, [appeal.id]: e.target.value }))}
                      placeholder="Add notes about your decision..."
                      rows={2}
                      className="text-sm"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => resolveAppeal(appeal.id, "approved")}
                      disabled={resolving === appeal.id}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Appeal
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="flex-1"
                      onClick={() => resolveAppeal(appeal.id, "rejected")}
                      disabled={resolving === appeal.id}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject Appeal
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, CheckCircle, Clock, Shield, MessageSquare, XCircle } from "lucide-react"
import { TimeDisplay } from "@/components/TimeDisplay"

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

export function MyFraudAlertsTab() {
  const [fraudFlags, setFraudFlags] = useState<FraudFlag[]>([])
  const [myAppeals, setMyAppeals] = useState<Appeal[]>([])
  const [loading, setLoading] = useState(true)
  const [appealing, setAppealing] = useState<number | null>(null)
  const [appealReason, setAppealReason] = useState<{ [key: number]: string }>({})

  const loadData = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      // Fetch fraud flags
      const flagsResponse = await fetch("http://localhost:8080/api/fraud/my-flags", { headers })
      const flagsData = await flagsResponse.json()
      if (flagsData.success) {
        setFraudFlags(flagsData.flags || [])
      }

      // Fetch my appeals
      const appealsResponse = await fetch("http://localhost:8080/api/fraud/appeals/my-appeals", { headers })
      const appealsData = await appealsResponse.json()
      if (appealsData.success) {
        setMyAppeals(appealsData.appeals || [])
      }
    } catch (err) {
      console.error("Load fraud alerts error:", err)
    } finally {
      setLoading(false)
    }
  }

  const submitAppeal = async (fraudLogId: number) => {
    const reason = appealReason[fraudLogId]
    if (!reason || reason.trim().length === 0) {
      alert("Please provide a reason for your appeal")
      return
    }

    setAppealing(fraudLogId)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`http://localhost:8080/api/fraud/appeal/${fraudLogId}`, {
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
        await loadData()
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

  useEffect(() => {
    loadData()
  }, [])

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

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold mb-2">My Fraud Alerts</h2>
        <p className="text-sm text-muted-foreground">
          View your fraud detection flags and submit appeals
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          {/* Fraud Flags Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Fraud Detection Flags</h3>
            {fraudFlags.length === 0 ? (
              <Card className="p-8 text-center">
                <Shield className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No Fraud Flags</h3>
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
                          Submit Appeal
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
              <h3 className="text-lg font-semibold">My Appeals History</h3>
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
                          Admin Decision ({appeal.resolved_by_name}):
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
        </>
      )}
    </div>
  )
}

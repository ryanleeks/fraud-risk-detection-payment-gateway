"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Users, DollarSign, Plus, X, Check, Clock, CheckCircle, ChevronDown, ChevronUp, Calendar } from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"

export function SplitPayTab() {
  const [user, setUser] = useState<any>(null)
  const [totalAmount, setTotalAmount] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [participants, setParticipants] = useState<any[]>([])
  const [recipientInput, setRecipientInput] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState("")
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState("")
  const [mySplits, setMySplits] = useState<any[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [expandedSplitId, setExpandedSplitId] = useState<number | null>(null)

  // Load my split payments
  const loadMySplits = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:8080/api/splitpay/my-splits", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setMySplits(data.splits || [])
      } else {
        setMySplits([])
      }
    } catch (err) {
      console.error("Load splits error:", err)
      setMySplits([])
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadMySplits,
  })

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    loadMySplits()
  }, [])

  // Lookup recipient
  const handleLookupRecipient = async () => {
    if (!recipientInput.trim()) {
      setLookupError("Please enter a phone number, email, or Account ID")
      return
    }

    setLookupLoading(true)
    setLookupError("")

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:8080/api/payment/lookup-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query: recipientInput })
      })

      const data = await response.json()

      if (data.success) {
        // Check if already added
        if (participants.some(p => p.id === data.recipient.id)) {
          setLookupError("This person is already added")
        } else {
          setParticipants([...participants, data.recipient])
          setRecipientInput("")
          setLookupError("")
        }
      } else {
        setLookupError(data.message || "Recipient not found")
      }
    } catch (err) {
      console.error("Lookup recipient error:", err)
      setLookupError("Unable to connect to server")
    } finally {
      setLookupLoading(false)
    }
  }

  // Remove participant
  const removeParticipant = (index: number) => {
    setParticipants(participants.filter((_, i) => i !== index))
  }

  // Create split payment
  const handleCreateSplit = async () => {
    if (!title.trim() || !totalAmount || participants.length === 0) {
      setCreateError("Please fill in all fields and add at least one participant")
      return
    }

    const amount = parseFloat(totalAmount)
    if (isNaN(amount) || amount <= 0) {
      setCreateError("Please enter a valid amount")
      return
    }

    setCreateLoading(true)
    setCreateError("")

    try {
      const token = localStorage.getItem("token")

      // We need to find user IDs from the backend first
      // For now, let's assume we store the full user data in participants
      const response = await fetch("http://localhost:8080/api/splitpay/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          totalAmount: amount,
          participants: participants.map(p => p.id)
        })
      })

      const data = await response.json()

      if (data.success) {
        alert("Split payment created successfully!")
        // Reset form
        setTitle("")
        setDescription("")
        setTotalAmount("")
        setParticipants([])
        setShowCreateForm(false)
        loadMySplits()
      } else {
        setCreateError(data.message || "Failed to create split payment")
      }
    } catch (err) {
      console.error("Create split error:", err)
      setCreateError("Unable to connect to server")
    } finally {
      setCreateLoading(false)
    }
  }

  // Respond to split request
  const handleRespond = async (splitId: number, action: string) => {
    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/splitpay/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          splitPaymentId: splitId,
          action
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`Split payment ${action}ed successfully!`)
        loadMySplits()
      } else {
        alert(data.message || "Failed to respond to split payment")
      }
    } catch (err) {
      console.error("Respond error:", err)
      alert("Unable to connect to server")
    }
  }

  // Pay my share
  const handlePayShare = async (splitId: number) => {
    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/splitpay/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          splitPaymentId: splitId
        })
      })

      const data = await response.json()

      if (data.success) {
        alert("Payment recorded successfully!")
        loadMySplits()
      } else {
        alert(data.message || "Failed to record payment")
      }
    } catch (err) {
      console.error("Pay share error:", err)
      alert("Unable to connect to server")
    }
  }

  // Cancel split payment (creator only)
  const handleCancelSplit = async (splitId: number) => {
    if (!confirm("Are you sure you want to cancel this split payment? Participants who already paid will be refunded.")) {
      return
    }

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/splitpay/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          splitPaymentId: splitId
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(`Split payment cancelled. ${data.refundedCount} participants refunded (RM${data.totalRefunded?.toFixed(2) || '0.00'})`)
        loadMySplits()
      } else {
        alert(data.message || "Failed to cancel split payment")
      }
    } catch (err) {
      console.error("Cancel split error:", err)
      alert("Unable to connect to server")
    }
  }

  const calculateSplit = () => {
    if (!totalAmount || participants.length === 0) return 0
    const amount = parseFloat(totalAmount)
    if (isNaN(amount)) return 0
    return (amount / (participants.length + 1)).toFixed(2)
  }

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    return date.toLocaleString('en-MY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDateShort = (dateString: string) => {
    if (!dateString) return "N/A"
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    if (diffDays < 7) return `${diffDays} days ago`
    return date.toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })
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
          <h1 className="text-2xl font-bold">SplitPay</h1>
          <p className="text-sm text-muted-foreground">Split bills with peers</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
          <Users className="h-5 w-5 text-accent" />
        </div>
      </div>

      {/* Create Split Button */}
      {!showCreateForm && (
        <Button
          onClick={() => setShowCreateForm(true)}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create New Split Payment
        </Button>
      )}

      {/* Create Split Form */}
      {showCreateForm && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">New Split Payment</h3>
            <button
              onClick={() => {
                setShowCreateForm(false)
                setTitle("")
                setDescription("")
                setTotalAmount("")
                setParticipants([])
                setCreateError("")
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {createError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {createError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Dinner at restaurant"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Add details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totalAmount">Total Amount</Label>
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <Input
                id="totalAmount"
                type="number"
                placeholder="0.00"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Add Participants</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Phone, email, or Account ID"
                value={recipientInput}
                onChange={(e) => {
                  setRecipientInput(e.target.value)
                  setLookupError("")
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleLookupRecipient()
                  }
                }}
              />
              <Button
                onClick={handleLookupRecipient}
                disabled={lookupLoading || !recipientInput.trim()}
                variant="outline"
              >
                {lookupLoading ? "..." : <Plus className="h-4 w-4" />}
              </Button>
            </div>

            {lookupError && (
              <p className="text-sm text-destructive">{lookupError}</p>
            )}

            {/* Participants List */}
            {participants.length > 0 && (
              <div className="mt-3 space-y-2">
                {participants.map((p, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="font-medium">{p.fullName}</p>
                      <p className="text-xs text-muted-foreground">{p.accountId}</p>
                    </div>
                    <button
                      onClick={() => removeParticipant(index)}
                      className="text-destructive hover:text-destructive/80"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Split Calculation */}
          {totalAmount && participants.length > 0 && (
            <Card className="p-4 bg-primary/5">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Each person pays</p>
                <p className="text-3xl font-bold text-primary">RM {calculateSplit()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: RM {totalAmount} ÷ {participants.length + 1} people
                </p>
              </div>
            </Card>
          )}

          <Button
            onClick={handleCreateSplit}
            disabled={createLoading}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {createLoading ? "Creating..." : "Create Split Payment"}
          </Button>
        </Card>
      )}

      {/* My Split Payments */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold">My Split Payments</h3>

        {mySplits.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No split payments yet</p>
          </Card>
        ) : (
          mySplits.map((split) => (
            <Card key={split.id} className="p-4 space-y-3">
              {/* Header Section */}
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-bold text-lg">{split.title}</h4>
                  {split.description && (
                    <p className="text-sm text-muted-foreground mt-1">{split.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    <span>Created by {split.creator_name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{formatDateShort(split.created_at)}</span>
                    <span className="text-xs">• {formatDateTime(split.created_at)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">RM {split.amount_per_person.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">per person</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total: RM {split.total_amount.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Status Badges */}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  split.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600 border border-yellow-500/20' :
                  split.status === 'active' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                  split.status === 'completed' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
                  'bg-red-500/10 text-red-600 border border-red-500/20'
                }`}>
                  {split.status.toUpperCase()}
                </span>
                <span className="px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {split.accepted_count}/{split.num_participants} accepted
                </span>
                <span className="px-2 py-1 rounded-full bg-muted text-foreground border">
                  {split.participants?.filter((p: any) => p.paid).length || 0}/{split.num_participants} paid
                </span>
              </div>

              {/* View Details Button */}
              <button
                onClick={() => setExpandedSplitId(expandedSplitId === split.id ? null : split.id)}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-primary hover:bg-primary/5 rounded-lg transition-colors"
              >
                {expandedSplitId === split.id ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide Details
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    View Details ({split.num_participants} participants)
                  </>
                )}
              </button>

              {/* Expanded Details Section */}
              {expandedSplitId === split.id && split.participants && (
                <div className="border-t pt-3 space-y-2">
                  <h5 className="text-sm font-semibold mb-2">Participants</h5>
                  {split.participants.map((participant: any) => (
                    <div key={participant.id} className="bg-muted/30 rounded-lg p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-sm">{participant.full_name}</p>
                          <p className="text-xs text-muted-foreground">{participant.account_id}</p>
                        </div>
                        <div className="flex gap-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            participant.status === 'accepted' ? 'bg-green-500/10 text-green-600' :
                            participant.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                            'bg-yellow-500/10 text-yellow-600'
                          }`}>
                            {participant.status}
                          </span>
                          {participant.paid === 1 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600">
                              PAID
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {participant.responded_at && (
                          <div className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            <span>Responded: {formatDateTime(participant.responded_at)}</span>
                          </div>
                        )}
                        {participant.paid === 1 && participant.paid_at && (
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            <span>Paid: {formatDateTime(participant.paid_at)}</span>
                          </div>
                        )}
                        {participant.status === 'pending' && (
                          <div className="flex items-center gap-1 text-yellow-600">
                            <Clock className="h-3 w-3" />
                            <span>Waiting for response</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              {split.my_status === 'pending' && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleRespond(split.id, 'accept')}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    <Check className="mr-1 h-4 w-4" />
                    Accept
                  </Button>
                  <Button
                    onClick={() => handleRespond(split.id, 'reject')}
                    variant="destructive"
                    className="flex-1"
                    size="sm"
                  >
                    <X className="mr-1 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}

              {split.my_status === 'accepted' && split.status === 'active' && (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <CheckCircle className="inline h-4 w-4 text-green-600 mr-1" />
                    You accepted this request
                  </div>
                  <Button
                    onClick={() => handlePayShare(split.id)}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    size="sm"
                  >
                    Pay My Share (RM {split.amount_per_person.toFixed(2)})
                  </Button>
                </div>
              )}

              {split.my_status === 'rejected' && (
                <div className="text-sm text-destructive">
                  <X className="inline h-4 w-4 mr-1" />
                  You rejected this request
                </div>
              )}

              {/* Cancel button for creator */}
              {user && split.creator_id === user.id && (split.status === 'pending' || split.status === 'active') && (
                <Button
                  onClick={() => handleCancelSplit(split.id)}
                  variant="destructive"
                  className="w-full"
                  size="sm"
                >
                  <X className="mr-1 h-4 w-4" />
                  Cancel Split Payment
                </Button>
              )}
            </Card>
          ))
        )}
      </div>
      </div>
    </div>
  )
}

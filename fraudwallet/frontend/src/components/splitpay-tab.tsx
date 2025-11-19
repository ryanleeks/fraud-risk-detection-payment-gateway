"use client"

import { useState, useEffect } from "react"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { Card } from "@/components/ui/card"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { Button } from "@/components/ui/button"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { Input } from "@/components/ui/input"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { Label } from "@/components/ui/label"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"
import { Users, DollarSign, Plus, X, Check, Clock, CheckCircle } from "lucide-react"

// API URL configuration
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"

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
  const [refreshing, setRefreshing] = useState(false)

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
    loadMySplits()
  }, [])

  // Load my split payments
  const loadMySplits = async () => {
    setRefreshing(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(`${API_URL}/api/splitpay/my-splits", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setMySplits(data.splits)
      }
    } catch (err) {
      console.error("Load splits error:", err)
    } finally {
      setRefreshing(false)
    }
  }

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
      const response = await fetch(`${API_URL}/api/payment/lookup-recipient", {
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
      const response = await fetch(`${API_URL}/api/splitpay/create", {
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

      const response = await fetch(`${API_URL}/api/splitpay/respond", {
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

      const response = await fetch(`${API_URL}/api/splitpay/pay", {
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

  const calculateSplit = () => {
    if (!totalAmount || participants.length === 0) return 0
    const amount = parseFloat(totalAmount)
    if (isNaN(amount)) return 0
    return (amount / (participants.length + 1)).toFixed(2)
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">SplitPay</h1>
          <p className="text-sm text-muted-foreground">Split bills with friends</p>
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
                <p className="text-3xl font-bold text-primary">${calculateSplit()}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total: ${totalAmount} ÷ {participants.length + 1} people
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">My Split Payments</h3>
          <Button
            onClick={loadMySplits}
            variant="outline"
            size="sm"
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        {mySplits.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No split payments yet</p>
          </Card>
        ) : (
          mySplits.map((split) => (
            <Card key={split.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-bold">{split.title}</h4>
                  {split.description && (
                    <p className="text-sm text-muted-foreground">{split.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Created by {split.creator_name}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${split.amount_per_person}</p>
                  <p className="text-xs text-muted-foreground">per person</p>
                </div>
              </div>

              <div className="flex gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  split.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                  split.status === 'active' ? 'bg-blue-500/10 text-blue-600' :
                  split.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                  'bg-red-500/10 text-red-600'
                }`}>
                  {split.status.toUpperCase()}
                </span>
                <span className="px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {split.accepted_count}/{split.num_participants} accepted
                </span>
              </div>

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
                    Pay My Share (${split.amount_per_person})
                  </Button>
                </div>
              )}

              {split.my_status === 'rejected' && (
                <div className="text-sm text-destructive">
                  <X className="inline h-4 w-4 mr-1" />
                  You rejected this request
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

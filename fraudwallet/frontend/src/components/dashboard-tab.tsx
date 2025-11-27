"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Wallet, Plus, X, CreditCard } from "lucide-react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js"
import { validateAmount, formatAmount, AMOUNT_LIMITS } from "@/utils/amountValidation"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"

// Initialize Stripe with publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

// Payment Form Component with Stripe Elements
function StripePaymentForm({
  clientSecret,
  amount,
  onSuccess,
  onCancel
}: {
  clientSecret: string
  amount: string
  onSuccess: () => void
  onCancel: () => void
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setProcessing(true)
    setErrorMessage("")

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.origin + "/payment-success",
        },
        redirect: "if_required"
      })

      if (error) {
        setErrorMessage(error.message || "Payment failed")
        setProcessing(false)
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Payment successful!
        onSuccess()
      } else if (paymentIntent && paymentIntent.status === "processing") {
        // Payment is processing
        setErrorMessage("Payment is processing. Please wait...")
        // Poll for status or wait for webhook
        setTimeout(onSuccess, 2000)
      }
    } catch (err) {
      console.error("Payment error:", err)
      setErrorMessage("An unexpected error occurred")
      setProcessing(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border p-4">
        <PaymentElement />
      </div>

      {errorMessage && (
        <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          type="submit"
          disabled={!stripe || processing}
          className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
        >
          {processing ? "Processing..." : `Pay RM ${amount}`}
        </Button>
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          disabled={processing}
          size="lg"
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

export function DashboardTab() {
  const [user, setUser] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string | null>(null)

  // Load wallet balance and transactions
  const loadWalletData = async () => {
    try {
      const token = localStorage.getItem("token")

      // Fetch wallet balance
      const balanceResponse = await fetch("http://localhost:8080/api/wallet/balance", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      const balanceData = await balanceResponse.json()
      if (balanceData.success) {
        setWalletBalance(balanceData.balance)

        // Update user data in localStorage
        const storedUser = localStorage.getItem("user")
        if (storedUser) {
          const userData = JSON.parse(storedUser)
          userData.walletBalance = balanceData.balance
          localStorage.setItem("user", JSON.stringify(userData))
          setUser(userData)
        }
      }

      // Fetch transaction history
      const transactionsResponse = await fetch("http://localhost:8080/api/wallet/transactions?limit=10", {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      })
      const transactionsData = await transactionsResponse.json()
      if (transactionsData.success) {
        setTransactions(transactionsData.transactions)
      }
    } catch (err) {
      console.error("Load wallet data error:", err)
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadWalletData,
  })

  // Load user data and wallet info
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setWalletBalance(userData.walletBalance || 0)
    }
    loadWalletData()
  }, [])

  // Handle add funds - Create payment intent
  const handleAddFunds = async () => {
    // Validate amount
    const validation = validateAmount(amount, { minTopup: true })

    if (!validation.isValid) {
      setError(validation.error || "Invalid amount")
      return
    }

    // Use the validated and rounded amount
    const validatedAmount = validation.value

    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      // Create payment intent
      const response = await fetch("http://localhost:8080/api/wallet/add-funds", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ amount: validatedAmount })
      })

      const data = await response.json()

      if (data.success) {
        // Store client secret to show Stripe payment form
        setClientSecret(data.clientSecret)
        setPaymentIntentId(data.paymentIntentId)
      } else {
        setError(data.message || "Failed to create payment intent")
      }
    } catch (err) {
      console.error("Add funds error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Handle successful payment
  const handlePaymentSuccess = () => {
    // Reload wallet data to show updated balance
    loadWalletData()
    // Close modal and reset
    setShowAddFundsModal(false)
    setAmount("")
    setClientSecret(null)
    setPaymentIntentId(null)
    // Show success message
    alert("Payment successful! Your wallet has been credited.")
  }

  // Handle payment cancellation
  const handlePaymentCancel = () => {
    setClientSecret(null)
    setPaymentIntentId(null)
    setAmount("")
    setError("")
  }

  // Quick amount buttons
  const quickAmounts = [50, 100, 200, 500]

  // Get first name from full name
  const getFirstName = (fullName: string) => {
    if (!fullName) return "User"
    return fullName.split(" ")[0]
  }

  // Format transaction date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 60) return `${diffMins} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "Yesterday"
    return date.toLocaleDateString()
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
          <h1 className="text-2xl font-bold">
            Welcome back, {user ? getFirstName(user.fullName) : "User"}
          </h1>
          <p className="text-sm text-muted-foreground">Manage your finances</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Wallet className="h-5 w-5 text-primary" />
        </div>
      </div>

      {/* Balance Card */}
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 p-6 text-primary-foreground">
        <div className="relative z-10">
          <p className="text-sm opacity-90">Wallet Balance</p>
          <h2 className="mt-2 text-4xl font-bold">RM {walletBalance.toFixed(2)}</h2>
          <div className="mt-4">
            <Button
              onClick={() => setShowAddFundsModal(true)}
              className="bg-white text-primary hover:bg-white/90"
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Funds
            </Button>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5" />
      </Card>

      {/* Quick Actions */}
      {/*
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <ArrowUpRight className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium">Send</p>
            <p className="text-xs text-muted-foreground">Transfer money</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ArrowDownLeft className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Request</p>
            <p className="text-xs text-muted-foreground">Get paid</p>
          </div>
        </Card>
      </div>
      */}

      {/* Recent Transactions */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Recent Transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No transactions yet</p>
            <p className="text-xs mt-1">Add funds to get started</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {transactions.map((transaction) => (
              <Card key={transaction.id} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      transaction.type === "deposit" ? "bg-accent/10" : "bg-muted"
                    }`}
                  >
                    {transaction.type === "deposit" ? (
                      <ArrowDownLeft className="h-5 w-5 text-accent" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">{transaction.description || "Transaction"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(transaction.created_at)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      transaction.status === 'completed' ? 'bg-green-500/10 text-green-600' :
                      transaction.status === 'pending' ? 'bg-yellow-500/10 text-yellow-600' :
                      'bg-red-500/10 text-red-600'
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
                <p className={`font-semibold ${transaction.type === "deposit" ? "text-accent" : "text-foreground"}`}>
                  {transaction.type === "deposit" ? "+" : "-"}RM {transaction.amount.toFixed(2)}
                </p>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">
                {clientSecret ? "Complete Payment" : "Add Funds to Wallet"}
              </h3>
              <button
                onClick={() => {
                  setShowAddFundsModal(false)
                  setAmount("")
                  setError("")
                  setClientSecret(null)
                  setPaymentIntentId(null)
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Show payment form if we have client secret, otherwise show amount selection */}
            {clientSecret ? (
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                  },
                }}
              >
                <StripePaymentForm
                  clientSecret={clientSecret}
                  amount={amount}
                  onSuccess={handlePaymentSuccess}
                  onCancel={handlePaymentCancel}
                />
              </Elements>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="amount">Amount (RM)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="Enter amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min="10"
                    max="999999.99"
                    step="0.01"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Min: RM 10.00 | Max: RM 999,999.99
                  </p>
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <Label>Quick Select</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {quickAmounts.map((quickAmount) => (
                      <Button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount.toString())}
                        variant="outline"
                        size="sm"
                      >
                        RM {quickAmount}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <span className="font-medium">Stripe Payment (Test Mode)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Secure payment processing by Stripe
                  </p>
                </div>

                <Button
                  onClick={handleAddFunds}
                  disabled={loading || !amount}
                  className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  size="lg"
                >
                  {loading ? "Creating payment..." : `Continue to Payment`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

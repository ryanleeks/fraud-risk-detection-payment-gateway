"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Wallet, Plus, X, CreditCard } from "lucide-react"
import { loadStripe } from "@stripe/stripe-js"

// Initialize Stripe with publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

export function DashboardTab() {
  const [user, setUser] = useState<any>(null)
  const [walletBalance, setWalletBalance] = useState<number>(0)
  const [transactions, setTransactions] = useState<any[]>([])
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [amount, setAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [refreshing, setRefreshing] = useState(false)

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

  // Load wallet balance and transactions
  const loadWalletData = async () => {
    setRefreshing(true)
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
    } finally {
      setRefreshing(false)
    }
  }

  // Handle add funds
  const handleAddFunds = async () => {
    const amountNum = parseFloat(amount)

    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount")
      return
    }

    if (amountNum < 10) {
      setError("Minimum amount is RM 10")
      return
    }

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
        body: JSON.stringify({ amount: amountNum })
      })

      const data = await response.json()

      if (data.success) {
        // Redirect to Stripe checkout (simplified version)
        // In production, you'd use Stripe Elements for embedded checkout
        alert(`Payment intent created! In test mode, this would redirect to Stripe checkout.\n\nClient Secret: ${data.clientSecret.substring(0, 20)}...`)

        // For demo: simulate successful payment after 2 seconds
        setTimeout(() => {
          loadWalletData()
          setShowAddFundsModal(false)
          setAmount("")
          alert("Payment successful! Your wallet has been credited.")
        }, 2000)
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
    <div className="space-y-6 p-6">
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
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => setShowAddFundsModal(true)}
              className="bg-white text-primary hover:bg-white/90"
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add Funds
            </Button>
            <Button
              onClick={loadWalletData}
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              size="sm"
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5" />
      </Card>

      {/* Quick Actions */}
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
              <h3 className="text-xl font-bold">Add Funds to Wallet</h3>
              <button
                onClick={() => {
                  setShowAddFundsModal(false)
                  setAmount("")
                  setError("")
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
                  step="10"
                />
                <p className="text-xs text-muted-foreground mt-1">Minimum: RM 10</p>
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
                {loading ? "Processing..." : `Add RM ${amount || "0"}`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

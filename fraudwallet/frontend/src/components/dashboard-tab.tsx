"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Wallet } from "lucide-react"

export function DashboardTab() {
  const [user, setUser] = useState<any>(null)

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  const transactions = [
    { id: 1, name: "Sarah Johnson", type: "received", amount: 250.0, date: "Today, 2:30 PM" },
    { id: 2, name: "Coffee Shop", type: "sent", amount: 12.5, date: "Today, 10:15 AM" },
    { id: 3, name: "Michael Chen", type: "received", amount: 500.0, date: "Yesterday, 4:20 PM" },
    { id: 4, name: "Grocery Store", type: "sent", amount: 85.3, date: "Yesterday, 11:00 AM" },
  ]

  // Get first name from full name
  const getFirstName = (fullName: string) => {
    if (!fullName) return "User"
    return fullName.split(" ")[0]
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
          <p className="text-sm opacity-90">Total Balance</p>
          <h2 className="mt-2 text-4xl font-bold">$12,458.50</h2>
          <div className="mt-4 flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>+2.5% from last month</span>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-white/5" />
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <ArrowUpRight className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className="text-sm font-medium">Send</p>
            <p className="text-xs text-muted-foreground">Transfer money</p>
          </div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
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
          <button className="text-sm text-primary">View All</button>
        </div>
        <div className="space-y-3">
          {transactions.map((transaction) => (
            <Card key={transaction.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    transaction.type === "received" ? "bg-accent/10" : "bg-muted"
                  }`}
                >
                  {transaction.type === "received" ? (
                    <ArrowDownLeft className="h-5 w-5 text-accent" />
                  ) : (
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <p className="font-medium">{transaction.name}</p>
                  <p className="text-xs text-muted-foreground">{transaction.date}</p>
                </div>
              </div>
              <p className={`font-semibold ${transaction.type === "received" ? "text-accent" : "text-foreground"}`}>
                {transaction.type === "received" ? "+" : "-"}${transaction.amount.toFixed(2)}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

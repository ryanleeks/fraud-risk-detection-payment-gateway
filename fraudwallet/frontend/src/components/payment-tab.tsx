"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, User, DollarSign } from "lucide-react"

export function PaymentTab() {
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [note, setNote] = useState("")

  const recentContacts = [
    { id: 1, name: "Sarah J.", avatar: "SJ" },
    { id: 2, name: "Michael C.", avatar: "MC" },
    { id: 3, name: "Emma W.", avatar: "EW" },
    { id: 4, name: "David L.", avatar: "DL" },
  ]

  const handleSend = () => {
    // Handle payment logic
    console.log("[v0] Sending payment:", { amount, recipient, note })
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Send Money</h1>
          <p className="text-sm text-muted-foreground">Transfer funds instantly</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
          <Send className="h-5 w-5 text-accent" />
        </div>
      </div>

      {/* Amount Input */}
      <Card className="p-6">
        <Label htmlFor="amount" className="text-sm text-muted-foreground">
          Amount
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-muted-foreground" />
          <input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border-none bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </Card>

      {/* Recent Contacts */}
      <div>
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Recent Contacts</h3>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {recentContacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => setRecipient(contact.name)}
              className="flex flex-col items-center gap-2 transition-transform hover:scale-105"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {contact.avatar}
              </div>
              <span className="text-xs">{contact.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Payment Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient</Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="recipient"
              placeholder="Enter name or email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (Optional)</Label>
          <Input id="note" placeholder="What's this for?" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        <Button onClick={handleSend} className="w-full bg-accent text-accent-foreground hover:bg-accent/90" size="lg">
          <Send className="mr-2 h-5 w-5" />
          Send ${amount || "0.00"}
        </Button>
      </div>

      {/* Payment Methods */}
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-sm font-bold text-primary">••••</span>
            </div>
            <div>
              <p className="text-sm font-medium">Wallet Balance</p>
              <p className="text-xs text-muted-foreground">$12,458.50 available</p>
            </div>
          </div>
          <button className="text-sm text-primary">Change</button>
        </div>
      </Card>
    </div>
  )
}

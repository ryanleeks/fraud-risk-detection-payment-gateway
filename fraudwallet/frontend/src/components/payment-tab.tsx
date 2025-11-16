"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, DollarSign, Copy, QrCode } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

export function PaymentTab() {
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [note, setNote] = useState("")
  const [user, setUser] = useState<any>(null)
  const [showQRModal, setShowQRModal] = useState(false)

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

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

      {/* My Account ID */}
      {user?.accountId && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">Your Account ID</p>
              <p className="text-lg font-mono font-bold text-primary">{user.accountId}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.accountId)
                  alert("Account ID copied to clipboard!")
                }}
                className="rounded p-2 hover:bg-muted transition-colors"
                title="Copy Account ID"
              >
                <Copy className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </button>
              <button
                onClick={() => setShowQRModal(true)}
                className="rounded p-2 hover:bg-muted transition-colors"
                title="Show QR Code"
              >
                <QrCode className="h-5 w-5 text-muted-foreground hover:text-primary" />
              </button>
            </div>
          </div>
        </Card>
      )}

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

      {/* Payment Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient</Label>
          <Input
            id="recipient"
            placeholder="Enter phone number, email, or Account ID"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            You can send money using phone number (+60...), email, or 12-digit Account ID
          </p>
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

      {/* QR Code Modal */}
      {showQRModal && user?.accountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-center">Your Account ID QR Code</h3>

            <div className="flex flex-col items-center gap-4">
              <div className="bg-white p-4 rounded-lg">
                <QRCodeCanvas
                  value={user.accountId}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-1">Your Account ID</p>
                <p className="text-lg font-mono font-bold text-primary">{user.accountId}</p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Share this QR code to receive payments from others
              </p>

              <div className="flex gap-2 w-full">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(user.accountId)
                    alert("Account ID copied to clipboard!")
                  }}
                  className="flex-1"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy ID
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowQRModal(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

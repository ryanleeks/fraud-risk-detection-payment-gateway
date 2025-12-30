"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Send, DollarSign, Copy, QrCode, AlertCircle } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"
import { validateAmount } from "@/utils/amountValidation"
import { PasscodeDialog } from "@/components/passcode-dialog"
import { useRouter } from "next/navigation"

export function PaymentTab() {
  const router = useRouter()
  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [note, setNote] = useState("")
  const [user, setUser] = useState<any>(null)
  const [showQRModal, setShowQRModal] = useState(false)
  const [recipientData, setRecipientData] = useState<any>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState("")
  const [sendLoading, setSendLoading] = useState(false)
  const [sendError, setSendError] = useState("")
  const [sendSuccess, setSendSuccess] = useState(false)
  const [showPasscodeDialog, setShowPasscodeDialog] = useState(false)
  const [showPasscodeSetupAlert, setShowPasscodeSetupAlert] = useState(false)

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      setUser(JSON.parse(storedUser))
    }
  }, [])

  // Lookup recipient by phone/email/Account ID
  const handleLookupRecipient = async () => {
    if (!recipient.trim()) {
      setLookupError("Please enter a phone number, email, or Account ID")
      return
    }

    setLookupLoading(true)
    setLookupError("")
    setRecipientData(null)

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("/api/payment/lookup-recipient", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ query: recipient })
      })

      const data = await response.json()

      if (data.success) {
        setRecipientData(data.recipient)
        setLookupError("")
      } else {
        setLookupError(data.message || "Recipient not found")
        setRecipientData(null)
      }
    } catch (err) {
      console.error("Lookup recipient error:", err)
      setLookupError("Unable to connect to server")
      setRecipientData(null)
    } finally {
      setLookupLoading(false)
    }
  }

  const handleSend = async () => {
    // Reset states
    setSendError("")
    setSendSuccess(false)

    // Validate amount
    const validation = validateAmount(amount)

    if (!validation.isValid) {
      setSendError(validation.error || "Invalid amount")
      return
    }

    // Validate recipient
    if (!recipientData) {
      setSendError("Please lookup and confirm the recipient first")
      return
    }

    // Show passcode dialog to verify before sending
    setShowPasscodeDialog(true)
  }

  const handlePasscodeVerification = async (passcode: string) => {
    // Use the validated and rounded amount
    const validation = validateAmount(amount)
    const validatedAmount = validation.value

    setSendLoading(true)

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("/api/wallet/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: recipientData.id,
          amount: validatedAmount,
          note: note || undefined,
          passcode
        })
      })

      const data = await response.json()

      if (data.success) {
        // Check if transaction was blocked or flagged for review
        if (data.blocked) {
          setSendError("")
          setSendSuccess(false)
          // Show blocked transaction message with fraud details
          const fraudInfo = data.fraudDetection
          const message = `⚠️ Transaction Blocked\n\n` +
            `Your transaction of RM${amount} to ${recipientData.fullName} has been blocked due to suspicious activity.\n\n` +
            `Risk Score: ${fraudInfo?.riskScore || 'N/A'}/100 (${fraudInfo?.riskLevel || 'N/A'})\n` +
            `Reason: ${fraudInfo?.reason || 'Multiple fraud indicators detected'}\n\n` +
            `Your money (RM${amount}) has been held and will not be credited to the recipient.\n\n` +
            `You can appeal this decision in the SecureTrack tab. If approved, your money will be returned.`

          alert(message)

          // Refresh to update balance and show held transaction
          window.location.reload()
          return { success: true, blocked: true }
        } else if (data.review) {
          setSendError("")
          setSendSuccess(false)
          // Show review message
          alert(`⚠️ Transaction Under Review\n\n` +
            `Your transaction of RM${amount} to ${recipientData.fullName} has been flagged for manual review.\n\n` +
            `Your money is temporarily held and will be reviewed within 72 hours.\n\n` +
            `You can check the status in your wallet dashboard.`)

          window.location.reload()
          return { success: true, review: true }
        }

        // Normal successful transaction
        setSendSuccess(true)
        setSendError("")
        // Reset form
        setAmount("")
        setRecipient("")
        setNote("")
        setRecipientData(null)
        // Show success message
        alert(`Successfully sent RM${amount} to ${recipientData.fullName}!`)
        // Optionally refresh the page to update balance
        window.location.reload()
        return { success: true }
      } else {
        // Check if user needs to set up passcode
        if (data.requiresPasscodeSetup) {
          setShowPasscodeSetupAlert(true)
          setSendLoading(false)
          return { success: false, message: data.message }
        }
        setSendError(data.message || "Transfer failed")
        setSendSuccess(false)
        setSendLoading(false)
        return { success: false, message: data.message, locked: response.status === 429 }
      }
    } catch (err) {
      console.error("Send money error:", err)
      setSendError("Unable to connect to server")
      setSendSuccess(false)
      setSendLoading(false)
      return { success: false, message: "Unable to connect to server" }
    }
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
          Amount (Max: RM 999,999.99)
        </Label>
        <div className="mt-2 flex items-center gap-2">
          <DollarSign className="h-8 w-8 text-muted-foreground" />
          <input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            min="0.01"
            max="999999.99"
            step="0.01"
            className="w-full border-none bg-transparent text-4xl font-bold outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      </Card>

      {/* Payment Form */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipient">Recipient</Label>
          <div className="flex gap-2">
            <Input
              id="recipient"
              placeholder="Enter phone number, email, or Account ID"
              value={recipient}
              onChange={(e) => {
                setRecipient(e.target.value)
                setRecipientData(null)
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
              disabled={lookupLoading || !recipient.trim()}
              variant="outline"
            >
              {lookupLoading ? "Looking..." : "Lookup"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You can send money using phone number (+60...), email, or 12-digit Account ID
          </p>

          {/* Error message */}
          {lookupError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {lookupError}
            </div>
          )}

          {/* Recipient details */}
          {recipientData && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Sending to:</p>
                    <p className="text-lg font-bold">{recipientData.fullName}</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {recipientData.fullName?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Account ID: <span className="font-mono font-semibold text-primary">{recipientData.accountId}</span></p>
                  {recipientData.email && <p>Email: {recipientData.email}</p>}
                  {recipientData.phoneNumber && <p>Phone: +{recipientData.phoneNumber}</p>}
                </div>
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="note">Note (Optional)</Label>
          <Input id="note" placeholder="What's this for?" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {/* Send Error message */}
        {sendError && (
          <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {sendError}
          </div>
        )}

        <Button
          onClick={handleSend}
          className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          size="lg"
          disabled={sendLoading || !recipientData || !amount}
        >
          <Send className="mr-2 h-5 w-5" />
          {sendLoading ? "Sending..." : `Send RM${amount || "0.00"}`}
        </Button>
      </div>

      {/* Passcode Dialog */}
      <PasscodeDialog
        open={showPasscodeDialog}
        onOpenChange={setShowPasscodeDialog}
        mode="verify"
        onSubmit={handlePasscodeVerification}
        title="Verify Transaction"
        description={`Enter your passcode to send RM${amount || "0.00"} to ${recipientData?.fullName || "recipient"}`}
      />

      {/* Passcode Setup Alert */}
      {showPasscodeSetupAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/10">
                <AlertCircle className="h-5 w-5 text-orange-500" />
              </div>
              <h3 className="text-xl font-bold">Passcode Required</h3>
            </div>

            <p className="mb-6 text-sm text-muted-foreground">
              You need to set up a transaction passcode before you can send money. This adds an extra layer of security to your transactions.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setShowPasscodeSetupAlert(false)
                  router.push("/?tab=profile")
                }}
                className="flex-1"
              >
                Set Up Passcode
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowPasscodeSetupAlert(false)}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

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

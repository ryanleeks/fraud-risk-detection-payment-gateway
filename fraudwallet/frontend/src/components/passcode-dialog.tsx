"use client"

import * as React from "react"
import { Lock, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

interface PasscodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: "verify" | "setup" | "change"
  title?: string
  description?: string
  onSubmit: (passcode: string, oldPasscode?: string) => Promise<{ success: boolean; message?: string; locked?: boolean }>
  requireOldPasscode?: boolean
}

export function PasscodeDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  onSubmit,
  requireOldPasscode = false
}: PasscodeDialogProps) {
  const [passcode, setPasscode] = React.useState("")
  const [oldPasscode, setOldPasscode] = React.useState("")
  const [confirmPasscode, setConfirmPasscode] = React.useState("")
  const [step, setStep] = React.useState<"old" | "new" | "confirm" | "single">(
    mode === "change" ? "old" : mode === "setup" ? "new" : "single"
  )
  const [error, setError] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setPasscode("")
      setOldPasscode("")
      setConfirmPasscode("")
      setError("")
      setIsLoading(false)
      if (mode === "change") {
        setStep("old")
      } else if (mode === "setup") {
        setStep("new")
      } else {
        setStep("single")
      }
    }
  }, [open, mode])

  const handleSubmit = async () => {
    setError("")
    setIsLoading(true)

    try {
      if (mode === "setup") {
        // Setup mode - requires new passcode and confirmation
        if (step === "new") {
          if (passcode.length !== 6) {
            setError("Passcode must be 6 digits")
            setIsLoading(false)
            return
          }
          setStep("confirm")
          setIsLoading(false)
          return
        } else if (step === "confirm") {
          if (confirmPasscode !== passcode) {
            setError("Passcodes do not match")
            setIsLoading(false)
            return
          }
          const result = await onSubmit(passcode)
          if (result.success) {
            onOpenChange(false)
          } else {
            setError(result.message || "Failed to set passcode")
          }
        }
      } else if (mode === "change") {
        // Change mode - requires old passcode, new passcode, and confirmation
        if (step === "old") {
          if (oldPasscode.length !== 6) {
            setError("Passcode must be 6 digits")
            setIsLoading(false)
            return
          }
          setStep("new")
          setIsLoading(false)
          return
        } else if (step === "new") {
          if (passcode.length !== 6) {
            setError("Passcode must be 6 digits")
            setIsLoading(false)
            return
          }
          if (passcode === oldPasscode) {
            setError("New passcode must be different")
            setIsLoading(false)
            return
          }
          setStep("confirm")
          setIsLoading(false)
          return
        } else if (step === "confirm") {
          if (confirmPasscode !== passcode) {
            setError("Passcodes do not match")
            setIsLoading(false)
            return
          }
          const result = await onSubmit(passcode, oldPasscode)
          if (result.success) {
            onOpenChange(false)
          } else {
            setError(result.message || "Failed to change passcode")
          }
        }
      } else {
        // Verify mode - single passcode entry
        if (passcode.length !== 6) {
          setError("Passcode must be 6 digits")
          setIsLoading(false)
          return
        }
        const result = await onSubmit(passcode)
        if (result.success) {
          onOpenChange(false)
        } else {
          if (result.locked) {
            setError(result.message || "Too many failed attempts")
          } else {
            setError(result.message || "Incorrect passcode")
            // Clear passcode on error for retry
            setPasscode("")
          }
        }
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleBack = () => {
    setError("")
    if (step === "confirm") {
      setConfirmPasscode("")
      setStep("new")
    } else if (step === "new" && mode === "change") {
      setPasscode("")
      setStep("old")
    }
  }

  const getTitle = () => {
    if (title) return title
    if (mode === "setup") {
      return step === "new" ? "Set Transaction Passcode" : "Confirm Passcode"
    }
    if (mode === "change") {
      if (step === "old") return "Enter Current Passcode"
      if (step === "new") return "Enter New Passcode"
      return "Confirm New Passcode"
    }
    return "Enter Passcode"
  }

  const getDescription = () => {
    if (description && step === (mode === "verify" ? "single" : "new")) {
      return description
    }
    if (mode === "setup") {
      return step === "new"
        ? "Set up a 6-digit passcode for secure transactions"
        : "Re-enter your passcode to confirm"
    }
    if (mode === "change") {
      if (step === "old") return "Enter your current passcode"
      if (step === "new") return "Enter your new 6-digit passcode"
      return "Re-enter your new passcode to confirm"
    }
    return "Enter your 6-digit transaction passcode"
  }

  const getCurrentValue = () => {
    if (step === "old") return oldPasscode
    if (step === "confirm") return confirmPasscode
    return passcode
  }

  const handleValueChange = (value: string) => {
    setError("")
    if (step === "old") {
      setOldPasscode(value)
    } else if (step === "confirm") {
      setConfirmPasscode(value)
    } else {
      setPasscode(value)
    }
  }

  const canSubmit = () => {
    const currentValue = getCurrentValue()
    return currentValue.length === 6 && !isLoading
  }

  const showBackButton = () => {
    return (step === "confirm" || (step === "new" && mode === "change")) && !isLoading
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            {getTitle()}
          </DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          <InputOTP
            maxLength={6}
            value={getCurrentValue()}
            onChange={handleValueChange}
            pattern="^[0-9]+$"
            disabled={isLoading}
            onComplete={() => {
              // Auto-submit when 6 digits are entered in verify mode
              if (mode === "verify" && step === "single") {
                setTimeout(handleSubmit, 100)
              }
            }}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          {showBackButton() && (
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit()}>
            {isLoading ? "Processing..." : step === "confirm" ? "Confirm" : step === "old" ? "Next" : step === "new" ? "Continue" : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

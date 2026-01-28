"use client"

import * as React from "react"
import { Lock, AlertCircle, Mail } from "lucide-react"
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
  showForgotPasscode?: boolean
}

export function PasscodeDialog({
  open,
  onOpenChange,
  mode,
  title,
  description,
  onSubmit,
  requireOldPasscode = false,
  showForgotPasscode = true
}: PasscodeDialogProps) {
  const [passcode, setPasscode] = React.useState("")
  const [oldPasscode, setOldPasscode] = React.useState("")
  const [confirmPasscode, setConfirmPasscode] = React.useState("")
  const [step, setStep] = React.useState<"old" | "new" | "confirm" | "single" | "forgot_otp" | "forgot_new" | "forgot_confirm">(
    mode === "change" ? "old" : mode === "setup" ? "new" : "single"
  )
  const [error, setError] = React.useState("")
  const [successMessage, setSuccessMessage] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [otpCode, setOtpCode] = React.useState("")
  const [resetToken, setResetToken] = React.useState("")
  const [newPasscode, setNewPasscode] = React.useState("")

  // Reset state when dialog opens/closes
  React.useEffect(() => {
    if (open) {
      setPasscode("")
      setOldPasscode("")
      setConfirmPasscode("")
      setError("")
      setSuccessMessage("")
      setIsLoading(false)
      setOtpCode("")
      setResetToken("")
      setNewPasscode("")
      if (mode === "change") {
        setStep("old")
      } else if (mode === "setup") {
        setStep("new")
      } else {
        setStep("single")
      }
    }
  }, [open, mode])

  const handleForgotPasscode = async () => {
    setError("")
    setSuccessMessage("")
    setIsLoading(true)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/user/passcode/forgot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage("Verification code sent to your email")
        setStep("forgot_otp")
      } else {
        setError(data.message || "Failed to send verification code")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOtp = async () => {
    setError("")
    setSuccessMessage("")
    setIsLoading(true)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/user/passcode/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: otpCode }),
      })

      const data = await response.json()

      if (data.success) {
        setResetToken(data.resetToken)
        setStep("forgot_new")
        setOtpCode("")
      } else {
        setError(data.message || "Invalid verification code")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPasscode = async () => {
    setError("")
    setSuccessMessage("")
    setIsLoading(true)

    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/user/passcode/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resetToken,
          newPasscode,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage("Passcode reset successfully!")
        setTimeout(() => {
          onOpenChange(false)
        }, 1500)
      } else {
        setError(data.message || "Failed to reset passcode")
      }
    } catch (error) {
      setError("An error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async () => {
    setError("")
    setIsLoading(true)

    try {
      // Handle forgot passcode flow
      if (step === "forgot_otp") {
        await handleVerifyOtp()
        return
      }

      if (step === "forgot_new") {
        if (newPasscode.length !== 6) {
          setError("Passcode must be 6 digits")
          setIsLoading(false)
          return
        }
        setStep("forgot_confirm")
        setIsLoading(false)
        return
      }

      if (step === "forgot_confirm") {
        if (confirmPasscode !== newPasscode) {
          setError("Passcodes do not match")
          setIsLoading(false)
          return
        }
        await handleResetPasscode()
        return
      }

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
    setSuccessMessage("")
    if (step === "confirm") {
      setConfirmPasscode("")
      setStep("new")
    } else if (step === "new" && mode === "change") {
      setPasscode("")
      setStep("old")
    } else if (step === "forgot_otp") {
      setOtpCode("")
      setStep("single")
    } else if (step === "forgot_new") {
      setNewPasscode("")
      setStep("forgot_otp")
    } else if (step === "forgot_confirm") {
      setConfirmPasscode("")
      setStep("forgot_new")
    }
  }

  const getTitle = () => {
    if (step === "forgot_otp") return "Verify Email"
    if (step === "forgot_new") return "New Passcode"
    if (step === "forgot_confirm") return "Confirm New Passcode"
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
    if (step === "forgot_otp") return "Enter the 6-digit code sent to your email"
    if (step === "forgot_new") return "Enter your new 6-digit passcode"
    if (step === "forgot_confirm") return "Re-enter your new passcode to confirm"
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
    if (step === "confirm" || step === "forgot_confirm") return confirmPasscode
    if (step === "forgot_otp") return otpCode
    if (step === "forgot_new") return newPasscode
    return passcode
  }

  const handleValueChange = (value: string) => {
    setError("")
    setSuccessMessage("")
    if (step === "old") {
      setOldPasscode(value)
    } else if (step === "confirm" || step === "forgot_confirm") {
      setConfirmPasscode(value)
    } else if (step === "forgot_otp") {
      setOtpCode(value)
    } else if (step === "forgot_new") {
      setNewPasscode(value)
    } else {
      setPasscode(value)
    }
  }

  const canSubmit = () => {
    const currentValue = getCurrentValue()
    return currentValue.length === 6 && !isLoading
  }

  const showBackButton = () => {
    return (
      step === "confirm" ||
      (step === "new" && mode === "change") ||
      step === "forgot_otp" ||
      step === "forgot_new" ||
      step === "forgot_confirm"
    ) && !isLoading
  }

  const isForgotFlow = step === "forgot_otp" || step === "forgot_new" || step === "forgot_confirm"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isForgotFlow ? <Mail className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
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

          {successMessage && (
            <div className="flex items-center gap-2 text-green-600 text-sm">
              <span>{successMessage}</span>
            </div>
          )}

          {/* Forgot Passcode Link - only show in verify mode */}
          {mode === "verify" && step === "single" && showForgotPasscode && !isLoading && (
            <button
              type="button"
              onClick={handleForgotPasscode}
              className="text-sm text-primary hover:underline"
            >
              Forgot Passcode?
            </button>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          {showBackButton() && (
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              Back
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={!canSubmit()}>
            {isLoading
              ? "Processing..."
              : step === "confirm" || step === "forgot_confirm"
              ? "Confirm"
              : step === "old"
              ? "Next"
              : step === "new" || step === "forgot_new"
              ? "Continue"
              : step === "forgot_otp"
              ? "Verify"
              : "Submit"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

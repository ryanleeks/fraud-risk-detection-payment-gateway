"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Wallet, Lock, Eye, EyeOff, ArrowLeft, CheckCircle } from "lucide-react"
import Link from "next/link"

export default function ResetPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<"otp" | "password" | "success">("otp")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // OTP state
  const [otp, setOtp] = useState("")
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState<string | null>(null)
  const [resetToken, setResetToken] = useState<string | null>(null)

  // Password state
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  useEffect(() => {
    // Get userId and email from session storage
    const storedUserId = sessionStorage.getItem("resetUserId")
    const storedEmail = sessionStorage.getItem("resetEmail")

    if (!storedUserId || !storedEmail) {
      // No session data, redirect to forgot password
      router.push("/forgot-password")
      return
    }

    setUserId(storedUserId)
    setEmail(storedEmail)
  }, [router])

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: Number(userId),
          code: otp,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setResetToken(data.resetToken)
        setStep("password")
      } else {
        setError(data.message || "Invalid verification code")
      }
    } catch (err) {
      console.error("OTP verification error:", err)
      setError("Unable to verify code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Validate password length
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resetToken,
          newPassword,
          confirmPassword,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Clear session storage
        sessionStorage.removeItem("resetUserId")
        sessionStorage.removeItem("resetEmail")
        setStep("success")
      } else {
        setError(data.message || "Failed to reset password")
      }
    } catch (err) {
      console.error("Reset password error:", err)
      setError("Unable to reset password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (data.success) {
        setOtp("")
        alert("A new verification code has been sent to your email")
      } else {
        setError(data.message || "Failed to resend code")
      }
    } catch (err) {
      console.error("Resend code error:", err)
      setError("Unable to resend code. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-4">
      <div className="w-full max-w-md">
        {/* Mobile App Container */}
        <div className="relative overflow-hidden rounded-[2.5rem] border-8 border-foreground/10 bg-background shadow-2xl">
          {/* Status Bar */}
          <div className="flex items-center justify-between bg-background px-8 py-3 text-xs">
            <span className="font-medium">9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-3 w-3 rounded-full bg-foreground/20" />
              <div className="h-3 w-3 rounded-full bg-foreground/20" />
              <div className="h-3 w-3 rounded-full bg-foreground/20" />
            </div>
          </div>

          {/* Content */}
          <div className="h-[600px] overflow-y-auto bg-background p-6">
            <div className="flex h-full flex-col justify-center space-y-6">
              {/* Back Button */}
              {step !== "success" && (
                <Link
                  href="/forgot-password"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              )}

              {/* Logo and Header */}
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80">
                  {step === "success" ? (
                    <CheckCircle className="h-8 w-8 text-primary-foreground" />
                  ) : (
                    <Wallet className="h-8 w-8 text-primary-foreground" />
                  )}
                </div>
                <h1 className="text-2xl font-bold">
                  {step === "otp" && "Verify Code"}
                  {step === "password" && "Reset Password"}
                  {step === "success" && "Password Reset!"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {step === "otp" && `Enter the 6-digit code sent to ${email}`}
                  {step === "password" && "Create a new password for your account"}
                  {step === "success" && "Your password has been reset successfully"}
                </p>
              </div>

              {/* OTP Step */}
              {step === "otp" && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="otp" className="text-sm font-medium">
                      Verification Code
                    </label>
                    <Input
                      id="otp"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                      maxLength={6}
                      className="text-center text-2xl tracking-widest"
                      required
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      The code will expire in 10 minutes
                    </p>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={loading || otp.length !== 6}
                  >
                    {loading ? "Verifying..." : "Verify Code"}
                  </Button>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={loading}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      Didn't receive the code? Resend
                    </button>
                  </div>
                </form>
              )}

              {/* Password Step */}
              {step === "password" && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="newPassword" className="text-sm font-medium">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Password must be at least 6 characters
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-sm font-medium">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                      {error}
                    </div>
                  )}

                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? "Resetting Password..." : "Reset Password"}
                  </Button>
                </form>
              )}

              {/* Success Step */}
              {step === "success" && (
                <div className="space-y-4">
                  <div className="rounded-lg bg-green-500/10 p-4 text-center text-green-600">
                    Your password has been changed successfully. You can now login with your new password.
                  </div>

                  <Button
                    onClick={() => router.push("/login")}
                    className="w-full"
                    size="lg"
                  >
                    Go to Login
                  </Button>
                </div>
              )}

              {/* Help Text */}
              {step !== "success" && (
                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{" "}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

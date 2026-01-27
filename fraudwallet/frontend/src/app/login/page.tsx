"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Wallet, Mail, Lock, Eye, EyeOff } from "lucide-react"
import Link from "next/link"

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [emailOrPhone, setEmailOrPhone] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // 2FA state
  const [showTwoFAModal, setShowTwoFAModal] = useState(false)
  const [twoFACode, setTwoFACode] = useState("")
  const [twoFAUserId, setTwoFAUserId] = useState<number | null>(null)
  const [twoFAMethod, setTwoFAMethod] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      // Call backend API
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailOrPhone,
          password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Check if 2FA is required
        if (data.requiresTwoFA) {
          // Show 2FA modal
          setTwoFAUserId(data.userId)
          setTwoFAMethod(data.message)
          setShowTwoFAModal(true)
        } else {
          // Normal login - save token and redirect
          localStorage.setItem("token", data.token)
          localStorage.setItem("user", JSON.stringify(data.user))

          alert("Login successful! Welcome back!")
          router.push("/")
        }
      } else {
        setError(data.message || "Failed to login")
      }
    } catch (err) {
      console.error("Login error:", err)
      setError("Unable to connect to server. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await fetch("/api/auth/verify-2fa", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: twoFAUserId,
          code: twoFACode,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Save token and redirect
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))

        alert("Login successful! Welcome back!")
        router.push("/")
      } else {
        setError(data.message || "Invalid verification code")
      }
    } catch (err) {
      console.error("2FA verification error:", err)
      setError("Unable to verify code. Please try again.")
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

          {/* Login Content */}
          <div className="h-[600px] overflow-y-auto bg-background p-6">
            <div className="flex h-full flex-col justify-center space-y-6">
              {/* Logo and Header */}
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80">
                  <Wallet className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold">Welcome Back</h1>
                <p className="mt-2 text-sm text-muted-foreground">Sign in to continue to your wallet</p>
              </div>

              {/* Login Form */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="emailOrPhone" className="text-sm font-medium">
                    Email or Phone Number
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="emailOrPhone"
                      type="text"
                      placeholder="Enter email or phone number"
                      value={emailOrPhone}
                      onChange={(e) => setEmailOrPhone(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    You can use your email or phone number to login
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 rounded border-border" />
                    <span className="text-muted-foreground">Remember me</span>
                  </label>
                  <Link href="/forgot-password" className="text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Signing In..." : "Sign In"}
                </Button>
              </form>

              {/* Sign Up Link */}
              <p className="text-center text-sm text-muted-foreground">
                Don't have an account?{" "}
                <Link href="/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2FA Verification Modal */}
      {showTwoFAModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold">Two-Factor Authentication</h3>

            <p className="mb-4 text-sm text-muted-foreground">{twoFAMethod}</p>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div>
                <label className="text-sm font-medium">Verification Code</label>
                <Input
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={twoFACode}
                  onChange={(e) => setTwoFACode(e.target.value.replace(/\D/g, ""))}
                  maxLength={6}
                  className="text-center text-2xl tracking-widest"
                  required
                  autoFocus
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Enter the 6-digit code sent to you
                </p>
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={loading || twoFACode.length !== 6} className="flex-1">
                  {loading ? "Verifying..." : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowTwoFAModal(false)
                    setTwoFACode("")
                    setError("")
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

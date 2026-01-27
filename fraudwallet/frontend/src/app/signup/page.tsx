"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Wallet, Mail, Lock, User, Eye, EyeOff, Phone } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
  })

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    // Validate phone number format (user inputs 9-10 digits, we prepend "60")
    const phoneDigits = formData.phoneNumber.replace(/[\s\-\+]/g, '')
    const fullPhone = phoneDigits.startsWith('60') ? phoneDigits : `60${phoneDigits}`
    const phoneRegex = /^60\d{9,10}$/
    if (!phoneRegex.test(fullPhone)) {
      setError("Phone number must be 9-10 digits (Malaysian number)")
      return
    }

    // Check if passwords match
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match")
      return
    }

    // Check password length
    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      // Call backend API
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          phoneNumber: fullPhone,  // Send complete phone with "60" prefix
          password: formData.password,
        }),
      })

      const data = await response.json()

      if (data.success) {
        // Save token to localStorage
        localStorage.setItem("token", data.token)
        localStorage.setItem("user", JSON.stringify(data.user))

        // Show success and redirect to login
        alert("Account created successfully! Redirecting to login...")
        router.push("/login")
      } else {
        setError(data.message || "Failed to create account")
      }
    } catch (err) {
      console.error("Signup error:", err)
      setError("Unable to connect to server. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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

          {/* Signup Content */}
          <div className="h-[600px] overflow-y-auto bg-background p-6">
            <div className="flex h-full flex-col justify-center space-y-6">
              {/* Logo and Header */}
              <div className="text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80">
                  <Wallet className="h-8 w-8 text-primary-foreground" />
                </div>
                <h1 className="text-2xl font-bold">Create Account</h1>
                <p className="mt-2 text-sm text-muted-foreground">Sign up to get started with your wallet</p>
              </div>

              {/* Signup Form */}
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="fullName" className="text-sm font-medium">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      value={formData.fullName}
                      onChange={(e) => handleChange("fullName", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="phoneNumber" className="text-sm font-medium">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <span className="absolute left-10 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      +60
                    </span>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      placeholder="123456789"
                      value={formData.phoneNumber}
                      onChange={(e) => {
                        // Remove any non-digit characters and remove "60" prefix if user types it
                        let value = e.target.value.replace(/\D/g, '')
                        if (value.startsWith('60')) {
                          value = value.substring(2)
                        }
                        handleChange("phoneNumber", value)
                      }}
                      className="pl-16"
                      required
                      maxLength={10}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Enter 9-10 digits (Malaysian number)</p>
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
                      placeholder="Create a password"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
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

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange("confirmPassword", e.target.value)}
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

                <div className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-border" required />
                  <span className="text-muted-foreground">
                    I agree to the{" "}
                    <Link href="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </span>
                </div>

                {error && (
                  <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Account"}
                </Button>
              </form>

              {/* Login Link */}
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

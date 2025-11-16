"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Bell, Shield, HelpCircle, LogOut, ChevronRight, UserX, Copy, QrCode } from "lucide-react"
import { QRCodeCanvas } from "qrcode.react"

export function ProfileTab() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAccountSettings, setShowAccountSettings] = useState(false)
  const [showSecuritySettings, setShowSecuritySettings] = useState(false)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [showQRModal, setShowQRModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  // Form states
  const [fullName, setFullName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [newPhoneNumber, setNewPhoneNumber] = useState("")
  const [phoneChangePassword, setPhoneChangePassword] = useState("")
  const [terminatePassword, setTerminatePassword] = useState("")

  // 2FA states
  const [twofaPassword, setTwofaPassword] = useState("")
  const [twofaMethodPassword, setTwofaMethodPassword] = useState("")
  const [selectedTwofaMethod, setSelectedTwofaMethod] = useState("email")

  // Load user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user")
    if (storedUser) {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setFullName(userData.fullName || "")
    }
  }, [])

  // Get user initials for avatar
  const getInitials = (name: string) => {
    if (!name) return "?"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    alert("Logged out successfully!")
    router.push("/login")
  }

  // Update profile name handler (Edit Profile modal)
  const handleUpdateProfile = async () => {
    setError("")

    if (fullName.trim() === user.fullName) {
      setShowEditModal(false)
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ fullName: fullName.trim() })
      })

      const data = await response.json()

      if (data.success) {
        // Update localStorage with new user data
        localStorage.setItem("user", JSON.stringify(data.user))
        setUser(data.user)
        setShowEditModal(false)
        alert("Name updated successfully!")
      } else {
        setError(data.message || "Failed to update profile")
      }
    } catch (err) {
      console.error("Update profile error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Change password handler (Account Settings modal)
  const handleChangePassword = async () => {
    setError("")

    if (!currentPassword || !newPassword) {
      setError("Please enter both current and new password")
      return
    }

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters")
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      })

      const data = await response.json()

      if (data.success) {
        setCurrentPassword("")
        setNewPassword("")
        alert("Password changed successfully!")
      } else {
        setError(data.message || "Failed to change password")
      }
    } catch (err) {
      console.error("Change password error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Change phone number handler (Account Settings modal)
  const handleChangePhoneNumber = async () => {
    setError("")

    if (!newPhoneNumber || !phoneChangePassword) {
      setError("Please enter new phone number and password")
      return
    }

    // Validate phone number format (user inputs 9-10 digits, we prepend "60")
    const phoneDigits = newPhoneNumber.replace(/[\s\-\+]/g, '')
    const fullPhone = phoneDigits.startsWith('60') ? phoneDigits : `60${phoneDigits}`
    const phoneRegex = /^60\d{9,10}$/
    if (!phoneRegex.test(fullPhone)) {
      setError("Phone number must be 9-10 digits (Malaysian number)")
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/phone", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          newPhoneNumber: fullPhone,  // Send complete phone with "60" prefix
          password: phoneChangePassword
        })
      })

      const data = await response.json()

      if (data.success) {
        // Update localStorage with new phone number
        const updatedUser = { ...user, phoneNumber: data.phoneNumber }
        localStorage.setItem("user", JSON.stringify(updatedUser))
        setUser(updatedUser)
        setNewPhoneNumber("")
        setPhoneChangePassword("")
        alert(data.message || "Phone number updated successfully!")
      } else {
        setError(data.message || "Failed to update phone number")
      }
    } catch (err) {
      console.error("Change phone number error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Terminate account handler
  const handleTerminateAccount = async () => {
    if (!terminatePassword) {
      setError("Password is required")
      return
    }

    if (!confirm("Are you sure you want to terminate your account? This action cannot be undone.")) {
      return
    }

    setLoading(true)
    setError("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/terminate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ password: terminatePassword })
      })

      const data = await response.json()

      if (data.success) {
        alert("Account terminated successfully")
        localStorage.removeItem("token")
        localStorage.removeItem("user")
        router.push("/login")
      } else {
        setError(data.message || "Failed to terminate account")
      }
    } catch (err) {
      console.error("Terminate account error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Toggle 2FA handler
  const handleToggle2FA = async (enabled: boolean) => {
    if (!twofaPassword) {
      setError("Password is required to change 2FA settings")
      return
    }

    setLoading(true)
    setError("")
    setSuccessMessage("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/2fa/toggle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ enabled, password: twofaPassword })
      })

      const data = await response.json()

      if (data.success) {
        // Update user in localStorage
        const updatedUser = { ...user, twofaEnabled: data.twofaEnabled }
        localStorage.setItem("user", JSON.stringify(updatedUser))
        setUser(updatedUser)
        setTwofaPassword("")
        setSuccessMessage(data.message)
      } else {
        setError(data.message || "Failed to update 2FA settings")
      }
    } catch (err) {
      console.error("Toggle 2FA error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Update 2FA method handler
  const handleUpdate2FAMethod = async () => {
    if (!twofaMethodPassword) {
      setError("Password is required to change 2FA method")
      return
    }

    setLoading(true)
    setError("")
    setSuccessMessage("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/2fa/method", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ method: selectedTwofaMethod, password: twofaMethodPassword })
      })

      const data = await response.json()

      if (data.success) {
        // Update user in localStorage
        const updatedUser = { ...user, twofaMethod: data.twofaMethod }
        localStorage.setItem("user", JSON.stringify(updatedUser))
        setUser(updatedUser)
        setTwofaMethodPassword("")
        setSuccessMessage(data.message)
      } else {
        setError(data.message || "Failed to update 2FA method")
      }
    } catch (err) {
      console.error("Update 2FA method error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  // Send test 2FA code handler
  const handleSendTest2FA = async (method: string) => {
    setLoading(true)
    setError("")
    setSuccessMessage("")

    try {
      const token = localStorage.getItem("token")

      const response = await fetch("http://localhost:8080/api/user/2fa/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ method })
      })

      const data = await response.json()

      if (data.success) {
        setSuccessMessage(data.message)
      } else {
        setError(data.message || "Failed to send test code")
      }
    } catch (err) {
      console.error("Send test 2FA error:", err)
      setError("Unable to connect to server")
    } finally {
      setLoading(false)
    }
  }

  const menuItems = [
    { icon: Settings, label: "Account Settings", description: "Manage your account" },
    { icon: Bell, label: "Notifications", description: "Alerts and updates" },
    { icon: Shield, label: "Security", description: "Password and 2FA" },
    { icon: HelpCircle, label: "Help & Support", description: "Get assistance" },
  ]

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-3xl font-bold text-primary-foreground">
          {getInitials(user.fullName)}
        </div>
        <div>
          <h2 className="text-2xl font-bold">{user.fullName}</h2>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          {user.phoneNumber && (
            <p className="text-sm text-muted-foreground">+{user.phoneNumber}</p>
          )}
          {user.accountId && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <p className="text-sm font-mono font-semibold text-primary">
                Account ID: {user.accountId}
              </p>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(user.accountId)
                  alert("Account ID copied to clipboard!")
                }}
                className="rounded p-1 hover:bg-muted transition-colors"
                title="Copy Account ID"
              >
                <Copy className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </button>
              <button
                onClick={() => setShowQRModal(true)}
                className="rounded p-1 hover:bg-muted transition-colors"
                title="Show QR Code"
              >
                <QrCode className="h-4 w-4 text-muted-foreground hover:text-primary" />
              </button>
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowEditModal(true)}>
          Edit Profile
        </Button>
      </div>

      {/* Account Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">156</p>
          <p className="text-xs text-muted-foreground">Transactions</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-accent">$24.5K</p>
          <p className="text-xs text-muted-foreground">Total Sent</p>
        </Card>
        <Card className="p-4 text-center">
          <p className="text-2xl font-bold text-primary">12</p>
          <p className="text-xs text-muted-foreground">Contacts</p>
        </Card>
      </div>

      {/* Menu Items */}
      <div className="space-y-2">
        {menuItems.map((item, index) => (
          <Card
            key={index}
            className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-muted"
            onClick={() => {
              if (item.label === "Account Settings") {
                setShowAccountSettings(true)
              } else if (item.label === "Security") {
                setShowSecuritySettings(true)
              }
              // Other menu items can be added later
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <item.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.description}</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Card>
        ))}
      </div>

      {/* Logout Button */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive bg-transparent"
        size="lg"
        onClick={handleLogout}
      >
        <LogOut className="mr-2 h-5 w-5" />
        Log Out
      </Button>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.</p>
      <p className="text-center text-xs text-muted-foreground">For FYP@APU purpose.</p>
      <p className="text-center text-xs text-muted-foreground">Version Alpha Release [Dev]</p>

      {/* Edit Profile Modal - Name Only */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold">Edit Profile</h3>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Full Name</label>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Updating..." : "Update Name"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false)
                    setError("")
                    setFullName(user.fullName)
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Account Settings Modal - Password & Terminate Account */}
      {showAccountSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold">Account Settings</h3>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-6">
              {/* Change Password Section */}
              <div className="space-y-4">
                <h4 className="font-semibold">Change Password</h4>

                <div>
                  <label className="text-sm font-medium">Current Password</label>
                  <Input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">New Password</label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password (min 6 characters)"
                  />
                </div>

                <Button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="w-full"
                >
                  {loading ? "Changing..." : "Change Password"}
                </Button>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Change/Add Phone Number Section */}
              <div className="space-y-4">
                <h4 className="font-semibold">
                  {user?.phoneNumber ? "Change Phone Number" : "Add Phone Number"}
                </h4>
                {user?.phoneNumber && (
                  <p className="text-sm text-muted-foreground">
                    Current: +{user.phoneNumber}
                  </p>
                )}
                {user?.phoneNumber && (
                  <p className="text-xs text-muted-foreground">
                    Note: You can only change your phone number once every 90 days
                  </p>
                )}

                <div>
                  <label className="text-sm font-medium">
                    {user?.phoneNumber ? "New Phone Number" : "Phone Number"}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      +60
                    </span>
                    <Input
                      type="tel"
                      value={newPhoneNumber}
                      onChange={(e) => {
                        // Remove any non-digit characters and remove "60" prefix if user types it
                        let value = e.target.value.replace(/\D/g, '')
                        if (value.startsWith('60')) {
                          value = value.substring(2)
                        }
                        setNewPhoneNumber(value)
                      }}
                      placeholder="123456789"
                      className="pl-12"
                      maxLength={10}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Enter 9-10 digits (Malaysian number)</p>
                </div>

                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={phoneChangePassword}
                    onChange={(e) => setPhoneChangePassword(e.target.value)}
                    placeholder="Enter your password to confirm"
                  />
                </div>

                <Button
                  onClick={handleChangePhoneNumber}
                  disabled={loading}
                  className="w-full"
                >
                  {loading
                    ? (user?.phoneNumber ? "Changing..." : "Adding...")
                    : (user?.phoneNumber ? "Change Phone Number" : "Add Phone Number")}
                </Button>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Terminate Account Section */}
              <div className="space-y-4">
                <h4 className="font-semibold text-destructive">Danger Zone</h4>
                <p className="text-sm text-muted-foreground">
                  Terminating your account will prevent you from logging in. Your data will remain in our system for record keeping.
                </p>

                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowAccountSettings(false)
                    setShowTerminateModal(true)
                  }}
                  className="w-full"
                >
                  <UserX className="mr-2 h-4 w-4" />
                  Terminate Account
                </Button>
              </div>

              {/* Close Button */}
              <Button
                variant="outline"
                onClick={() => {
                  setShowAccountSettings(false)
                  setError("")
                  setCurrentPassword("")
                  setNewPassword("")
                  setNewPhoneNumber("")
                  setPhoneChangePassword("")
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Terminate Account Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-destructive">Terminate Account</h3>

            <p className="mb-4 text-sm text-muted-foreground">
              This will permanently terminate your account. You will not be able to login anymore, but your data will remain in our system for record keeping purposes.
            </p>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Enter your password to confirm</label>
                <Input
                  type="password"
                  value={terminatePassword}
                  onChange={(e) => setTerminatePassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={handleTerminateAccount}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Terminating..." : "Terminate Account"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowTerminateModal(false)
                    setError("")
                    setTerminatePassword("")
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Settings Modal - 2FA Management */}
      {showSecuritySettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="mb-4 text-xl font-bold">Security Settings</h3>

            {error && (
              <div className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {successMessage && (
              <div className="mb-4 rounded-lg bg-green-500/10 p-3 text-sm text-green-600">
                {successMessage}
              </div>
            )}

            <div className="space-y-6">
              {/* Two-Factor Authentication Toggle */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold">Two-Factor Authentication (2FA)</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add an extra layer of security to your account
                  </p>
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium">
                      2FA is {user?.twofaEnabled ? "Enabled" : "Disabled"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {user?.twofaEnabled
                        ? `Method: ${user.twofaMethod === "email" ? "Email" : "Phone"}`
                        : "Protect your account with 2FA"}
                    </p>
                  </div>
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors ${
                      user?.twofaEnabled ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                    onClick={() => {
                      if (!twofaPassword && !user?.twofaEnabled) {
                        setError("Please enter your password below to enable 2FA")
                        return
                      }
                      handleToggle2FA(!user?.twofaEnabled)
                    }}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        user?.twofaEnabled ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Password</label>
                  <Input
                    type="password"
                    value={twofaPassword}
                    onChange={(e) => setTwofaPassword(e.target.value)}
                    placeholder="Enter your password to enable/disable 2FA"
                  />
                </div>
              </div>

              {/* 2FA Method Selection - Only show if 2FA is enabled */}
              {user?.twofaEnabled && (
                <>
                  <div className="border-t border-border" />

                  <div className="space-y-4">
                    <h4 className="font-semibold">2FA Method</h4>

                    <div className="space-y-2">
                      <div
                        className={`cursor-pointer rounded-lg border-2 p-3 ${
                          selectedTwofaMethod === "email"
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        onClick={() => setSelectedTwofaMethod("email")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Email Verification</p>
                            <p className="text-xs text-muted-foreground">
                              Free - Receive codes via email
                            </p>
                          </div>
                          <div
                            className={`h-4 w-4 rounded-full border-2 ${
                              selectedTwofaMethod === "email"
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            }`}
                          />
                        </div>
                      </div>

                      <div
                        className={`cursor-pointer rounded-lg border-2 p-3 ${
                          selectedTwofaMethod === "phone"
                            ? "border-primary bg-primary/5"
                            : "border-border"
                        }`}
                        onClick={() => setSelectedTwofaMethod("phone")}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">Phone/SMS Verification</p>
                            <p className="text-xs text-destructive">
                              ⚠️ Requires paid SMS service (Not implemented)
                            </p>
                          </div>
                          <div
                            className={`h-4 w-4 rounded-full border-2 ${
                              selectedTwofaMethod === "phone"
                                ? "border-primary bg-primary"
                                : "border-muted-foreground"
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {selectedTwofaMethod !== user?.twofaMethod && (
                      <>
                        <div>
                          <label className="text-sm font-medium">Password</label>
                          <Input
                            type="password"
                            value={twofaMethodPassword}
                            onChange={(e) => setTwofaMethodPassword(e.target.value)}
                            placeholder="Enter your password to change method"
                          />
                        </div>

                        <Button
                          onClick={handleUpdate2FAMethod}
                          disabled={loading}
                          className="w-full"
                        >
                          {loading ? "Updating..." : "Update Method"}
                        </Button>
                      </>
                    )}
                  </div>

                  {/* Test 2FA */}
                  <div className="border-t border-border" />

                  <div className="space-y-4">
                    <h4 className="font-semibold">Test 2FA</h4>
                    <p className="text-sm text-muted-foreground">
                      Send a test verification code to verify your setup
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleSendTest2FA("email")}
                        disabled={loading}
                        className="flex-1"
                      >
                        Test Email
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleSendTest2FA("phone")}
                        disabled={loading || !user?.phoneNumber}
                        className="flex-1"
                      >
                        Test Phone
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Close Button */}
              <Button
                variant="outline"
                onClick={() => {
                  setShowSecuritySettings(false)
                  setError("")
                  setSuccessMessage("")
                  setTwofaPassword("")
                  setTwofaMethodPassword("")
                }}
                className="w-full"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && user?.accountId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-bold text-center">Account ID QR Code</h3>

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
                Scan this QR code to share your Account ID for receiving payments
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

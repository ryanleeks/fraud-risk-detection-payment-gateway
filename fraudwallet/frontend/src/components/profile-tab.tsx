"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Bell, Shield, HelpCircle, LogOut, ChevronRight, UserX } from "lucide-react"

export function ProfileTab() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showTerminateModal, setShowTerminateModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form states
  const [fullName, setFullName] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [terminatePassword, setTerminatePassword] = useState("")

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

  // Update profile handler
  const handleUpdateProfile = async () => {
    setError("")
    setLoading(true)

    try {
      const token = localStorage.getItem("token")
      const updateData: any = {}

      if (fullName.trim() !== user.fullName) {
        updateData.fullName = fullName.trim()
      }

      if (newPassword) {
        if (!currentPassword) {
          setError("Current password is required to change password")
          setLoading(false)
          return
        }
        updateData.currentPassword = currentPassword
        updateData.newPassword = newPassword
      }

      const response = await fetch("http://localhost:8080/api/user/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(updateData)
      })

      const data = await response.json()

      if (data.success) {
        // Update localStorage with new user data
        localStorage.setItem("user", JSON.stringify(data.user))
        setUser(data.user)
        setShowEditModal(false)
        setCurrentPassword("")
        setNewPassword("")
        alert("Profile updated successfully!")
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

      {/* Terminate Account Button */}
      <Button
        variant="outline"
        className="w-full text-destructive hover:bg-destructive hover:text-destructive-foreground bg-transparent border-destructive"
        size="sm"
        onClick={() => setShowTerminateModal(true)}
      >
        <UserX className="mr-2 h-4 w-4" />
        Terminate Account
      </Button>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">Copyright © 2025 Ryan Lee Khang Sern. All rights reserved.</p>
      <p className="text-center text-xs text-muted-foreground">For FYP@APU purpose.</p>
      <p className="text-center text-xs text-muted-foreground">Version 0.1.0 Alpha Release [Dev]</p>

      {/* Edit Profile Modal */}
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

              <div>
                <label className="text-sm font-medium">Current Password (optional)</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>

              <div>
                <label className="text-sm font-medium">New Password (optional)</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateProfile}
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? "Updating..." : "Update Profile"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditModal(false)
                    setError("")
                    setCurrentPassword("")
                    setNewPassword("")
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
    </div>
  )
}

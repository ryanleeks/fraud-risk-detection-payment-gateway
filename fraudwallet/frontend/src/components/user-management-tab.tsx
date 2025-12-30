"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { User, Search, Shield, Ban, KeyRound, CheckCircle, XCircle, Loader2 } from "lucide-react"
import { TimeDisplay } from "@/components/TimeDisplay"

interface UserData {
  id: number
  account_id: string
  full_name: string
  email: string
  phone_number: string
  account_status: string
  twofa_enabled: number
  twofa_method: string
  wallet_balance: number
  role: string
  created_at: string
  updated_at: string
}

export function UserManagementTab() {
  const [users, setUsers] = useState<UserData[]>([])
  const [filteredUsers, setFilteredUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [newPassword, setNewPassword] = useState("")

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    // Filter users based on search query
    if (searchQuery.trim() === "") {
      setFilteredUsers(users)
    } else {
      const query = searchQuery.toLowerCase()
      setFilteredUsers(
        users.filter(
          (user) =>
            user.full_name.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.account_id.includes(query) ||
            user.phone_number.includes(query)
        )
      )
    }
  }, [searchQuery, users])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await response.json()

      if (data.success) {
        setUsers(data.users)
        setFilteredUsers(data.users)
      }
    } catch (err) {
      console.error("Load users error:", err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserStatus = async (userId: number, status: string) => {
    setActionLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `/api/admin/users/${userId}/status`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      )
      const data = await response.json()

      if (data.success) {
        await loadUsers()
        alert(`User ${status === "active" ? "activated" : "suspended"} successfully`)
        setSelectedUser(null)
      } else {
        alert(data.message || "Failed to update user status")
      }
    } catch (err) {
      console.error("Update status error:", err)
      alert("Failed to update user status")
    } finally {
      setActionLoading(false)
    }
  }

  const resetPassword = async (userId: number) => {
    if (!newPassword || newPassword.length < 6) {
      alert("Password must be at least 6 characters")
      return
    }

    setActionLoading(true)
    try {
      const token = localStorage.getItem("token")
      const response = await fetch(
        `/api/admin/users/${userId}/password`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ newPassword }),
        }
      )
      const data = await response.json()

      if (data.success) {
        alert("Password reset successfully")
        setNewPassword("")
        setSelectedUser(null)
      } else {
        alert(data.message || "Failed to reset password")
      }
    } catch (err) {
      console.error("Reset password error:", err)
      alert("Failed to reset password")
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <User className="h-6 w-6" />
          User Management
        </h2>
        <Badge variant="outline">{users.length} Total Users</Badge>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search by name, email, account ID, or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* User List */}
      <div className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            No users found
          </Card>
        ) : (
          filteredUsers.map((user) => (
            <Card key={user.id} className="p-4">
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{user.full_name}</h3>
                      {user.role === "admin" && (
                        <Badge variant="default" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                      {user.account_status === "terminated" ? (
                        <Badge variant="destructive" className="text-xs">
                          <Ban className="h-3 w-3 mr-1" />
                          Suspended
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Active
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {user.email}
                    </p>
                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                      <span>ID: {user.account_id}</span>
                      <span>Phone: {user.phone_number}</span>
                      <span>Balance: RM {user.wallet_balance.toFixed(2)}</span>
                    </div>
                    {user.twofa_enabled === 1 && (
                      <Badge variant="secondary" className="text-xs mt-1">
                        2FA: {user.twofa_method}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setSelectedUser(selectedUser?.id === user.id ? null : user)
                    }
                  >
                    {selectedUser?.id === user.id ? "Close" : "Manage"}
                  </Button>
                </div>

                {/* Expanded Actions */}
                {selectedUser?.id === user.id && (
                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                    <h4 className="font-semibold text-sm">Admin Actions</h4>

                    {/* Status Toggle */}
                    <div className="flex gap-2">
                      {user.account_status === "active" ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => updateUserStatus(user.id, "terminated")}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Ban className="h-4 w-4 mr-2" />
                          )}
                          Suspend Account
                        </Button>
                      ) : (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => updateUserStatus(user.id, "active")}
                          disabled={actionLoading}
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Activate Account
                        </Button>
                      )}
                    </div>

                    {/* Reset Password */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Reset Password</label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          placeholder="New password (min 6 characters)"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => resetPassword(user.id)}
                          disabled={actionLoading || !newPassword}
                        >
                          {actionLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <KeyRound className="h-4 w-4 mr-2" />
                          )}
                          Reset
                        </Button>
                      </div>
                    </div>

                    {/* User Details */}
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <span>Created:</span>
                        <TimeDisplay
                          utcDate={user.created_at}
                          format="full"
                          showBadge={true}
                          className="text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span>Updated:</span>
                        <TimeDisplay
                          utcDate={user.updated_at}
                          format="full"
                          showBadge={true}
                          className="text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}

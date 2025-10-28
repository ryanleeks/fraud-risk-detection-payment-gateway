"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings, Bell, Shield, HelpCircle, LogOut, ChevronRight } from "lucide-react"

export function ProfileTab() {
  const menuItems = [
    { icon: Settings, label: "Account Settings", description: "Manage your account" },
    { icon: Bell, label: "Notifications", description: "Alerts and updates" },
    { icon: Shield, label: "Security", description: "Password and 2FA" },
    { icon: HelpCircle, label: "Help & Support", description: "Get assistance" },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Profile Header */}
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-3xl font-bold text-primary-foreground">
          JD
        </div>
        <div>
          <h2 className="text-2xl font-bold">John Doe</h2>
          <p className="text-sm text-muted-foreground">john.doe@email.com</p>
        </div>
        <Button variant="outline" size="sm">
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
      >
        <LogOut className="mr-2 h-5 w-5" />
        Log Out
      </Button>

      {/* App Version */}
      <p className="text-center text-xs text-muted-foreground">Version 1.0.0</p>
    </div>
  )
}

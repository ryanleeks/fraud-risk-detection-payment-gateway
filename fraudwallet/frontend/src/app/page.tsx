"use client"

import { useState } from "react"
import { DashboardTab } from "@/components/dashboard-tab"
import { PaymentTab } from "@/components/payment-tab"
import { ProfileTab } from "@/components/profile-tab"
import { Home, Send, User } from "lucide-react"

export default function WalletApp() {
  const [activeTab, setActiveTab] = useState<"dashboard" | "payment" | "profile">("dashboard")

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

          {/* App Content */}
          <div className="h-[600px] overflow-y-auto bg-background">
            {activeTab === "dashboard" && <DashboardTab />}
            {activeTab === "payment" && <PaymentTab />}
            {activeTab === "profile" && <ProfileTab />}
          </div>

          {/* Bottom Navigation */}
          <div className="border-t border-border bg-card">
            <div className="flex items-center justify-around px-6 py-4">
              <button
                onClick={() => setActiveTab("dashboard")}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === "dashboard" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Home className="h-6 w-6" />
                <span className="text-xs font-medium">Home</span>
              </button>
              <button
                onClick={() => setActiveTab("payment")}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === "payment" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Send className="h-6 w-6" />
                <span className="text-xs font-medium">Payment</span>
              </button>
              <button
                onClick={() => setActiveTab("profile")}
                className={`flex flex-col items-center gap-1 transition-colors ${
                  activeTab === "profile" ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <User className="h-6 w-6" />
                <span className="text-xs font-medium">Profile</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

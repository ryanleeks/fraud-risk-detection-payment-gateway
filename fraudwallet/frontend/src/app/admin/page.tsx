"use client"

import { useState } from "react"
import { useAuth } from "@/hooks/useAuth"
import { Button } from "@/components/ui/button"
import { Shield, LogOut, ClipboardCheck, BarChart3, Users, Gauge } from "lucide-react"
import { FraudVerificationTab } from "@/components/fraud-verification-tab"
import { AcademicMetricsTab } from "@/components/academic-metrics-tab"
import { UserManagementTab } from "@/components/user-management-tab"
import { FraudEngineTab } from "@/components/fraud-engine-tab"
import { TimezoneProvider } from "@/contexts/TimezoneContext"

export default function AdminPage() {
  const { isAuthenticated, isLoading, isAdmin, logout } = useAuth(true) // Require admin
  const [activeTab, setActiveTab] = useState<"verification" | "metrics" | "users" | "fraudEngine">("verification")

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If not authenticated or not admin, useAuth hook will redirect
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return (
    <TimezoneProvider>
      <div className="min-h-screen bg-muted">
        {/* Header */}
        <div className="bg-background border-b border-border">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                  <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                  <p className="text-sm text-muted-foreground">Super User Access</p>
                </div>
              </div>
              <Button variant="outline" onClick={logout} size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>

            {/* Tab Navigation */}
            <div className="mt-4 flex gap-2 border-b border-border">
              <button
                onClick={() => setActiveTab("verification")}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all ${
                  activeTab === "verification"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <ClipboardCheck className="h-4 w-4" />
                Verify Transactions
              </button>
              <button
                onClick={() => setActiveTab("metrics")}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all ${
                  activeTab === "metrics"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <BarChart3 className="h-4 w-4" />
                Academic Metrics
              </button>
              <button
                onClick={() => setActiveTab("fraudEngine")}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all ${
                  activeTab === "fraudEngine"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Gauge className="h-4 w-4" />
                Fraud Engine
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 transition-all ${
                  activeTab === "users"
                    ? "border-primary text-primary font-semibold"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-4 w-4" />
                User Management
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 py-6">
          <div className="bg-background rounded-lg shadow-lg overflow-hidden">
            {activeTab === "verification" && <FraudVerificationTab />}
            {activeTab === "metrics" && <AcademicMetricsTab />}
            {activeTab === "fraudEngine" && <FraudEngineTab />}
            {activeTab === "users" && <UserManagementTab />}
          </div>
        </div>
      </div>
    </TimezoneProvider>
  )
}

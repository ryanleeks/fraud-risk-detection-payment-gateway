"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Custom hook for authentication
 * Checks if user is logged in and redirects if not
 */
export function useAuth() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")

    // Check for missing, null, or invalid string values
    if (!token || !storedUser || storedUser === "undefined" || storedUser === "null" || storedUser.trim() === "") {
      // Not logged in or invalid data - clear and redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      router.push("/login")
      setIsLoading(false)
      return
    }

    try {
      const userData = JSON.parse(storedUser)
      // Validate that parsed data is a proper object with expected properties
      if (!userData || typeof userData !== 'object' || userData === null) {
        throw new Error('Invalid user data: not an object')
      }
      setUser(userData)
      setIsAuthenticated(true)
    } catch (error) {
      console.error("Error parsing user data:", error)
      console.error("Stored user value was:", storedUser)
      // Invalid data - clear and redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const logout = () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    setIsAuthenticated(false)
    setUser(null)
    router.push("/login")
  }

  return {
    isAuthenticated,
    isLoading,
    user,
    logout
  }
}

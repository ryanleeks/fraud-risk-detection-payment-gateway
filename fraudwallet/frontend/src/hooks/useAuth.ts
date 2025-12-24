"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"

/**
 * Custom hook for authentication
 * Checks if user is logged in and redirects if not
 */
export function useAuth(requireAdmin: boolean = false) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check if user is logged in
    const token = localStorage.getItem("token")
    const storedUser = localStorage.getItem("user")

    if (!token || !storedUser) {
      // Not logged in - redirect to login
      router.push("/login")
      setIsLoading(false)
      return
    }

    try {
      const userData = JSON.parse(storedUser)
      setUser(userData)
      setIsAuthenticated(true)

      // Check if user is admin
      const userIsAdmin = userData.role === 'admin'
      setIsAdmin(userIsAdmin)

      // If admin is required but user is not admin, redirect to home
      if (requireAdmin && !userIsAdmin) {
        router.push("/")
      }
    } catch (error) {
      console.error("Error parsing user data:", error)
      // Invalid data - clear and redirect to login
      localStorage.removeItem("token")
      localStorage.removeItem("user")
      router.push("/login")
    } finally {
      setIsLoading(false)
    }
  }, [router, requireAdmin])

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
    isAdmin,
    logout
  }
}

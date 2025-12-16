"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { TimezoneInfo, fetchUserTimezone, getDefaultTimezone } from '@/utils/timezone'

interface TimezoneContextType {
  timezone: string
  offsetHours: number
  offsetLabel: string
  loading: boolean
  refreshTimezone: () => Promise<void>
}

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined)

export const useTimezone = () => {
  const context = useContext(TimezoneContext)
  if (!context) {
    throw new Error('useTimezone must be used within TimezoneProvider')
  }
  return context
}

interface TimezoneProviderProps {
  children: ReactNode
}

export const TimezoneProvider: React.FC<TimezoneProviderProps> = ({ children }) => {
  const [timezoneInfo, setTimezoneInfo] = useState<TimezoneInfo>(getDefaultTimezone())
  const [loading, setLoading] = useState(true)

  const loadTimezone = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      if (!token) {
        // Not logged in, use default timezone
        setTimezoneInfo(getDefaultTimezone())
        return
      }

      const info = await fetchUserTimezone(token)
      setTimezoneInfo(info)

      console.log(`🌍 Timezone loaded: ${info.timezone} (${info.offsetLabel})`)
    } catch (error) {
      console.error('Failed to load timezone:', error)
      setTimezoneInfo(getDefaultTimezone())
    } finally {
      setLoading(false)
    }
  }

  // Load timezone on mount
  useEffect(() => {
    loadTimezone()
  }, [])

  const refreshTimezone = async () => {
    await loadTimezone()
  }

  const value: TimezoneContextType = {
    timezone: timezoneInfo.timezone,
    offsetHours: timezoneInfo.offsetHours,
    offsetLabel: timezoneInfo.offsetLabel,
    loading,
    refreshTimezone
  }

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  )
}

"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface TimezoneContextType {
  offsetHours: number
  offsetLabel: string
  toggleTimezone: () => void
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
  // Default to UTC+8, toggle to UTC+0 when clicked
  const [isUTC0, setIsUTC0] = useState(false)

  // Load preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('timezonePreference')
    if (saved === 'UTC+0') {
      setIsUTC0(true)
    }
  }, [])

  const toggleTimezone = () => {
    setIsUTC0(prev => {
      const newValue = !prev
      // Save preference
      localStorage.setItem('timezonePreference', newValue ? 'UTC+0' : 'UTC+8')
      return newValue
    })
  }

  const offsetHours = isUTC0 ? 0 : 8
  const offsetLabel = isUTC0 ? 'UTC+0' : 'UTC+8'

  const value: TimezoneContextType = {
    offsetHours,
    offsetLabel,
    toggleTimezone
  }

  return (
    <TimezoneContext.Provider value={value}>
      {children}
    </TimezoneContext.Provider>
  )
}

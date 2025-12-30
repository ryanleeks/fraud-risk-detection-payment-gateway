// Timezone utility functions for converting UTC timestamps to local time

export interface TimezoneInfo {
  timezone: string
  offset: string
  offsetHours: number
  offsetLabel: string
  country: string
  city: string
}

/**
 * Convert UTC timestamp to local time with timezone offset
 * @param utcDate - UTC timestamp string from database
 * @param offsetHours - Timezone offset in hours (e.g., 8 for UTC+8)
 * @returns Date object in local timezone
 */
export const convertToLocalTime = (utcDate: string, offsetHours: number): Date => {
  if (!utcDate) return new Date()

  const date = new Date(utcDate)
  // Add offset to convert from UTC to local time
  const localDate = new Date(date.getTime() + (offsetHours * 60 * 60 * 1000))
  return localDate
}

/**
 * Format date with timezone badge
 * @param utcDate - UTC timestamp string
 * @param offsetHours - Timezone offset in hours
 * @param offsetLabel - Timezone label (e.g., "UTC+8")
 * @param format - Format type: "full", "date", "time", or "relative"
 * @returns Formatted string with timezone badge
 */
export const formatWithTimezone = (
  utcDate: string,
  offsetHours: number,
  offsetLabel: string,
  format: 'full' | 'date' | 'time' | 'relative' = 'full'
): string => {
  if (!utcDate) return 'N/A'

  const localDate = convertToLocalTime(utcDate, offsetHours)

  let formattedDate = ''

  switch (format) {
    case 'full':
      // Example: "Dec 16, 2023 14:30"
      formattedDate = localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      break

    case 'date':
      // Example: "Dec 16, 2023"
      formattedDate = localDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
      break

    case 'time':
      // Example: "14:30"
      formattedDate = localDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      })
      break

    case 'relative':
      // Example: "2 hours ago"
      formattedDate = getRelativeTime(localDate)
      break
  }

  return formattedDate
}

/**
 * Get relative time string (e.g., "2 hours ago", "3 days ago")
 * @param date - Date object
 * @returns Relative time string
 */
export const getRelativeTime = (date: Date): string => {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffMonths = Math.floor(diffDays / 30)
  const diffYears = Math.floor(diffDays / 365)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffMonths < 12) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
  return `${diffYears} year${diffYears > 1 ? 's' : ''} ago`
}

/**
 * Fetch user's timezone from backend based on IP
 * @param token - Auth token
 * @returns Timezone information
 */
export const fetchUserTimezone = async (token: string): Promise<TimezoneInfo> => {
  try {
    const response = await fetch('/api/user/timezone', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })

    const data = await response.json()

    if (data.success) {
      return {
        timezone: data.timezone,
        offset: data.offset,
        offsetHours: data.offsetHours,
        offsetLabel: data.offsetLabel,
        country: data.country,
        city: data.city
      }
    }

    // Default to UTC+8 if fetch fails
    return getDefaultTimezone()
  } catch (error) {
    console.error('Failed to fetch timezone:', error)
    return getDefaultTimezone()
  }
}

/**
 * Get default timezone (UTC+8 - Malaysia)
 * @returns Default timezone info
 */
export const getDefaultTimezone = (): TimezoneInfo => {
  return {
    timezone: 'Asia/Kuala_Lumpur',
    offset: '+08:00',
    offsetHours: 8,
    offsetLabel: 'UTC+8',
    country: 'Local',
    city: 'Local'
  }
}

"use client"

import React from 'react'
import { useTimezone } from '@/contexts/TimezoneContext'
import { formatWithTimezone } from '@/utils/timezone'

interface TimeDisplayProps {
  utcDate: string
  format?: 'full' | 'date' | 'time' | 'relative'
  showBadge?: boolean
  className?: string
}

/**
 * TimeDisplay Component
 * Displays timestamps in user's local timezone with UTC offset badge
 * Click badge to toggle between UTC+8 and UTC+0
 */
export const TimeDisplay: React.FC<TimeDisplayProps> = ({
  utcDate,
  format = 'full',
  showBadge = true,
  className = ''
}) => {
  const { offsetHours, offsetLabel, toggleTimezone } = useTimezone()

  if (!utcDate) {
    return <span className={className}>N/A</span>
  }

  const formattedTime = formatWithTimezone(utcDate, offsetHours, offsetLabel, format)

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span>{formattedTime}</span>
      {showBadge && (
        <span
          onClick={toggleTimezone}
          className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
          title="Click to toggle timezone"
        >
          {offsetLabel}
        </span>
      )}
    </span>
  )
}

/**
 * Compact version without badge (for tight spaces)
 */
export const TimeDisplayCompact: React.FC<Omit<TimeDisplayProps, 'showBadge'>> = (props) => {
  return <TimeDisplay {...props} showBadge={false} />
}

/**
 * Time display with custom badge position
 */
export const TimeDisplayWithTooltip: React.FC<TimeDisplayProps> = ({
  utcDate,
  format = 'full',
  className = ''
}) => {
  const { offsetHours, offsetLabel, toggleTimezone } = useTimezone()

  if (!utcDate) {
    return <span className={className}>N/A</span>
  }

  const formattedTime = formatWithTimezone(utcDate, offsetHours, offsetLabel, format)

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span>{formattedTime}</span>
      <span
        onClick={toggleTimezone}
        className="inline-flex items-center rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-400 ring-1 ring-inset ring-blue-700/10 dark:ring-blue-400/30 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
        title={`Click to toggle timezone - ${offsetLabel}`}
      >
        {offsetLabel}
      </span>
    </span>
  )
}

export default TimeDisplay

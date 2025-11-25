import { RefreshCw } from "lucide-react"

interface PullToRefreshIndicatorProps {
  pullDistance: number
  isRefreshing: boolean
  threshold: number
}

export function PullToRefreshIndicator({ pullDistance, isRefreshing, threshold }: PullToRefreshIndicatorProps) {
  const progress = Math.min(pullDistance / threshold, 1)
  const rotation = progress * 360

  return (
    <div
      className="absolute top-0 left-0 right-0 flex items-center justify-center transition-opacity"
      style={{
        height: `${pullDistance}px`,
        opacity: pullDistance > 0 ? 1 : 0,
      }}
    >
      <div className="flex flex-col items-center gap-1">
        <RefreshCw
          className={`h-5 w-5 text-primary ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            transform: isRefreshing ? undefined : `rotate(${rotation}deg)`,
          }}
        />
        {pullDistance >= threshold && !isRefreshing && (
          <span className="text-xs text-primary font-medium">Release to refresh</span>
        )}
        {isRefreshing && (
          <span className="text-xs text-primary font-medium">Refreshing...</span>
        )}
      </div>
    </div>
  )
}

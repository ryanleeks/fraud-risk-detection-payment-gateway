"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart3,
  TrendingUp,
  Download,
  Target,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info
} from "lucide-react"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"
import { PullToRefreshIndicator } from "@/components/ui/pull-to-refresh-indicator"

interface ConfusionMatrix {
  truePositive: number
  falsePositive: number
  trueNegative: number
  falseNegative: number
  totalVerified: number
}

interface Metrics {
  precision: number
  recall: number
  specificity: number
  accuracy: number
  f1Score: number
  falsePositiveRate: number
  falseNegativeRate: number
  negativePredictiveValue: number
  matthewsCorrelationCoefficient: number
}

interface AcademicMetrics {
  confusionMatrix: ConfusionMatrix
  metrics: Metrics
  statistics: {
    totalLogs: number
    verifiedCount: number
    unverifiedCount: number
    actualFraudCount: number
    actualLegitimateCount: number
    verificationRate: number
  }
}

export function AcademicMetricsTab() {
  const [metrics, setMetrics] = useState<AcademicMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<"overview" | "matrix" | "errors">("overview")

  const loadMetrics = async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem("token")
      const headers = { "Authorization": `Bearer ${token}` }

      const response = await fetch("http://localhost:8080/api/fraud/academic-metrics", { headers })
      const data = await response.json()

      if (data.success) {
        setMetrics(data.metrics)
      }
    } catch (err) {
      console.error("Load metrics error:", err)
    } finally {
      setLoading(false)
    }
  }

  const exportDataset = async () => {
    try {
      const token = localStorage.getItem("token")
      const response = await fetch("http://localhost:8080/api/fraud/export-dataset", {
        headers: { "Authorization": `Bearer ${token}` }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = "fraud_detection_dataset.csv"
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
      } else {
        alert("Failed to export dataset")
      }
    } catch (err) {
      console.error("Export error:", err)
      alert("Failed to export dataset")
    }
  }

  // Pull to refresh
  const { containerRef, isPulling, pullDistance, isRefreshing, threshold } = usePullToRefresh({
    onRefresh: loadMetrics,
  })

  useEffect(() => {
    loadMetrics()
  }, [])

  const getMetricColor = (value: number, optimal: "high" | "low" = "high") => {
    if (optimal === "high") {
      if (value >= 80) return "text-green-600"
      if (value >= 60) return "text-yellow-600"
      return "text-red-600"
    } else {
      if (value <= 10) return "text-green-600"
      if (value <= 25) return "text-yellow-600"
      return "text-red-600"
    }
  }

  if (loading || !metrics) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="mt-4 text-sm text-muted-foreground">Loading academic metrics...</p>
      </div>
    )
  }

  const { confusionMatrix, metrics: performanceMetrics, statistics } = metrics

  return (
    <div ref={containerRef} className="space-y-6 pb-20 overflow-y-auto h-full">
      <PullToRefreshIndicator
        isPulling={isPulling}
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        threshold={threshold}
      />

      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold mb-2">Academic Metrics</h2>
          <p className="text-sm text-muted-foreground">
            ML evaluation metrics for fraud detection performance
          </p>
        </div>
        <Button onClick={exportDataset} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Statistics Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <BarChart3 className="h-4 w-4" />
            Total Logs
          </div>
          <div className="text-2xl font-bold">{statistics.totalLogs}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            Verified
          </div>
          <div className="text-2xl font-bold">{statistics.verifiedCount}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {statistics.verificationRate.toFixed(1)}% verified
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <XCircle className="h-4 w-4" />
            Actual Fraud
          </div>
          <div className="text-2xl font-bold text-red-600">{statistics.actualFraudCount}</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <CheckCircle2 className="h-4 w-4" />
            Legitimate
          </div>
          <div className="text-2xl font-bold text-green-600">{statistics.actualLegitimateCount}</div>
        </Card>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeView === "overview" ? "default" : "outline"}
          onClick={() => setActiveView("overview")}
          size="sm"
        >
          Performance
        </Button>
        <Button
          variant={activeView === "matrix" ? "default" : "outline"}
          onClick={() => setActiveView("matrix")}
          size="sm"
        >
          Confusion Matrix
        </Button>
      </div>

      {activeView === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Precision */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold mb-1">Precision</h3>
                  <p className="text-xs text-muted-foreground">
                    Of flagged fraud, how many were actually fraud?
                  </p>
                </div>
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className={`text-4xl font-bold ${getMetricColor(performanceMetrics.precision)}`}>
                {performanceMetrics.precision.toFixed(1)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                TP / (TP + FP) = {confusionMatrix.truePositive} / {confusionMatrix.truePositive + confusionMatrix.falsePositive}
              </div>
            </Card>

            {/* Recall */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold mb-1">Recall (Sensitivity)</h3>
                  <p className="text-xs text-muted-foreground">
                    Of all actual fraud, how many did we catch?
                  </p>
                </div>
                <Target className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className={`text-4xl font-bold ${getMetricColor(performanceMetrics.recall)}`}>
                {performanceMetrics.recall.toFixed(1)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                TP / (TP + FN) = {confusionMatrix.truePositive} / {confusionMatrix.truePositive + confusionMatrix.falseNegative}
              </div>
            </Card>

            {/* F1 Score */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold mb-1">F1 Score</h3>
                  <p className="text-xs text-muted-foreground">
                    Harmonic mean of Precision and Recall
                  </p>
                </div>
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className={`text-4xl font-bold ${getMetricColor(performanceMetrics.f1Score)}`}>
                {performanceMetrics.f1Score.toFixed(1)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                2 × (Precision × Recall) / (Precision + Recall)
              </div>
            </Card>

            {/* Accuracy */}
            <Card className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold mb-1">Accuracy</h3>
                  <p className="text-xs text-muted-foreground">
                    Overall correctness of predictions
                  </p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className={`text-4xl font-bold ${getMetricColor(performanceMetrics.accuracy)}`}>
                {performanceMetrics.accuracy.toFixed(1)}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                (TP + TN) / Total = {confusionMatrix.truePositive + confusionMatrix.trueNegative} / {confusionMatrix.totalVerified}
              </div>
            </Card>
          </div>

          {/* Additional Metrics */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Additional Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Specificity</p>
                <p className={`text-2xl font-bold ${getMetricColor(performanceMetrics.specificity)}`}>
                  {performanceMetrics.specificity.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Correct legitimate</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">False Positive Rate</p>
                <p className={`text-2xl font-bold ${getMetricColor(performanceMetrics.falsePositiveRate, "low")}`}>
                  {performanceMetrics.falsePositiveRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Incorrectly flagged</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">False Negative Rate</p>
                <p className={`text-2xl font-bold ${getMetricColor(performanceMetrics.falseNegativeRate, "low")}`}>
                  {performanceMetrics.falseNegativeRate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Missed fraud</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">NPV</p>
                <p className={`text-2xl font-bold ${getMetricColor(performanceMetrics.negativePredictiveValue)}`}>
                  {performanceMetrics.negativePredictiveValue.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">Negative predictive value</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">MCC</p>
                <p className="text-2xl font-bold">
                  {performanceMetrics.matthewsCorrelationCoefficient.toFixed(3)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Matthews correlation</p>
              </div>
            </div>
          </Card>

          {/* Interpretation Guide */}
          <Card className="p-6 bg-blue-50/50 dark:bg-blue-950/20">
            <div className="flex gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold">Metric Interpretation:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li><strong>Precision:</strong> High precision = Few false alarms (good for user experience)</li>
                  <li><strong>Recall:</strong> High recall = Catch most fraud (good for security)</li>
                  <li><strong>F1 Score:</strong> Balance between precision and recall (80%+ is excellent)</li>
                  <li><strong>Specificity:</strong> How well we identify legitimate transactions</li>
                  <li><strong>MCC:</strong> -1 to +1 scale, higher is better (accounts for class imbalance)</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {activeView === "matrix" && (
        <div className="space-y-6">
          {/* Confusion Matrix Visualization */}
          <Card className="p-6">
            <h3 className="font-semibold mb-6 text-center">Confusion Matrix</h3>

            <div className="max-w-lg mx-auto">
              {/* Column Headers */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div></div>
                <div className="text-center text-sm font-semibold">Predicted Fraud</div>
                <div className="text-center text-sm font-semibold">Predicted Legit</div>
              </div>

              {/* Actual Fraud Row */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="flex items-center justify-end pr-4 text-sm font-semibold">
                  Actual Fraud
                </div>
                <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-500">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">True Positive</div>
                    <div className="text-3xl font-bold text-green-600">
                      {confusionMatrix.truePositive}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Correct</div>
                  </div>
                </Card>
                <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-500">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">False Negative</div>
                    <div className="text-3xl font-bold text-red-600">
                      {confusionMatrix.falseNegative}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Missed</div>
                  </div>
                </Card>
              </div>

              {/* Actual Legitimate Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="flex items-center justify-end pr-4 text-sm font-semibold">
                  Actual Legit
                </div>
                <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-500">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">False Positive</div>
                    <div className="text-3xl font-bold text-red-600">
                      {confusionMatrix.falsePositive}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">False alarm</div>
                  </div>
                </Card>
                <Card className="p-6 bg-green-50 dark:bg-green-950/20 border-green-500">
                  <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">True Negative</div>
                    <div className="text-3xl font-bold text-green-600">
                      {confusionMatrix.trueNegative}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Correct</div>
                  </div>
                </Card>
              </div>
            </div>
          </Card>

          {/* Matrix Explanation */}
          <Card className="p-6">
            <h3 className="font-semibold mb-4">Understanding the Matrix</h3>
            <div className="space-y-3 text-sm">
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <strong>True Positive (TP):</strong> Correctly identified fraud. AI flagged it, and it was actually fraud.
                </div>
              </div>
              <div className="flex gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <strong>False Positive (FP):</strong> Incorrectly flagged legitimate as fraud. False alarm.
                </div>
              </div>
              <div className="flex gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div>
                  <strong>True Negative (TN):</strong> Correctly allowed legitimate transaction.
                </div>
              </div>
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <strong>False Negative (FN):</strong> Missed fraud. AI allowed it, but it was actually fraud.
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

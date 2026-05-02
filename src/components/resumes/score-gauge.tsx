"use client"

import { useEffect, useState } from "react"

interface ScoreGaugeProps {
  score: number
  size?: number
  strokeWidth?: number
}

export function ScoreGauge({ score, size = 140, strokeWidth = 10 }: ScoreGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (animatedScore / 100) * circumference

  const color = score >= 70 ? "#16a34a" : score >= 40 ? "#ca8a04" : "#dc2626"
  const bgColor = score >= 70 ? "#dcfce7" : score >= 40 ? "#fef9c3" : "#fecaca"

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100)
    return () => clearTimeout(timer)
  }, [score])

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-3xl font-bold" style={{ color }}>
          {animatedScore}
        </span>
        <span className="text-xs text-gray-500">分</span>
      </div>
    </div>
  )
}

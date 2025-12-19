import { useState, useRef, type MouseEvent } from 'react'

interface PriceChartProps {
  data: number[]
  entryPrice?: number | null
  positionType?: 'LONG' | 'SHORT' | null
}

export default function PriceChart({ data, entryPrice, positionType }: PriceChartProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; price: number; index: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const height = 300
  const width = 800
  const rightPadding = 100 // Space for price labels on the right

  if (data.length < 2) {
    return <div className="h-[300px] flex items-center justify-center text-gray-400">Loading chart...</div>
  }

  // Calculate min/max including entry price if provided
  let allPrices = [...data]
  if (entryPrice) {
    allPrices.push(entryPrice)
  }

  const dataMin = Math.min(...allPrices)
  const dataMax = Math.max(...allPrices)
  const dataRange = dataMax - dataMin

  // Add 10% padding to show all data comfortably
  const padding10Percent = Math.max(dataRange * 0.1, 2) // At least $2 padding
  const min = dataMin - padding10Percent
  const max = dataMax + padding10Percent
  const range = max - min

  // Add padding to prevent clipping
  const padding = 20
  const leftPadding = 10 // Small left padding

  // Generate Y-axis labels (5 levels)
  const yAxisLevels = 5
  const yAxisLabels = Array.from({ length: yAxisLevels }, (_, i) => {
    const price = max - (range * i / (yAxisLevels - 1))
    const y = padding + ((max - price) / range) * (height - padding * 2)
    return { price, y }
  })

  // Calculate entry price Y position if provided
  const entryPriceY = entryPrice ? padding + ((max - entryPrice) / range) * (height - padding * 2) : null

  // Convert data to points
  const points = data.map((price, i) => {
    const x = leftPadding + (i / (data.length - 1)) * (width - leftPadding - rightPadding)
    const y = padding + ((max - price) / range) * (height - padding * 2)
    return { x, y, price, index: i }
  })

  // Create path data for line
  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ')

  // Determine color based on position
  let strokeColor: string
  let fillColor: string

  if (!entryPrice || !positionType) {
    // No position - use blue
    strokeColor = '#0000FF'
    fillColor = 'rgba(0, 0, 255, 0.1)'
  } else {
    // Has position - color based on entry price
    const currentPrice = data[data.length - 1]
    const isInProfit = positionType === 'LONG'
      ? currentPrice >= entryPrice
      : currentPrice <= entryPrice

    strokeColor = isInProfit ? '#10b981' : '#ef4444'
    fillColor = isInProfit ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'
  }

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const mouseX = ((e.clientX - rect.left) / rect.width) * width

    // Find closest point
    const closest = points.reduce((prev, curr) => {
      return Math.abs(curr.x - mouseX) < Math.abs(prev.x - mouseX) ? curr : prev
    })

    setHoveredPoint(closest)
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  return (
    <div className="w-full h-[300px] relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Y-axis grid lines and labels */}
        {yAxisLabels.map((label, i) => (
          <g key={i}>
            {/* Grid line */}
            <line
              x1={leftPadding}
              y1={label.y}
              x2={width - rightPadding}
              y2={label.y}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
            {/* Price label background box - outside chart area */}
            <rect
              x={width - rightPadding + 8}
              y={label.y - 10}
              width="85"
              height="20"
              fill="rgba(40, 45, 55, 0.98)"
              rx="3"
            />
            {/* Price label text */}
            <text
              x={width - rightPadding + 50.5}
              y={label.y + 3}
              fill="rgba(200, 200, 200, 1)"
              fontSize="11"
              fontWeight="400"
              fontFamily="'SF Pro Display', -apple-system, system-ui, sans-serif"
              textAnchor="middle"
              letterSpacing="0.2"
            >
              {label.price.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Fill area */}
        <path
          d={`${pathData} L ${width - rightPadding},${height - padding} L ${leftPadding},${height - padding} Z`}
          fill={fillColor}
        />

        {/* Line */}
        <path
          d={pathData}
          fill="none"
          stroke={strokeColor}
          strokeWidth="3"
          vectorEffect="non-scaling-stroke"
        />

        {/* Entry price line */}
        {entryPriceY !== null && (
          <>
            {/* Dashed horizontal line */}
            <line
              x1={leftPadding}
              y1={entryPriceY}
              x2={width - rightPadding}
              y2={entryPriceY}
              stroke="#fbbf24"
              strokeWidth="2"
              strokeDasharray="8 4"
              vectorEffect="non-scaling-stroke"
            />
            {/* Entry price label */}
            <rect
              x={leftPadding + 5}
              y={entryPriceY - 32}
              width="95"
              height="28"
              fill="rgba(251, 191, 36, 0.25)"
              stroke="#fbbf24"
              strokeWidth="1.5"
              rx="4"
            />
            <text
              x={leftPadding + 52.5}
              y={entryPriceY - 11}
              fill="#fbbf24"
              fontSize="13"
              fontWeight="700"
              fontFamily="Arial, sans-serif"
              textAnchor="middle"
            >
              Entry ${entryPrice?.toFixed(2)}
            </text>
          </>
        )}

        {/* Hover indicator */}
        {hoveredPoint && (
          <>
            {/* Vertical line */}
            <line
              x1={hoveredPoint.x}
              y1={padding}
              x2={hoveredPoint.x}
              y2={height - padding}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            {/* Horizontal line */}
            <line
              x1={leftPadding}
              y1={hoveredPoint.y}
              x2={width - rightPadding}
              y2={hoveredPoint.y}
              stroke="rgba(255, 255, 255, 0.3)"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
            {/* Point */}
            <circle
              cx={hoveredPoint.x}
              cy={hoveredPoint.y}
              r="5"
              fill={strokeColor}
              stroke="white"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            {/* Tooltip background */}
            <rect
              x={hoveredPoint.x - 45}
              y={hoveredPoint.y - 35}
              width="90"
              height="25"
              fill="rgba(15, 17, 23, 0.95)"
              stroke="rgba(255, 255, 255, 0.2)"
              strokeWidth="1"
              rx="6"
            />
            {/* Tooltip text */}
            <text
              x={hoveredPoint.x}
              y={hoveredPoint.y - 18}
              fill="white"
              fontSize="14"
              fontWeight="500"
              fontFamily="Helvetica, Arial, sans-serif"
              textAnchor="middle"
              letterSpacing="1"
            >
              ${hoveredPoint.price.toFixed(2)}
            </text>
          </>
        )}
      </svg>
    </div>
  )
}

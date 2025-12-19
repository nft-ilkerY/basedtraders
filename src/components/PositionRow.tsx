import type { Position } from '../lib/gameState'

interface PositionRowProps {
  position: Position
  onClose: (id: string) => void
}

export default function PositionRow({ position, onClose }: PositionRowProps) {
  // Calculate how close current price is to liquidation price (%)
  const liquidationDistance = Math.abs(
    ((position.currentPrice - position.liquidationPrice) / position.liquidationPrice) * 100
  )

  // Check if price is moving towards liquidation
  const isApproachingLiquidation = () => {
    if (position.type === 'LONG') {
      // LONG: approaching liq if price is below entry (moving down towards liq)
      return position.currentPrice < position.entryPrice
    } else {
      // SHORT: approaching liq if price is above entry (moving up towards liq)
      return position.currentPrice > position.entryPrice
    }
  }

  const getWarningLevel = () => {
    // If far from liquidation, always safe
    if (liquidationDistance > 10) return 'safe'

    // Warning levels based on distance
    if (liquidationDistance > 5) return 'warning'
    if (liquidationDistance > 2) return 'danger'

    // Critical (blinking) only when:
    // 1. Very close to liquidation (< 2%) AND
    // 2. Price is approaching liquidation (in loss direction)
    if (liquidationDistance <= 2 && isApproachingLiquidation()) {
      return 'critical'
    }

    // Close to liq but not approaching (in profit) = danger level
    return 'danger'
  }

  const warningLevel = getWarningLevel()

  const borderColor = {
    safe: 'border-l-gray-600',
    warning: 'border-l-yellow-500',
    danger: 'border-l-orange-500',
    critical: 'border-l-red-500',
  }[warningLevel]

  return (
    <div
      className={`bg-[#0a0c12] rounded-xl p-3 sm:p-4 border-l-4 ${borderColor} ${
        warningLevel === 'critical' ? 'animate-pulse' : ''
      }`}
    >
      {/* Two-row layout */}
      <div className="space-y-2">
        {/* Row 1: Token, Type, Leverage, Entry, Current Price, P&L */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            {/* Token Symbol */}
            <div className="bg-[#0000FF]/20 px-2 py-1 rounded text-xs font-bold text-[#4444FF]">
              {position.token}
            </div>

            {/* Type & Leverage */}
            <div className="flex items-center gap-1">
              <span
                className={`text-sm font-bold ${
                  position.type === 'LONG' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {position.type}
              </span>
              <span className="text-xs text-gray-500">{position.leverage}x</span>
            </div>

            {/* Prices */}
            <div className="flex gap-2 sm:gap-3 text-xs">
              <div>
                <span className="text-gray-500">Entry: </span>
                <span className="font-mono">${position.entryPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500">Mark: </span>
                <span className="font-mono">${position.currentPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* P&L */}
          <div className={`flex-shrink-0 text-right ${
              position.pnl >= 0 ? 'text-green-400' : 'text-red-400'
            }`}
          >
            <div className="text-sm sm:text-base font-bold whitespace-nowrap">
              {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
            </div>
            <div className="text-xs whitespace-nowrap">
              {position.pnlPercent >= 0 ? '+' : ''}
              {position.pnlPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Row 2: Margin, Size, Liquidation Price, Close Button */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-2 sm:gap-3 text-xs flex-wrap">
            <div>
              <span className="text-gray-500">Margin: </span>
              <span className="font-mono text-blue-400">${position.collateral.toFixed(2)}</span>
            </div>
            <div>
              <span className="text-gray-500">Size: </span>
              <span className="font-mono">${position.size.toFixed(0)}</span>
            </div>
            <div>
              <span className="text-gray-500">Liq: </span>
              <span className="font-mono text-red-400">${position.liquidationPrice.toFixed(2)}</span>
            </div>
          </div>

          {/* Close Button */}
          <div className="flex-shrink-0">
            {!position.isLiquidated ? (
              <button
                onClick={() => onClose(position.id)}
                className="bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors border border-gray-600 whitespace-nowrap"
              >
                Close
              </button>
            ) : (
              <span className="text-red-500 text-xs font-bold">LIQUIDATED</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

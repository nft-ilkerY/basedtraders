import { useState } from 'react'

interface TradingControlsProps {
  playerCash: number
  playerTotalValue: number
  maxLeverage?: number
  onOpenPosition: (amount: number, leverage: number, type: 'LONG' | 'SHORT') => void
}

export default function TradingControls({
  playerCash,
  playerTotalValue,
  maxLeverage = 10,
  onOpenPosition,
}: TradingControlsProps) {
  const [amount, setAmount] = useState(0)
  const [leverage, setLeverage] = useState(Math.min(5, maxLeverage))

  // Calculate max collateral (80% of total portfolio)
  const maxCollateral = Math.min(playerCash, playerTotalValue * 0.80)
  const positionSize = amount * leverage

  // Maintenance margin calculation (same as gameState.ts)
  const getMaintenanceMarginRate = (lev: number): number => {
    if (lev <= 5) return 0.005
    if (lev <= 10) return 0.01
    if (lev <= 20) return 0.02
    if (lev <= 50) return 0.025
    if (lev <= 75) return 0.03
    return 0.004 // Must be < 1/leverage to prevent instant liquidation
  }

  const maintenanceMargin = getMaintenanceMarginRate(leverage)
  const initialMarginRate = 1 / leverage
  const liqDistance = (initialMarginRate - maintenanceMargin) * 100

  const handleOpenPosition = (type: 'LONG' | 'SHORT') => {
    if (amount <= 0 || amount > maxCollateral) {
      alert(`Invalid amount. Max allowed: $${maxCollateral.toFixed(2)}`)
      return
    }

    onOpenPosition(amount, leverage, type)

    // Reset to 0 after opening position
    setAmount(0)
    setLeverage(Math.min(5, maxLeverage))
  }

  // Ensure amountPercent is clamped between 0 and 100
  const amountPercent = maxCollateral > 0 ? Math.max(0, Math.min(100, (amount / maxCollateral) * 100)) : 0

  return (
    <div className="space-y-4">
      {/* Amount Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-gray-400">Position Amount</label>
          <span className="text-lg font-bold text-white">${amount.toFixed(2)}</span>
        </div>
        <div className="relative" style={{ marginTop: '-1px' }}>
          <div className="absolute w-full h-2 bg-gray-700 rounded-lg pointer-events-none">
            <div
              className="h-full bg-[#0000FF] rounded-lg"
              style={{ width: `${amountPercent}%`, transition: 'none' }}
            />
          </div>
          <input
            type="range"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={0}
            max={maxCollateral}
            step={1}
            className="relative w-full slider"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>$0</span>
          <span>Max: ${maxCollateral.toFixed(2)} (80%)</span>
        </div>
      </div>

      {/* Leverage Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-gray-400">Leverage</label>
          <span className="text-lg font-bold text-white">{leverage}×</span>
        </div>
        <div className="relative" style={{ marginTop: '-1px' }}>
          <div className="absolute w-full h-2 bg-gray-700 rounded-lg pointer-events-none">
            <div
              className="h-full bg-[#0000FF] rounded-lg"
              style={{ width: `${((leverage - 1) / (maxLeverage - 1)) * 100}%`, transition: 'none' }}
            />
          </div>
          <input
            type="range"
            value={leverage}
            onChange={(e) => setLeverage(Number(e.target.value))}
            min={1}
            max={maxLeverage}
            step={1}
            className="relative w-full slider"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>1×</span>
          <span className="text-[#0000FF] font-semibold">Max: {maxLeverage}×</span>
        </div>
      </div>

      {/* Position Details */}
      <div className="bg-[#0a0c12] rounded-xl p-4 space-y-2 text-sm border border-gray-800">
        <div className="flex justify-between">
          <span className="text-gray-400">Collateral:</span>
          <span className="font-semibold">${amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between border-t border-gray-800 pt-2">
          <span className="text-gray-400">Position Size:</span>
          <span className="font-bold text-lg">${positionSize.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Liquidation at:</span>
          <span className="font-semibold text-red-400">
            ±{liqDistance.toFixed(2)}% move
          </span>
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>Maintenance Margin:</span>
          <span>{(maintenanceMargin * 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between text-gray-500 text-xs pt-2 border-t border-gray-800">
          <span>5% fee on profit only</span>
        </div>
      </div>

      {/* Long/Short Buttons */}
      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          onClick={() => handleOpenPosition('LONG')}
          disabled={amount <= 0 || amount > playerCash}
          className="bg-green-500 hover:bg-green-600 disabled:bg-white disabled:bg-opacity-10 disabled:cursor-not-allowed text-white font-bold py-4 rounded transition-all text-lg"
        >
          LONG
        </button>
        <button
          onClick={() => handleOpenPosition('SHORT')}
          disabled={amount <= 0 || amount > playerCash}
          className="bg-red-500 hover:bg-red-600 disabled:bg-white disabled:bg-opacity-10 disabled:cursor-not-allowed text-white font-bold py-4 rounded transition-all text-lg"
        >
          SHORT
        </button>
      </div>
    </div>
  )
}

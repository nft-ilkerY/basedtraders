export interface Position {
  id: string
  type: 'LONG' | 'SHORT'
  entryPrice: number
  currentPrice: number
  leverage: number
  size: number // Position size in USD
  collateral: number // Initial margin
  pnl: number // Profit/Loss
  pnlPercent: number
  liquidationPrice: number
  isLiquidated: boolean
  openedAt: number
  token: string // Token symbol (e.g., "BATR")
  lastFundingUpdate: number // Timestamp of last funding fee charge
}

export interface PlayerState {
  fid: number
  cash: number
  positions: Position[]
  totalValue: number
  pnl: number
  pnlPercent: number
}

const INITIAL_CASH = 250
const BASE_TRADING_FEE = 0.002 // 0.2% base fee
const PROFIT_FEE = 0.05 // 5% fee on profit only
const API_BASE = '/api'
const MAX_POSITION_SIZE_PERCENT = 0.80 // 80% max of total portfolio
const FUNDING_RATE_PER_HOUR = 0.0005 // 0.05% per hour
const FUNDING_UPDATE_INTERVAL = 3600000 // 1 hour in milliseconds

// Progressive fee rates based on balance
const getFeeRate = (totalValue: number): number => {
  if (totalValue >= 10000) return 0.005 // 0.5% for $10k+
  if (totalValue >= 5000) return 0.003 // 0.3% for $5k+
  return BASE_TRADING_FEE // 0.2% base
}

// Maintenance margin rates based on leverage (similar to Binance)
// Higher leverage = higher maintenance margin requirement
const getMaintenanceMarginRate = (leverage: number): number => {
  if (leverage <= 5) return 0.005   // 0.5% for 1-5x
  if (leverage <= 10) return 0.01   // 1% for 6-10x
  if (leverage <= 20) return 0.02   // 2% for 11-20x
  if (leverage <= 50) return 0.025  // 2.5% for 21-50x
  if (leverage <= 75) return 0.03   // 3% for 51-75x
  return 0.004 // 0.4% for 76-100x (must be < 1/leverage to prevent instant liquidation)
}

// Calculate liquidation price with maintenance margin
const calculateLiquidationPrice = (
  entryPrice: number,
  leverage: number,
  type: 'LONG' | 'SHORT'
): number => {
  const maintenanceMargin = getMaintenanceMarginRate(leverage)
  const initialMarginRate = 1 / leverage

  if (type === 'LONG') {
    // LONG: liq_price = entry_price * (1 - initial_margin + maintenance_margin)
    return entryPrice * (1 - initialMarginRate + maintenanceMargin)
  } else {
    // SHORT: liq_price = entry_price * (1 + initial_margin - maintenance_margin)
    return entryPrice * (1 + initialMarginRate - maintenanceMargin)
  }
}

// Store player states in memory keyed by FID
const playerStates = new Map<number, PlayerState>()

export class GameState {
  private listeners: Set<(state: PlayerState) => void> = new Set()

  // Initialize player or get existing state
  async initPlayer(fid: number): Promise<PlayerState> {
    if (!playerStates.has(fid)) {
      // Fetch from database
      try {
        const [playerResponse, positionsResponse, priceResponse] = await Promise.all([
          fetch(`${API_BASE}/player/${fid}`),
          fetch(`${API_BASE}/positions/${fid}/open`),
          fetch(`${API_BASE}/price`)
        ])

        const data = await playerResponse.json()
        const dbPositions = await positionsResponse.json()
        const priceData = await priceResponse.json()
        const currentPrice = priceData.price

        if (!data) {
          const initialState: PlayerState = {
            fid,
            cash: INITIAL_CASH,
            positions: [],
            totalValue: INITIAL_CASH,
            pnl: 0,
            pnlPercent: 0,
          }
          playerStates.set(fid, initialState)
          return initialState
        }

        // Convert database positions to game state positions
        const positions: Position[] = Array.isArray(dbPositions) ? dbPositions.map((dbPos: any) => {
          // Note: We're using BATR price for all positions here during init
          // This will be corrected by the per-token price updates via WebSocket
          const priceChange = currentPrice - dbPos.entry_price
          const priceChangePercent = priceChange / dbPos.entry_price

          let pnl: number
          if (dbPos.type === 'LONG') {
            pnl = dbPos.size * priceChangePercent
          } else {
            pnl = dbPos.size * -priceChangePercent
          }

          const pnlPercent = (pnl / dbPos.collateral) * 100
          const liquidationPrice = calculateLiquidationPrice(
            dbPos.entry_price,
            dbPos.leverage,
            dbPos.type
          )

          const isLiquidated = dbPos.type === 'LONG'
            ? currentPrice <= liquidationPrice
            : currentPrice >= liquidationPrice

          return {
            id: dbPos.id,
            type: dbPos.type,
            entryPrice: dbPos.entry_price,
            currentPrice: currentPrice,
            leverage: dbPos.leverage,
            size: dbPos.size,
            collateral: dbPos.collateral,
            pnl: isLiquidated ? -dbPos.collateral : pnl,
            pnlPercent: isLiquidated ? -100 : pnlPercent,
            liquidationPrice: liquidationPrice,
            isLiquidated: isLiquidated,
            openedAt: dbPos.opened_at,
            token: dbPos.token_symbol || 'BATR', // Use token from database
            lastFundingUpdate: dbPos.opened_at,
          } as Position
        }) : []

        const positionsValue = positions
          .filter(p => !p.isLiquidated)
          .reduce((sum, p) => sum + p.collateral + p.pnl, 0)

        const totalValue = data.cash + positionsValue
        const pnl = totalValue - INITIAL_CASH
        const pnlPercent = (pnl / INITIAL_CASH) * 100

        const initialState: PlayerState = {
          fid,
          cash: data.cash || INITIAL_CASH,
          positions: positions,
          totalValue: totalValue,
          pnl: pnl,
          pnlPercent: pnlPercent,
        }
        playerStates.set(fid, initialState)
        return initialState
      } catch (error) {
        const initialState: PlayerState = {
          fid,
          cash: INITIAL_CASH,
          positions: [],
          totalValue: INITIAL_CASH,
          pnl: 0,
          pnlPercent: 0,
        }
        playerStates.set(fid, initialState)
        return initialState
      }
    }
    return playerStates.get(fid)!
  }

  getPlayerState(fid: number): PlayerState | undefined {
    return playerStates.get(fid)
  }

  async openPosition(
    fid: number,
    amount: number,
    leverage: number,
    type: 'LONG' | 'SHORT',
    currentPrice: number,
    token: string = 'BATR' // Default token for now
  ): Promise<{ success: boolean; error?: string }> {
    const state = playerStates.get(fid)
    if (!state) {
      return { success: false, error: 'Player not initialized' }
    }

    // Check if already have position for this token
    const existingTokenPosition = state.positions.find(p => p.token === token && !p.isLiquidated)
    if (existingTokenPosition) {
      return { success: false, error: `Already have open position for ${token}` }
    }

    if (amount > state.cash) {
      return { success: false, error: 'Insufficient funds' }
    }

    // Check max collateral usage (80% of total portfolio)
    const maxCollateral = state.totalValue * MAX_POSITION_SIZE_PERCENT

    if (amount > maxCollateral) {
      return {
        success: false,
        error: `Max collateral allowed: $${maxCollateral.toFixed(2)} (80% of portfolio)`
      }
    }

    // Calculate progressive fee based on current balance
    const feeRate = getFeeRate(state.totalValue)
    const tradingFee = amount * feeRate
    const amountAfterFee = amount - tradingFee
    const size = amountAfterFee * leverage
    const liquidationPrice = calculateLiquidationPrice(currentPrice, leverage, type)

    const position: Position = {
      id: `pos_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      entryPrice: currentPrice,
      currentPrice,
      leverage,
      size,
      collateral: amountAfterFee, // Use amount after fee
      pnl: 0,
      pnlPercent: 0,
      liquidationPrice,
      isLiquidated: false,
      openedAt: Date.now(),
      token,
      lastFundingUpdate: Date.now(),
    }

    state.cash -= amount // Deduct full amount including fee
    state.positions.push(position)

    this.updateTotalValue(state)
    this.notifyListeners(state)

    // Save to database
    try {
      await fetch(`${API_BASE}/position/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: position.id,
          player_fid: fid,
          token_symbol: token,
          type: position.type,
          entry_price: position.entryPrice,
          leverage: position.leverage,
          size: position.size,
          collateral: position.collateral,
        }),
      })

      // Update player cash in database
      await fetch(`${API_BASE}/player/${fid}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cash: state.cash,
          high_score: state.totalValue > INITIAL_CASH ? state.totalValue : INITIAL_CASH,
        }),
      })
    } catch (error) {
      // Continue without DB
    }

    return { success: true }
  }

  async closePosition(fid: number, positionId: string): Promise<{ success: boolean; error?: string; profit?: number; leverage?: number; token?: string; profitPercent?: number }> {
    const state = playerStates.get(fid)
    if (!state) {
      return { success: false, error: 'Player not initialized' }
    }

    const position = state.positions.find(p => p.id === positionId)
    if (!position) {
      return { success: false, error: 'Position not found' }
    }

    if (position.isLiquidated) {
      return { success: false, error: 'Position already liquidated' }
    }

    // Calculate closing fee (progressive based on balance)
    const feeRate = getFeeRate(state.totalValue)
    const closingFee = position.collateral * feeRate

    // Calculate fee - only on profit (5% profit fee)
    let finalPnl = position.pnl
    if (position.pnl > 0) {
      const profitFee = position.pnl * PROFIT_FEE
      finalPnl = position.pnl - profitFee
    }

    // Deduct closing fee from final return
    const totalReturn = position.collateral + finalPnl - closingFee

    // Return collateral + PNL (after fees) to cash
    state.cash += totalReturn

    // Store position data before removing
    const closedPosition = {
      profit: finalPnl,
      leverage: position.leverage,
      token: position.token,
      profitPercent: position.pnlPercent
    }

    // Remove position
    state.positions = state.positions.filter(p => p.id !== positionId)

    this.updateTotalValue(state)
    this.notifyListeners(state)

    // Save to database
    try {
      await fetch(`${API_BASE}/position/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: position.id,
          close_price: position.currentPrice,
          pnl: finalPnl,
          is_liquidated: false,
        }),
      })

      // Update player cash and high score
      await fetch(`${API_BASE}/player/${fid}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cash: state.cash,
          high_score: Math.max(state.totalValue, state.totalValue > INITIAL_CASH ? state.totalValue : INITIAL_CASH),
        }),
      })
    } catch (error) {
      // Continue without DB
    }

    return {
      success: true,
      ...closedPosition
    }
  }

  updatePriceForToken(fid: number, tokenSymbol: string, currentPrice: number) {
    const state = playerStates.get(fid)
    if (!state) return

    const now = Date.now()

    // Update only positions for this specific token
    state.positions = state.positions.map(position => {
      // Skip positions for other tokens
      if (position.token !== tokenSymbol) {
        return position
      }

      const priceChange = currentPrice - position.entryPrice
      const priceChangePercent = priceChange / position.entryPrice

      // Calculate PNL based on position type
      let pnl: number
      if (position.type === 'LONG') {
        pnl = position.size * priceChangePercent
      } else {
        pnl = position.size * -priceChangePercent
      }

      // Apply funding rate (hourly fee on position size)
      const timeSinceLastFunding = now - position.lastFundingUpdate
      if (timeSinceLastFunding >= FUNDING_UPDATE_INTERVAL) {
        const hoursElapsed = Math.floor(timeSinceLastFunding / FUNDING_UPDATE_INTERVAL)
        const fundingFee = position.size * FUNDING_RATE_PER_HOUR * hoursElapsed
        pnl -= fundingFee // Deduct funding fee from PNL

        // Update last funding time
        position.lastFundingUpdate = now
      }

      const pnlPercent = (pnl / position.collateral) * 100

      // Check liquidation
      const isLiquidated =
        position.type === 'LONG'
          ? currentPrice <= position.liquidationPrice
          : currentPrice >= position.liquidationPrice

      if (isLiquidated && !position.isLiquidated) {
        // Position just got liquidated
        return {
          ...position,
          currentPrice,
          pnl: -position.collateral, // Lost all collateral
          pnlPercent: -100,
          isLiquidated: true,
        }
      }

      return {
        ...position,
        currentPrice,
        pnl,
        pnlPercent,
      }
    })

    // Remove liquidated positions after a delay (for UI notification)
    const liquidatedPositions = state.positions.filter(p => p.isLiquidated)
    if (liquidatedPositions.length > 0) {
      // Save liquidated positions to database
      liquidatedPositions.forEach(async (position) => {
        try {
          await fetch(`${API_BASE}/position/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: position.id,
              close_price: position.currentPrice,
              pnl: -position.collateral,
              is_liquidated: true,
            }),
          })

          // Update player cash in database
          await fetch(`${API_BASE}/player/${fid}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cash: state.cash,
              high_score: Math.max(state.totalValue, INITIAL_CASH),
            }),
          })
        } catch (error) {
          // Continue without DB
        }
      })

      setTimeout(() => {
        const currentState = playerStates.get(fid)
        if (currentState) {
          currentState.positions = currentState.positions.filter(p => !p.isLiquidated)
          this.updateTotalValue(currentState)
          this.notifyListeners(currentState)
        }
      }, 3000) // Remove after 3 seconds
    }

    this.updateTotalValue(state)
    this.notifyListeners(state)
  }

  private updateTotalValue(state: PlayerState) {
    const positionsValue = state.positions
      .filter(p => !p.isLiquidated)
      .reduce((sum, p) => sum + p.collateral + p.pnl, 0)

    state.totalValue = state.cash + positionsValue
    state.pnl = state.totalValue - INITIAL_CASH
    state.pnlPercent = (state.pnl / INITIAL_CASH) * 100
  }

  subscribe(callback: (state: PlayerState) => void) {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notifyListeners(state: PlayerState) {
    this.listeners.forEach(callback => callback(state))
  }
}

export const gameState = new GameState()

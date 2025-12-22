import { useEffect, useState } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import { priceEngine } from '../lib/priceEngine'
import { gameState } from '../lib/gameState'
import type { PlayerState } from '../lib/gameState'
import PriceChart from './PriceChart'
import PositionRow from './PositionRow'
import TradingControls from './TradingControls'

interface Token {
  id: number
  symbol: string
  name: string
  current_price: number
  is_active: boolean
  is_real_crypto?: number
  logo_url?: string
  max_leverage?: number
}

interface TradingInterfaceProps {
  profile: any
  isLoggedIn: boolean
}

export default function TradingInterface({ profile, isLoggedIn }: TradingInterfaceProps) {
  const [currentPrice, setCurrentPrice] = useState(100)
  const [priceHistory, setPriceHistory] = useState<number[]>([])
  const [playerState, setPlayerState] = useState<PlayerState | null>(null)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [playerLoading, setPlayerLoading] = useState(false)
  const [tokens, setTokens] = useState<Token[]>([])
  const [selectedToken, setSelectedToken] = useState<Token | null>(null)
  const [tokenSelectorOpen, setTokenSelectorOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isSharing, setIsSharing] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [imageGenerated, setImageGenerated] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null)
  const [generatedImageBlob, setGeneratedImageBlob] = useState<Blob | null>(null)
  const [shareModal, setShareModal] = useState<{
    show: boolean
    profit: number
    leverage: number
    token: string
    profitPercent: number
  } | null>(null)

  // Load tokens on mount
  useEffect(() => {
    const loadTokens = async () => {
      try {
        const response = await fetch('https://basedtraders.onrender.com/api/tokens')
        const data = await response.json()
        setTokens(data)
        if (data.length > 0) {
          // Default to BTC if exists, otherwise first token
          const btcToken = data.find((t: Token) => t.symbol === 'BTC')
          setSelectedToken(btcToken || data[0])
        }
      } catch (error) {
        console.error('Failed to load tokens:', error)
      }
    }
    loadTokens()
  }, [])

  // Initialize price history when token changes
  useEffect(() => {
    if (!selectedToken) return

    // Start price engine first
    priceEngine.start()

    // Track if we've initialized to unsubscribe after first price
    let initialized = false
    let unsubscribeFunc: (() => void) | null = null

    // Subscribe to get the first real price, then create history
    unsubscribeFunc = priceEngine.subscribe(selectedToken.symbol, (firstRealPrice) => {
      if (initialized) return // Only run once

      setCurrentPrice(firstRealPrice)

      // Create realistic price history working backwards from current price
      // This simulates past price movements
      const history: number[] = []
      let price = firstRealPrice

      // Work backwards to create 120 historical points
      for (let i = 119; i >= 0; i--) {
        history.unshift(price)

        // Add realistic backward variation (±0.05% to ±0.2% per point)
        const variation = (Math.random() - 0.5) * (Math.random() * 0.003 + 0.001)
        price = price * (1 + variation)
      }

      setPriceHistory(history)
      setHistoryLoaded(true)
      initialized = true

      // Unsubscribe after getting first price
      if (unsubscribeFunc) {
        unsubscribeFunc()
      }
    })

    // Cleanup on unmount or token change
    return () => {
      if (unsubscribeFunc && !initialized) {
        unsubscribeFunc()
      }
    }
  }, [selectedToken])

  // Initialize player when Farcaster connects
  useEffect(() => {
    if (isLoggedIn && profile?.fid) {
      console.log('🔄 [TradingInterface] Player login detected, FID:', profile.fid)
      setPlayerLoading(true)

      fetch('https://basedtraders.onrender.com/api/player/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: profile.username,
          fid: profile.fid,
          displayName: profile.displayName,
          pfpUrl: profile.pfpUrl,
        }),
      })
      .then(response => {
        console.log('📡 [TradingInterface] Player create response:', response.status, response.ok)
        return response.json()
      })
      .then((createResult) => {
        console.log('✅ [TradingInterface] Player create result:', createResult)
        if (profile.fid) {
          console.log('🎮 [TradingInterface] Calling gameState.initPlayer with FID:', profile.fid)
          return gameState.initPlayer(profile.fid)
        }
      })
      .then(state => {
        console.log('🎯 [TradingInterface] GameState initialized:', state)
        if (state) {
          setPlayerState(state)
        }
        setPlayerLoading(false)
      })
      .catch((error) => {
        console.error('❌ [TradingInterface] Error during player initialization:', error)
        setPlayerLoading(false)
      })
    }
  }, [isLoggedIn, profile?.fid])

  // Subscribe to price updates for selected token (for chart display)
  useEffect(() => {
    if (!historyLoaded || !selectedToken) return

    const unsubscribe = priceEngine.subscribe(selectedToken.symbol, (price) => {
      setCurrentPrice(price)
      setPriceHistory((prev) => {
        // Only add if different from last price
        if (prev.length === 0 || prev[prev.length - 1] !== price) {
          return [...prev.slice(-119), price] // Keep last 120 prices
        }
        return prev
      })
    })

    priceEngine.start()

    return () => {
      unsubscribe()
    }
  }, [historyLoaded, selectedToken])

  // Subscribe to ALL token prices for position updates
  useEffect(() => {
    if (!profile?.fid || !historyLoaded) return

    const unsubscribers: (() => void)[] = []

    // Subscribe to all active tokens
    tokens.forEach(token => {
      const unsub = priceEngine.subscribe(token.symbol, (price) => {
        gameState.updatePriceForToken(profile.fid!, token.symbol, price)
      })
      unsubscribers.push(unsub)
    })

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [profile?.fid, historyLoaded, tokens])

  // Subscribe to player state updates
  useEffect(() => {
    if (!profile?.fid) return

    const unsubscribe = gameState.subscribe((state) => {
      if (state.fid === profile.fid) {
        setPlayerState(state)
      }
    })

    return unsubscribe
  }, [profile?.fid])

  return (
    <div className="w-full min-h-screen p-4">
      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-4 right-4 z-50 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg animate-slide-in">
          {notification}
        </div>
      )}
      {!isLoggedIn ? (
        <div className="max-w-3xl mx-auto mt-10 sm:mt-20 text-center">
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl sm:rounded-3xl p-6 sm:p-12 border border-gray-700/50 relative overflow-hidden backdrop-blur-xl shadow-2xl shadow-[#0000FF]/10">
            {/* Animated decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0000FF] opacity-10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#4444FF] opacity-10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg shadow-[#0000FF]/30">
                <span className="text-3xl sm:text-4xl">⚡</span>
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
                Welcome to <span className="bg-gradient-to-r from-[#0000FF] to-[#4444FF] bg-clip-text text-transparent">Based</span> Traders
              </h2>
              <p className="text-gray-300 text-sm sm:text-base md:text-lg mb-6 sm:mb-10 max-w-xl mx-auto px-2">
                Sign in with Farcaster to start trading with leverage. Get <span className="text-[#0000FF] font-bold">$1,000</span> virtual cash to trade with!
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                <div className="bg-[#0a0c12]/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-[#0000FF]/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0000FF]/20">
                  <div className="text-5xl mb-3">📈</div>
                  <div className="text-lg font-bold mb-1">Long/Short</div>
                  <div className="text-sm text-gray-400">Trade both directions</div>
                </div>
                <div className="bg-[#0a0c12]/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-[#0000FF]/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0000FF]/20">
                  <div className="text-5xl mb-3">⚡</div>
                  <div className="text-lg font-bold mb-1">Up to 10x Leverage</div>
                  <div className="text-sm text-gray-400">Amplify your gains</div>
                </div>
                <div className="bg-[#0a0c12]/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-[#0000FF]/50 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-[#0000FF]/20">
                  <div className="text-5xl mb-3">💰</div>
                  <div className="text-lg font-bold mb-1">$1000 Start</div>
                  <div className="text-sm text-gray-400">Free virtual capital</div>
                </div>
              </div>
              <p className="text-gray-400 text-sm">5% fee on profits only • Real-time price action</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          {/* Portfolio Stats - Compact */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-xl p-3 border border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">💵</span>
                <p className="text-gray-400 text-xs font-medium">Cash</p>
              </div>
              <p className="text-lg font-bold">
                {playerLoading ? '...' : playerState ? `$${playerState.cash.toFixed(2)}` : '$1,000.00'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-xl p-3 border border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">💎</span>
                <p className="text-gray-400 text-xs font-medium">Total Value</p>
              </div>
              <p className="text-lg font-bold">
                {playerLoading ? '...' : playerState ? `$${playerState.totalValue.toFixed(2)}` : '$1,000.00'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-xl p-3 border border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">{playerState && playerState.pnl >= 0 ? '📈' : '📉'}</span>
                <p className="text-gray-400 text-xs font-medium">P&L</p>
              </div>
              <p
                className={`text-lg font-bold ${
                  playerState && playerState.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {playerLoading ? '...' : playerState ? `${playerState.pnl >= 0 ? '+' : ''}$${playerState.pnl.toFixed(2)}` : '$0.00'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-xl p-3 border border-gray-700/50 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm">⚡</span>
                <p className="text-gray-400 text-xs font-medium">P&L %</p>
              </div>
              <p
                className={`text-lg font-bold ${
                  playerState && playerState.pnlPercent >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {playerLoading ? '...' : playerState ? `${playerState.pnlPercent >= 0 ? '+' : ''}${playerState.pnlPercent.toFixed(2)}%` : '0.00%'}
              </p>
            </div>
          </div>

          {/* Main Layout: Chart on Left, Controls on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Left Side: Chart (3/5 width on large screens) */}
            <div className="lg:col-span-3 space-y-4">
              {/* Chart */}
              <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-none md:rounded-3xl overflow-visible border-0 md:border md:border-gray-700/50 relative backdrop-blur-sm shadow-md shadow-[#0000FF]/3">
                {/* Subtle decorative gradient */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-[#0000FF] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

                <div className="flex justify-between items-center p-4 md:p-6 relative z-10">
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    {/* Token Selector Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setTokenSelectorOpen(!tokenSelectorOpen)}
                        className="flex items-center gap-2 hover:bg-[#0a0c12] px-2 py-1 rounded-lg transition-colors"
                      >
                        {/* Token Logo */}
                        {selectedToken?.logo_url ? (
                          <img
                            src={selectedToken.logo_url}
                            alt={selectedToken.symbol}
                            className="w-7 h-7 rounded-full flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <span className="text-xl flex-shrink-0">
                            {selectedToken?.symbol === 'BTC' ? '₿' :
                             selectedToken?.symbol === 'ETH' ? 'Ξ' :
                             selectedToken?.symbol === 'SOL' ? '◎' : '🎮'}
                          </span>
                        )}
                        <div className="text-left">
                          <h2 className="text-lg md:text-xl font-bold whitespace-nowrap">
                            {selectedToken?.symbol || 'BATR'}/USD
                          </h2>
                          <span className="text-xs text-gray-400 block whitespace-nowrap">
                            {selectedToken?.name || 'Based Traders Token'}
                          </span>
                        </div>
                        <span className="text-gray-400 text-sm flex-shrink-0">▼</span>
                      </button>

                      {/* Dropdown Menu */}
                      {tokenSelectorOpen && (
                        <>
                          <div
                            className="fixed inset-0 z-20"
                            onClick={() => setTokenSelectorOpen(false)}
                          ></div>
                          <div className="absolute top-full left-0 mt-2 bg-[#0f1117] border border-gray-700 rounded-xl shadow-2xl min-w-[250px] z-30 overflow-hidden max-h-[400px] overflow-y-auto">
                            {/* Real Crypto Category */}
                            {tokens.filter(t => t.is_real_crypto === 1).length > 0 && (
                              <>
                                <div className="px-4 py-2 bg-[#0a0c12] border-b border-gray-700">
                                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Real Crypto</div>
                                </div>
                                {tokens.filter(t => t.is_real_crypto === 1).map((token) => (
                                  <button
                                    key={token.id}
                                    onClick={() => {
                                      setSelectedToken(token)
                                      setTokenSelectorOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-[#0a0c12] transition-colors flex items-center justify-between ${
                                      selectedToken?.id === token.id ? 'bg-[#0000FF]/20' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {token.logo_url ? (
                                        <img
                                          src={token.logo_url}
                                          alt={token.symbol}
                                          className="w-8 h-8 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                          }}
                                        />
                                      ) : (
                                        <span className="text-2xl">
                                          {token.symbol === 'BTC' ? '₿' :
                                           token.symbol === 'ETH' ? 'Ξ' :
                                           token.symbol === 'SOL' ? '◎' : '💎'}
                                        </span>
                                      )}
                                      <div className="flex-1">
                                        <div className="font-bold">{token.symbol}/USD</div>
                                        <div className="text-xs text-gray-500">{token.name}</div>
                                      </div>
                                      <div className="text-xs text-[#0000FF] font-semibold mr-2">
                                        {token.max_leverage || 10}x
                                      </div>
                                    </div>
                                    {selectedToken?.id === token.id && (
                                      <span className="text-[#0000FF]">✓</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            )}

                            {/* Game Tokens Category */}
                            {tokens.filter(t => t.is_real_crypto !== 1).length > 0 && (
                              <>
                                <div className="px-4 py-2 bg-[#0a0c12] border-b border-gray-700">
                                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Game Tokens</div>
                                </div>
                                {tokens.filter(t => t.is_real_crypto !== 1).map((token) => (
                                  <button
                                    key={token.id}
                                    onClick={() => {
                                      setSelectedToken(token)
                                      setTokenSelectorOpen(false)
                                    }}
                                    className={`w-full text-left px-4 py-3 hover:bg-[#0a0c12] transition-colors flex items-center justify-between ${
                                      selectedToken?.id === token.id ? 'bg-[#0000FF]/20' : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-3">
                                      {token.logo_url ? (
                                        <img
                                          src={token.logo_url}
                                          alt={token.symbol}
                                          className="w-8 h-8 rounded-full flex-shrink-0"
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                          }}
                                        />
                                      ) : (
                                        <span className="text-2xl">🎮</span>
                                      )}
                                      <div className="flex-1">
                                        <div className="font-bold">{token.symbol}/USD</div>
                                        <div className="text-xs text-gray-500">{token.name}</div>
                                      </div>
                                      <div className="text-xs text-[#0000FF] font-semibold mr-2">
                                        {token.max_leverage || 10}x
                                      </div>
                                    </div>
                                    {selectedToken?.id === token.id && (
                                      <span className="text-[#0000FF]">✓</span>
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent whitespace-nowrap">
                      ${currentPrice >= 1000 ? currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : currentPrice.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5 whitespace-nowrap">Live Price</div>
                  </div>
                </div>
                {priceHistory.length > 0 ? (
                  <PriceChart
                    data={priceHistory}
                    entryPrice={
                      playerState?.positions.find(p => p.token === selectedToken?.symbol)?.entryPrice || null
                    }
                    positionType={
                      playerState?.positions.find(p => p.token === selectedToken?.symbol)?.type || null
                    }
                  />
                ) : (
                  <div className="h-[300px] flex items-center justify-center">
                    <div className="text-gray-400">Loading chart data...</div>
                  </div>
                )}
              </div>

              {/* Open Positions - Below Chart */}
              {playerState && playerState.positions.length > 0 && (
                <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-md shadow-[#0000FF]/3">
                  <div className="mb-4">
                    <h3 className="text-xl font-bold">
                      Open Positions ({playerState.positions.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {playerState.positions.map((position) => (
                      <PositionRow
                        key={position.id}
                        position={position}
                        onClose={async (id) => {
                          if (profile?.fid) {
                            const result = await gameState.closePosition(profile.fid, id)
                            // Show share modal if position closed with profit
                            if (result.success && result.profit !== undefined && result.profit > 0) {
                              // Reset all sharing states
                              setIsSharing(false)
                              setIsGeneratingImage(false)
                              setImageGenerated(false)
                              setGeneratedImageUrl(null)
                              setGeneratedImageBlob(null)
                              setShareModal({
                                show: true,
                                profit: result.profit,
                                leverage: result.leverage!,
                                token: result.token!,
                                profitPercent: result.profitPercent!
                              })
                            }
                          }
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side: Trading Controls (2/5 width on large screens) */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50 relative overflow-hidden backdrop-blur-sm shadow-md shadow-[#0000FF]/3 lg:sticky lg:top-4">
                {/* Subtle decorative gradient */}
                <div className="absolute top-0 left-0 w-64 h-64 bg-[#0000FF] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

                <div className="mb-6 relative z-10">
                  <h3 className="text-xl font-bold">Open New Position</h3>
                </div>
                {playerState && profile?.fid && selectedToken && (
                  <TradingControls
                    playerCash={playerState.cash}
                    playerTotalValue={playerState.totalValue}
                    maxLeverage={selectedToken.max_leverage || 10}
                    onOpenPosition={async (amount, leverage, type) => {
                      if (profile.fid && selectedToken) {
                        const result = await gameState.openPosition(profile.fid, amount, leverage, type, currentPrice, selectedToken.symbol)
                        if (!result.success && result.error) {
                          setNotification(result.error)
                          setTimeout(() => setNotification(null), 3000)
                        }
                      }
                    }}
                  />
                )}
              </div>

              {/* Trading Rules Info - Compact Banner */}
              <div className="bg-gradient-to-r from-[#0a0c12] via-[#0f1117] to-[#0a0c12] rounded-xl p-4 border border-[#0000FF]/20 backdrop-blur-sm shadow-md shadow-[#0000FF]/3 relative overflow-hidden">
                {/* Animated gradient background */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0000FF]/5 to-transparent animate-pulse"></div>

                <div className="relative z-10 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Opening Fee:</span>
                    <span className="font-semibold text-white">0.2-0.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Closing Fee:</span>
                    <span className="font-semibold text-white">0.2-0.5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Profit Fee:</span>
                    <span className="font-semibold text-green-400">5%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Funding Fee:</span>
                    <span className="font-semibold text-yellow-400">0.05%/h</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Max Collateral:</span>
                    <span className="font-semibold text-blue-400">80%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Position Limit:</span>
                    <span className="font-semibold text-purple-400">1/token</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Share Cast Modal */}
      {shareModal?.show && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-8 border border-[#0000FF]/50 max-w-md w-full relative overflow-hidden shadow-2xl shadow-[#0000FF]/30">
            {/* Animated decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0000FF] opacity-20 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-500 opacity-20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            <div className="relative z-10">
              {/* Logo */}
              <div className="flex justify-center mb-6">
                <img src="/menulogo.png" alt="Based Traders" className="w-32 h-32 object-contain" />
              </div>

              {/* Title */}
              <h3 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-green-400 to-green-600 bg-clip-text text-transparent">
                Profitable Trade!
              </h3>
              <p className="text-gray-400 text-center mb-6">Share your success with the community</p>

              {/* Stats */}
              <div className="space-y-3 mb-8 bg-[#0a0c12]/50 rounded-2xl p-6 border border-gray-700/50">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Token:</span>
                  <span className="font-bold text-xl text-white">{shareModal.token}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Leverage:</span>
                  <span className="font-bold text-xl text-[#0000FF]">{shareModal.leverage}x</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Profit:</span>
                  <span className="font-bold text-2xl text-green-400">+${shareModal.profit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Return:</span>
                  <span className="font-bold text-2xl text-green-400">+{shareModal.profitPercent.toFixed(2)}%</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                {/* Show Generate Image button first */}
                {!imageGenerated && (
                  <button
                    onClick={async () => {
                      try {
                        setIsGeneratingImage(true)
                        // Create share image and get static PNG URL
                        const response = await fetch('https://basedtraders.onrender.com/api/create-share-image', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            token: shareModal.token,
                            leverage: shareModal.leverage,
                            profit: shareModal.profit.toFixed(2),
                            profitPercent: shareModal.profitPercent.toFixed(2)
                          })
                        })

                        const data = await response.json()

                        if (!data.success || !data.imageUrl) {
                          throw new Error('Failed to create share image')
                        }

                        // Download image as blob for sharing
                        const imageResponse = await fetch(data.imageUrl)
                        const imageBlob = await imageResponse.blob()

                        setGeneratedImageUrl(data.imageUrl)
                        setGeneratedImageBlob(imageBlob)
                        setImageGenerated(true)
                        setIsGeneratingImage(false)
                      } catch (error) {
                        console.error('Failed to generate image:', error)
                        setIsGeneratingImage(false)
                      }
                    }}
                    disabled={isGeneratingImage}
                    className="w-full bg-gradient-to-r from-[#0000FF] to-[#4444FF] hover:from-[#0000DD] hover:to-[#3333DD] text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[#0000FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  >
                    {isGeneratingImage && (
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    {isGeneratingImage ? 'Generating...' : 'Generate Image'}
                  </button>
                )}

                {/* Show Share buttons after image is generated */}
                {imageGenerated && generatedImageUrl && (
                  <>
                    <button
                      onClick={async () => {
                        try {
                          setIsSharing(true)
                          const miniappUrl = 'https://farcaster.xyz/miniapps/YgDPslIu3Xrt/basedtraders'
                          const castText = `I just closed a ${shareModal.leverage}x ${shareModal.token} position on @basedtraders with $${shareModal.profit.toFixed(2)} profit (+${shareModal.profitPercent.toFixed(1)}%). Try it yourself!`

                          await sdk.actions.composeCast({
                            text: castText,
                            embeds: [generatedImageUrl, miniappUrl]
                          })
                          setShareModal(null)
                          setIsSharing(false)
                        } catch (error) {
                          console.error('Failed to compose cast:', error)
                          setIsSharing(false)
                          setShareModal(null)
                        }
                      }}
                      disabled={isSharing}
                      className="w-full bg-gradient-to-r from-[#0000FF] to-[#4444FF] hover:from-[#0000DD] hover:to-[#3333DD] text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[#0000FF]/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                    >
                      {isSharing && (
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {isSharing ? 'Sharing...' : 'Share Cast'}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          const appUrl = 'https://farcaster.xyz/miniapps/YgDPslIu3Xrt/basedtraders'
                          const tweetText = `I just closed a ${shareModal.leverage}x ${shareModal.token} position with $${shareModal.profit.toFixed(2)} profit (+${shareModal.profitPercent.toFixed(1)}%) on Based Traders!\n\n${appUrl}`

                          // Try Web Share API first (for native sharing with image)
                          if (navigator.share && generatedImageBlob) {
                            const file = new File([generatedImageBlob], 'profit-share.png', { type: 'image/png' })
                            await navigator.share({
                              text: tweetText,
                              files: [file]
                            })
                          } else {
                            // Fallback: Twitter Intent with image URL
                            const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText + '\n\n' + generatedImageUrl)}`
                            window.open(tweetUrl, '_blank')
                          }
                        } catch (error) {
                          console.error('Failed to share on X:', error)
                          // Fallback on error
                          const appUrl = 'https://farcaster.xyz/miniapps/YgDPslIu3Xrt/basedtraders'
                          const tweetText = `I just closed a ${shareModal.leverage}x ${shareModal.token} position with $${shareModal.profit.toFixed(2)} profit (+${shareModal.profitPercent.toFixed(1)}%) on Based Traders!\n\n${appUrl}\n\n${generatedImageUrl}`
                          const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
                          window.open(tweetUrl, '_blank')
                        }
                      }}
                      className="w-full bg-gradient-to-r from-[#1DA1F2] to-[#0C85D0] hover:from-[#1A91DA] hover:to-[#0A75C2] text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[#1DA1F2]/50 flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      Share on X
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setIsSharing(false)
                    setIsGeneratingImage(false)
                    setImageGenerated(false)
                    setGeneratedImageUrl(null)
                    setGeneratedImageBlob(null)
                    setShareModal(null)
                  }}
                  className="w-full bg-gray-700/50 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-300"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import { gameState } from '../lib/gameState'

interface ProfileProps {
  profile: any
  isLoggedIn: boolean
}

interface ProfileStats {
  farcaster_username: string
  farcaster_fid: number
  display_name?: string
  pfp_url?: string
  cash: number
  high_score: number
  created_at: number
  total_trades: number
  winning_trades: number
  losing_trades: number
  total_volume: number
  biggest_win: number
  biggest_loss: number
  avg_hold_time: number
  total_pnl: number
}

interface Trade {
  id: string
  type: 'LONG' | 'SHORT'
  entry_price: number
  close_price: number
  leverage: number
  size: number
  pnl: number
  opened_at: number
  closed_at: number
  is_liquidated: boolean
  token_symbol?: string
}

interface Achievement {
  id: number
  name: string
  description: string
  rarity: string
  requirement_type: string
  requirement_value: number
  is_active: number
}

export default function Profile({ profile, isLoggedIn }: ProfileProps) {
  const [stats, setStats] = useState<ProfileStats | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [shareModal, setShareModal] = useState<{
    show: boolean
    profit: number
    leverage: number
    token: string
    profitPercent: number
  } | null>(null)
  const itemsPerPage = 20

  useEffect(() => {
    if (isLoggedIn && profile?.fid) {
      // Initialize player first
      gameState.initPlayer(profile.fid).then(() => {
        loadProfileData()
      })

      // Reload every 5 seconds to stay in sync
      const interval = setInterval(() => {
        if (profile?.fid) loadProfileData()
      }, 5000)

      return () => clearInterval(interval)
    }
  }, [isLoggedIn, profile?.fid])

  const loadProfileData = async () => {
    if (!profile?.fid) return

    try {
      const playerState = gameState.getPlayerState(profile.fid)

      if (!playerState) {
        await gameState.initPlayer(profile.fid)
        setTimeout(loadProfileData, 100)
        return
      }

      let statsData
      let tradesData = []
      let achievementsData = []

      try {
        const [statsRes, tradesRes, achievementsRes] = await Promise.all([
          fetch(`/api/player/${profile.fid}/stats`),
          fetch(`/api/positions/${profile.fid}/closed`),
          fetch(`/api/player/${profile.fid}/achievements`)
        ])

        if (statsRes.ok) {
          statsData = await statsRes.json()
        }
        if (tradesRes.ok) {
          tradesData = await tradesRes.json()
        }
        if (achievementsRes.ok) {
          achievementsData = await achievementsRes.json()
        }
      } catch (apiError) {
        // Use memory data only
      }

      // Calculate stats from trades data
      const totalTrades = Array.isArray(tradesData) ? tradesData.length : (statsData?.total_trades || 0)
      const winningTrades = Array.isArray(tradesData)
        ? tradesData.filter(t => t.pnl > 0).length
        : (statsData?.winning_trades || 0)
      const losingTrades = Array.isArray(tradesData)
        ? tradesData.filter(t => t.pnl <= 0).length
        : (statsData?.losing_trades || 0)
      const totalVolume = Array.isArray(tradesData)
        ? tradesData.reduce((sum, t) => sum + t.size, 0)
        : (statsData?.total_volume || 0)
      const biggestWin = Array.isArray(tradesData) && tradesData.length > 0
        ? Math.max(...tradesData.map(t => t.pnl), 0)
        : (statsData?.biggest_win || 0)
      const biggestLoss = Array.isArray(tradesData) && tradesData.length > 0
        ? Math.min(...tradesData.map(t => t.pnl), 0)
        : (statsData?.biggest_loss || 0)
      const totalPnl = Array.isArray(tradesData)
        ? tradesData.reduce((sum, t) => sum + t.pnl, 0)
        : (statsData?.total_pnl || playerState.pnl)
      const avgHoldTime = Array.isArray(tradesData) && tradesData.length > 0
        ? tradesData.reduce((sum, t) => sum + (t.closed_at - t.opened_at), 0) / tradesData.length
        : (statsData?.avg_hold_time || 0)

      // Always use current player state values
      const finalStats: ProfileStats = {
        farcaster_username: statsData?.farcaster_username || profile?.username || '',
        farcaster_fid: playerState.fid,
        display_name: statsData?.display_name || profile?.displayName,
        pfp_url: statsData?.pfp_url || profile?.pfpUrl,
        cash: playerState.cash,
        high_score: Math.max(statsData?.high_score || 0, playerState.totalValue),
        created_at: statsData?.created_at || Date.now(),
        total_trades: totalTrades,
        winning_trades: winningTrades,
        losing_trades: losingTrades,
        total_volume: totalVolume,
        biggest_win: biggestWin,
        biggest_loss: biggestLoss,
        avg_hold_time: avgHoldTime,
        total_pnl: totalPnl
      }

      setStats(finalStats)
      setTrades(Array.isArray(tradesData) ? tradesData : [])
      setAchievements(Array.isArray(achievementsData) ? achievementsData : [])
      setCurrentPage(1) // Reset to first page when trades reload

      setLoading(false)
    } catch (error) {
      setLoading(false)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h`
    const days = Math.floor(hours / 24)
    return `${days}d`
  }

  // Calculate pagination for trades
  const totalPages = Math.ceil(trades.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedTrades = trades.slice(startIndex, endIndex)

  return (
    <div className="w-full min-h-screen p-4">
      {!isLoggedIn ? (
        <div className="max-w-2xl mx-auto mt-20 text-center">
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-12 border border-gray-700/50 relative overflow-hidden backdrop-blur-xl shadow-2xl shadow-[#0000FF]/10">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#0000FF] opacity-10 rounded-full blur-3xl animate-pulse"></div>
            <div className="relative z-10">
              <div className="w-20 h-20 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-[#0000FF]/30">
                <span className="text-4xl">👤</span>
              </div>
              <h2 className="text-4xl font-bold mb-4">Sign in with Farcaster</h2>
              <p className="text-gray-300 text-lg mb-8">
                Sign in with Farcaster to view your profile and trading statistics
              </p>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="max-w-7xl mx-auto text-center mt-20">
          <div className="text-2xl text-gray-400">Loading profile...</div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto">
          {/* Profile Header */}
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-8 border border-gray-700/50 mb-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
            <div className="absolute top-0 right-0 w-96 h-96 bg-[#0000FF] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex items-center gap-6 mb-4">
                {stats?.pfp_url ? (
                  <img
                    src={stats.pfp_url}
                    alt={stats.farcaster_username}
                    className="w-24 h-24 rounded-2xl shadow-lg shadow-[#0000FF]/30"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#0000FF] to-[#0000AA] flex items-center justify-center text-5xl shadow-lg shadow-[#0000FF]/30">
                    👤
                  </div>
                )}
                <div>
                  <h2 className="text-3xl font-bold mb-2">
                    {stats?.display_name || '@' + stats?.farcaster_username}
                  </h2>
                  <p className="text-sm text-purple-400 bg-[#0a0c12]/50 px-3 py-1 rounded-lg inline-block">
                    @{stats?.farcaster_username}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    ⏰ Member since {stats ? formatDate(stats.created_at) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl p-5 border border-gray-700/50 hover:border-[#0000FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#0000FF]/10 backdrop-blur-sm group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl group-hover:scale-110 transition-transform">💵</span>
                <p className="text-gray-400 text-sm font-medium">Current Balance</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold truncate">${stats?.cash.toFixed(2) || '0.00'}</p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl p-5 border border-gray-700/50 hover:border-[#0000FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#0000FF]/10 backdrop-blur-sm group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl group-hover:scale-110 transition-transform">🏆</span>
                <p className="text-gray-400 text-sm font-medium">High Score</p>
              </div>
              <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-[#0000FF] to-[#4444FF] bg-clip-text text-transparent truncate">
                ${stats?.high_score.toFixed(2) || '0.00'}
              </p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl p-5 border border-gray-700/50 hover:border-[#0000FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#0000FF]/10 backdrop-blur-sm group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl group-hover:scale-110 transition-transform">📊</span>
                <p className="text-gray-400 text-sm font-medium">Total Trades</p>
              </div>
              <p className="text-3xl font-bold">{stats?.total_trades || 0}</p>
            </div>
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl p-5 border border-gray-700/50 hover:border-[#0000FF]/30 transition-all duration-300 hover:shadow-lg hover:shadow-[#0000FF]/10 backdrop-blur-sm group">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl group-hover:scale-110 transition-transform">🎯</span>
                <p className="text-gray-400 text-sm font-medium">Win Rate</p>
              </div>
              <p className="text-3xl font-bold text-green-400">
                {stats && stats.total_trades > 0
                  ? ((stats.winning_trades / stats.total_trades) * 100).toFixed(1)
                  : '0.0'}%
              </p>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-lg flex items-center justify-center">
                  <span className="text-lg">📊</span>
                </div>
                <h3 className="text-xl font-bold">Trading Statistics</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Winning Trades</span>
                  <span className="font-bold text-green-400">{stats?.winning_trades || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Losing Trades</span>
                  <span className="font-bold text-red-400">{stats?.losing_trades || 0}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                  <span className="text-gray-400">Total Volume</span>
                  <span className="font-bold">${stats?.total_volume.toFixed(0) || '0'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Total P&L</span>
                  <span className={`font-bold ${(stats?.total_pnl || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {(stats?.total_pnl || 0) >= 0 ? '+' : ''}${stats?.total_pnl.toFixed(2) || '0.00'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                  <span className="text-gray-400">Biggest Win</span>
                  <span className="font-bold text-green-400">+${stats?.biggest_win.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Biggest Loss</span>
                  <span className="font-bold text-red-400">${stats?.biggest_loss.toFixed(2) || '0.00'}</span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-800">
                  <span className="text-gray-400">Avg Hold Time</span>
                  <span className="font-bold">{formatDuration(stats?.avg_hold_time || 0)}</span>
                </div>
              </div>
            </div>

            {/* Achievements */}
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50 backdrop-blur-sm shadow-xl relative overflow-hidden">
              {/* SOON Overlay */}
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-3xl">
                <div className="text-center">
                  <div className="inline-block bg-gradient-to-r from-[#0000FF] to-[#4444FF] text-white px-8 py-4 rounded-2xl text-3xl font-bold shadow-2xl shadow-[#0000FF]/50 mb-4">
                    SOON
                  </div>
                  <p className="text-gray-300 text-lg font-semibold">Achievement NFTs Coming Soon!</p>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-lg flex items-center justify-center">
                  <span className="text-lg">🏆</span>
                </div>
                <h3 className="text-xl font-bold">Achievements</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 opacity-30">
                {achievements.map((achievement) => {
                  const rarityColors: Record<string, string> = {
                    'common': 'text-gray-400',
                    'rare': 'text-blue-400',
                    'epic': 'text-purple-400',
                    'legendary': 'text-yellow-400'
                  }

                  return (
                    <div
                      key={achievement.id}
                      className="bg-gradient-to-br from-[#0a0c12] to-[#080911] rounded-2xl p-4 border border-gray-700/50"
                    >
                      <div className="text-sm font-bold mb-1">{achievement.name}</div>
                      <div className="text-xs text-gray-500 mb-2">{achievement.description}</div>
                      <div className={`text-xs font-semibold mb-2 ${rarityColors[achievement.rarity.toLowerCase()] || 'text-gray-400'}`}>
                        {achievement.rarity}
                      </div>
                      <button
                        disabled
                        className="w-full bg-[#0000FF]/20 text-[#4444FF] px-2 py-1 rounded text-xs font-semibold opacity-50 cursor-not-allowed"
                      >
                        Mint as NFT
                      </button>
                    </div>
                  )
                })}
                {achievements.length === 0 && (
                  <div className="col-span-2 text-center text-gray-500 py-8">
                    Start trading to unlock achievements!
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recent Trades */}
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-4 sm:p-6 border border-gray-700/50 backdrop-blur-sm shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-lg flex items-center justify-center">
                <span className="text-lg">📋</span>
              </div>
              <h3 className="text-xl font-bold">Recent Trades ({trades.length})</h3>
            </div>
            {trades.length > 0 ? (
              <>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="text-left text-xs sm:text-sm text-gray-400 border-b border-gray-800">
                      <th className="pb-3 pl-4 sm:pl-0">Token</th>
                      <th className="pb-3">Type</th>
                      <th className="pb-3">Entry</th>
                      <th className="pb-3">Exit</th>
                      <th className="pb-3">Lev</th>
                      <th className="pb-3">Size</th>
                      <th className="pb-3 hidden sm:table-cell">Duration</th>
                      <th className="pb-3">P&L</th>
                      <th className="pb-3 pr-4 sm:pr-0">Date</th>
                      <th className="pb-3 pr-4 sm:pr-0"></th>
                    </tr>
                  </thead>
                  <tbody className="text-xs sm:text-sm">
                    {paginatedTrades.map((trade) => (
                      <tr key={trade.id} className="border-b border-gray-800 hover:bg-[#0a0c12] transition-colors">
                        <td className="py-3 pl-4 sm:pl-0">
                          <span className="bg-[#0000FF]/20 px-2 py-1 rounded text-xs font-bold text-[#4444FF]">
                            {trade.token_symbol || 'BATR'}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`font-bold ${trade.type === 'LONG' || trade.type.startsWith('LONG') ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.type.replace(/0/g, '')}
                          </span>
                          {trade.is_liquidated && (
                            <span className="ml-1 sm:ml-2 text-xs text-red-500">LIQ</span>
                          )}
                        </td>
                        <td className="py-3 font-mono">${trade.entry_price.toFixed(2)}</td>
                        <td className="py-3 font-mono">${trade.close_price.toFixed(2)}</td>
                        <td className="py-3">{trade.leverage}×</td>
                        <td className="py-3">${trade.size.toFixed(0)}</td>
                        <td className="py-3 hidden sm:table-cell">{formatDuration(trade.closed_at - trade.opened_at)}</td>
                        <td className={`py-3 font-bold whitespace-nowrap ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                        </td>
                        <td className="py-3 text-gray-500 pr-4 sm:pr-0 text-xs">{formatDate(trade.closed_at)}</td>
                        <td className="py-3 pr-4 sm:pr-0">
                          {trade.pnl > 0 && (
                            <button
                              onClick={() => {
                                const profitPercent = (trade.pnl / (trade.size / trade.leverage)) * 100
                                setShareModal({
                                  show: true,
                                  profit: trade.pnl,
                                  leverage: trade.leverage,
                                  token: trade.token_symbol || 'BATR',
                                  profitPercent: profitPercent
                                })
                              }}
                              className="bg-[#0000FF]/20 hover:bg-[#0000FF]/30 text-[#4444FF] hover:text-[#6666FF] px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                            >
                              Share
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-1 md:gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2 md:px-4 py-2 rounded-lg bg-[#0f1117] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-xs md:text-sm"
                  >
                    <span className="hidden md:inline">← Prev</span>
                    <span className="md:hidden">←</span>
                  </button>

                  <div className="flex items-center gap-1 md:gap-2 overflow-x-auto max-w-[60%] md:max-w-none">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-lg font-semibold transition-colors text-xs md:text-sm flex-shrink-0 ${
                          currentPage === page
                            ? 'bg-[#0000FF] text-white'
                            : 'bg-[#0f1117] text-gray-400 hover:text-white'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2 md:px-4 py-2 rounded-lg bg-[#0f1117] text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-xs md:text-sm"
                  >
                    <span className="hidden md:inline">Next →</span>
                    <span className="md:hidden">→</span>
                  </button>
                </div>
              )}
              </>
            ) : (
              <div className="text-center text-gray-500 py-12">
                No closed trades yet.
              </div>
            )}
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
                <button
                  onClick={async () => {
                    try {
                      const castText = `🎯 Just closed a ${shareModal.leverage}x ${shareModal.token} position with +$${shareModal.profit.toFixed(2)} profit (+${shareModal.profitPercent.toFixed(1)}%) on @basedtraders! 💰\n\nThink you can do better?\n\nhttps://farcaster.xyz/miniapps/GlmJsUyW-yPo/based-traders`

                      // Generate share image URL with parameters
                      const imageUrl = `https://basetraders-hcniclcms-ggbrotrs-projects.vercel.app/api/share-image-png?token=${encodeURIComponent(shareModal.token)}&leverage=${shareModal.leverage}&profit=${shareModal.profit.toFixed(2)}&profitPercent=${shareModal.profitPercent.toFixed(2)}`

                      await sdk.actions.composeCast({
                        text: castText,
                        embeds: [imageUrl]
                      })
                      setShareModal(null)
                    } catch (error) {
                      console.error('Failed to compose cast:', error)
                      setShareModal(null)
                    }
                  }}
                  className="w-full bg-gradient-to-r from-[#0000FF] to-[#4444FF] hover:from-[#0000DD] hover:to-[#3333DD] text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 shadow-lg shadow-[#0000FF]/50"
                >
                  Share Cast
                </button>
                <button
                  onClick={() => setShareModal(null)}
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

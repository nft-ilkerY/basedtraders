import { useEffect, useState } from 'react'

interface LeaderboardEntry {
  farcaster_username: string
  farcaster_fid: number
  display_name?: string
  pfp_url?: string
  cash: number
  high_score: number
  rank: string
  total_trades: number
  winning_trades: number
  losing_trades: number
  total_volume: number
  total_pnl: number
  biggest_win: number
  biggest_loss: number
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly'
type SortBy = 'total_pnl' | 'total_volume' | 'win_rate' | 'total_trades' | 'high_score'

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly')
  const [sortBy, setSortBy] = useState<SortBy>('total_pnl')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadLeaderboard()
    setCurrentPage(1) // Reset to first page when time range changes

    // Refresh every 10 seconds
    const interval = setInterval(loadLeaderboard, 10000)
    return () => clearInterval(interval)
  }, [timeRange])

  // Reset to first page when sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy])

  const loadLeaderboard = async () => {
    try {
      // Fetch leaderboard with time range filter from backend
      const response = await fetch(`/api/leaderboard?range=${timeRange}`)
      if (response.ok) {
        const data = await response.json()
        setLeaderboard(data)
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSortedLeaderboard = () => {
    return [...leaderboard].sort((a, b) => {
      switch (sortBy) {
        case 'total_pnl':
          return (b.total_pnl || 0) - (a.total_pnl || 0)
        case 'total_volume':
          return (b.total_volume || 0) - (a.total_volume || 0)
        case 'win_rate':
          const winRateA = a.total_trades > 0 ? (a.winning_trades / a.total_trades) * 100 : 0
          const winRateB = b.total_trades > 0 ? (b.winning_trades / b.total_trades) * 100 : 0
          return winRateB - winRateA
        case 'total_trades':
          return (b.total_trades || 0) - (a.total_trades || 0)
        case 'high_score':
          return (b.high_score || 0) - (a.high_score || 0)
        default:
          return 0
      }
    })
  }

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'text-yellow-400'
    if (rank === 2) return 'text-gray-300'
    if (rank === 3) return 'text-orange-400'
    return 'text-gray-400'
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case 'daily': return 'Daily'
      case 'weekly': return 'Weekly'
      case 'monthly': return 'Monthly'
      case 'quarterly': return '3 Months'
    }
  }

  const sortedLeaderboard = getSortedLeaderboard()
  const totalPages = Math.ceil(sortedLeaderboard.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedLeaderboard = sortedLeaderboard.slice(startIndex, endIndex)

  return (
    <div className="w-full min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Leaderboard Header */}
        <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-4 md:p-8 border border-gray-700/50 mb-4 md:mb-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#0000FF] opacity-[0.08] rounded-full blur-3xl pointer-events-none animate-pulse"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-12 h-12 md:w-16 md:h-16 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-2xl flex items-center justify-center shadow-lg shadow-[#0000FF]/30">
                <span className="text-3xl md:text-4xl">🏆</span>
              </div>
              <div>
                <h2 className="text-2xl md:text-4xl font-bold">Leaderboard</h2>
                <p className="text-gray-400 text-xs md:text-sm mt-1">Top traders ranked by performance</p>
              </div>
            </div>
          </div>
        </div>

        {/* Time Range Tabs */}
        <div className="flex gap-1 md:gap-2 mb-6">
          {(['daily', 'weekly', 'monthly', 'quarterly'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`flex-1 px-2 md:px-6 py-2 md:py-3 rounded-xl font-semibold transition-all whitespace-nowrap text-xs md:text-base ${
                timeRange === range
                  ? 'bg-[#0000FF] text-white shadow-lg shadow-[#0000FF]/50'
                  : 'bg-[#0f1117] text-gray-400 hover:text-white hover:bg-[#0f1117]/80'
              }`}
            >
              {getTimeRangeLabel(range)}
            </button>
          ))}
        </div>

        {/* Leaderboard Table */}
        <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-4 sm:p-6 border border-gray-700/50 backdrop-blur-sm shadow-xl">
          {loading ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-xl">Loading leaderboard...</div>
            </div>
          ) : sortedLeaderboard.length === 0 ? (
            <div className="text-center text-gray-400 py-12">
              <div className="text-xl mb-2">No traders yet!</div>
              <p className="text-sm">Be the first to start trading and claim the top spot</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs sm:text-sm text-gray-400 border-b border-gray-800">
                    <th className="pb-3 pl-4 sm:pl-0">Rank</th>
                    <th className="pb-3">Trader</th>
                    <th
                      className={`pb-3 text-right cursor-pointer hover:text-white transition-colors ${sortBy === 'total_pnl' ? 'text-[#0000FF]' : ''}`}
                      onClick={() => setSortBy('total_pnl')}
                    >
                      P&L {sortBy === 'total_pnl' && '↓'}
                    </th>
                    <th
                      className={`pb-3 text-right cursor-pointer hover:text-white transition-colors ${sortBy === 'total_volume' ? 'text-[#0000FF]' : ''}`}
                      onClick={() => setSortBy('total_volume')}
                    >
                      Vol {sortBy === 'total_volume' && '↓'}
                    </th>
                    <th
                      className={`pb-3 text-right cursor-pointer hover:text-white transition-colors ${sortBy === 'win_rate' ? 'text-[#0000FF]' : ''}`}
                      onClick={() => setSortBy('win_rate')}
                    >
                      Win% {sortBy === 'win_rate' && '↓'}
                    </th>
                    <th
                      className={`pb-3 text-right cursor-pointer hover:text-white transition-colors ${sortBy === 'total_trades' ? 'text-[#0000FF]' : ''}`}
                      onClick={() => setSortBy('total_trades')}
                    >
                      Trades {sortBy === 'total_trades' && '↓'}
                    </th>
                    <th
                      className={`pb-3 pr-4 sm:pr-0 text-right cursor-pointer hover:text-white transition-colors ${sortBy === 'high_score' ? 'text-[#0000FF]' : ''}`}
                      onClick={() => setSortBy('high_score')}
                    >
                      Score {sortBy === 'high_score' && '↓'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeaderboard.map((entry, index) => {
                    const rank = startIndex + index + 1
                    const isTopThree = rank <= 3
                    const winRate = entry.total_trades > 0 ? (entry.winning_trades / entry.total_trades) * 100 : 0

                    return (
                      <tr
                        key={entry.farcaster_username}
                        className={`border-b border-gray-800/50 transition-all duration-300 group ${
                          isTopThree ? 'bg-gradient-to-r from-[#0000FF]/10 to-transparent hover:from-[#0000FF]/15' : 'hover:bg-gradient-to-r hover:from-[#0000FF]/5 hover:to-transparent'
                        }`}
                      >
                        <td className="py-3 md:py-4 pl-4 sm:pl-0">
                          <div className={`text-lg md:text-2xl font-bold ${getRankColor(rank)}`}>
                            {getRankIcon(rank)}
                          </div>
                        </td>
                        <td className="py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            {entry.pfp_url ? (
                              <img
                                src={entry.pfp_url}
                                alt={entry.farcaster_username}
                                className="w-8 h-8 md:w-10 md:h-10 rounded-lg flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-lg flex items-center justify-center text-sm md:text-lg flex-shrink-0">
                                👤
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs md:text-sm font-bold text-white truncate">
                                {entry.display_name || '@' + entry.farcaster_username}
                              </div>
                              <div className="text-[10px] md:text-xs text-purple-400 truncate">
                                @{entry.farcaster_username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 md:py-4 text-right">
                          <div className={`text-sm md:text-base font-bold whitespace-nowrap ${entry.total_pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {entry.total_pnl >= 0 ? '+' : '-'}${Math.abs(entry.total_pnl).toFixed(2)}
                          </div>
                        </td>
                        <td className="py-3 md:py-4 text-right">
                          <div className="text-sm md:text-base font-bold text-white whitespace-nowrap">
                            ${entry.total_volume.toFixed(0)}
                          </div>
                        </td>
                        <td className="py-3 md:py-4 text-right">
                          <div className={`text-sm md:text-base font-bold whitespace-nowrap ${winRate >= 50 ? 'text-green-400' : 'text-orange-400'}`}>
                            {winRate.toFixed(0)}%
                          </div>
                        </td>
                        <td className="py-3 md:py-4 text-right">
                          <div className="text-sm md:text-base font-bold text-white">
                            {entry.total_trades}
                          </div>
                        </td>
                        <td className="py-3 md:py-4 pr-4 sm:pr-0 text-right">
                          <div className={`text-sm md:text-base font-bold whitespace-nowrap ${isTopThree ? 'bg-gradient-to-r from-[#0000FF] to-[#4444FF] bg-clip-text text-transparent' : 'text-white'}`}>
                            ${entry.high_score.toFixed(0)}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
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
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-2xl p-4 md:p-5 border border-gray-700/50 backdrop-blur-sm shadow-xl">
          <div className="flex items-start gap-3 md:gap-4">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-lg md:text-xl">💡</span>
            </div>
            <div className="text-xs md:text-sm text-gray-400">
              <p className="mb-1 md:mb-2">
                <strong className="text-white font-bold">Tap column headers</strong> to sort by different metrics.
              </p>
              <p className="mb-1 md:mb-2">
                <strong className="text-white font-bold">P&L:</strong> Profit/loss from closed positions
              </p>
              <p className="mb-1 md:mb-2">
                <strong className="text-white font-bold">Vol:</strong> Total trading volume
              </p>
              <p>
                <strong className="text-white font-bold">Score:</strong> Highest balance achieved
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

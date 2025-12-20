import { useEffect, useState } from 'react'

interface Token {
  id: number
  symbol: string
  name: string
  initial_price: number
  current_price: number
  is_active: boolean
  is_real_crypto?: boolean
  logo_url?: string
  max_leverage?: number
  created_at: number
}

interface Config {
  key: string
  value: string
  updated_at: number
}

interface AdminPanelProps {
  fid: number
}

export default function AdminPanel({ fid }: AdminPanelProps) {
  const [tokens, setTokens] = useState<Token[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'tokens' | 'config' | 'players'>('tokens')
  const [settingsToken, setSettingsToken] = useState<Token | null>(null)
  const [maxLeverage, setMaxLeverage] = useState<number>(10)

  // New token form
  const [newToken, setNewToken] = useState({ symbol: '', name: '', initial_price: '', is_real_crypto: false })

  // Bulk balance update
  const [balanceThreshold, setBalanceThreshold] = useState('')
  const [balanceAmount, setBalanceAmount] = useState('')
  const [affectedPlayers, setAffectedPlayers] = useState(0)
  const [isApplying, setIsApplying] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [tokensRes, configsRes] = await Promise.all([
        fetch('https://basedtraders.onrender.com/api/admin/tokens', {
          headers: { 'x-fid': fid.toString() }
        }),
        fetch('https://basedtraders.onrender.com/api/admin/config', {
          headers: { 'x-fid': fid.toString() }
        })
      ])

      if (tokensRes.ok) {
        const tokensData = await tokensRes.json()
        setTokens(tokensData)
      }

      if (configsRes.ok) {
        const configsData = await configsRes.json()
        setConfigs(configsData)
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to load admin data:', error)
      setLoading(false)
    }
  }

  const handleAddToken = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const actualPrice = parseFloat(newToken.initial_price)

      const response = await fetch('https://basedtraders.onrender.com/api/admin/tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fid': fid.toString()
        },
        body: JSON.stringify({
          symbol: newToken.symbol.toUpperCase(),
          name: newToken.name,
          initial_price: actualPrice,
          is_real_crypto: newToken.is_real_crypto
        })
      })

      if (response.ok) {
        setNewToken({ symbol: '', name: '', initial_price: '', is_real_crypto: false })
        loadData()
      } else {
        alert('Failed to add token')
      }
    } catch (error) {
      alert('Error adding token')
    }
  }

  const handleToggleToken = async (token: Token) => {
    try {
      const response = await fetch(`https://basedtraders.onrender.com/api/admin/tokens/${token.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-fid': fid.toString()
        },
        body: JSON.stringify({
          name: token.name,
          is_active: !token.is_active,
          max_leverage: token.max_leverage || 10
        })
      })

      if (response.ok) {
        loadData()
      }
    } catch (error) {
      alert('Error updating token')
    }
  }

  const handleOpenSettings = (token: Token) => {
    setSettingsToken(token)
    setMaxLeverage(token.max_leverage || 10)
  }

  const handleSaveSettings = async () => {
    if (!settingsToken) return

    try {
      const response = await fetch(`/api/admin/tokens/${settingsToken.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-fid': fid.toString()
        },
        body: JSON.stringify({
          name: settingsToken.name,
          is_active: settingsToken.is_active,
          max_leverage: maxLeverage
        })
      })

      if (response.ok) {
        setSettingsToken(null)
        loadData()
      } else {
        alert('Failed to update token settings')
      }
    } catch (error) {
      alert('Error updating token settings')
    }
  }

  const handleDeleteToken = async (tokenId: number) => {
    if (!confirm('Are you sure you want to delete this token?')) return

    try {
      const response = await fetch(`/api/admin/tokens/${tokenId}`, {
        method: 'DELETE',
        headers: {
          'x-fid': fid.toString()
        }
      })

      if (response.ok) {
        loadData()
      } else {
        const errorData = await response.json()
        alert(errorData.error || 'Error deleting token')
      }
    } catch (error) {
      alert('Error deleting token')
    }
  }

  const handleUpdateConfig = async (key: string, value: string) => {
    try {
      const response = await fetch(`https://basedtraders.onrender.com/api/admin/config/${key}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-fid': fid.toString()
        },
        body: JSON.stringify({ value })
      })

      if (response.ok) {
        loadData()
      }
    } catch (error) {
      alert('Error updating config')
    }
  }

  const checkAffectedPlayers = async () => {
    if (!balanceThreshold) {
      setAffectedPlayers(0)
      return
    }

    try {
      const threshold = parseFloat(balanceThreshold)
      const response = await fetch(`https://basedtraders.onrender.com/api/admin/players/count?threshold=${threshold}`, {
        headers: { 'x-fid': fid.toString() }
      })

      if (response.ok) {
        const data = await response.json()
        setAffectedPlayers(data.count)
      }
    } catch (error) {
      console.error('Failed to check affected players:', error)
    }
  }

  const handleBulkBalanceUpdate = async () => {
    if (!balanceThreshold || !balanceAmount) {
      alert('Please enter both threshold and amount')
      return
    }

    const threshold = parseFloat(balanceThreshold)
    const amount = parseFloat(balanceAmount)

    if (isNaN(threshold) || isNaN(amount) || amount <= 0) {
      alert('Please enter valid numbers')
      return
    }

    if (!confirm(`This will add $${amount.toFixed(2)} to ${affectedPlayers} players with balance below $${threshold.toFixed(2)}. Continue?`)) {
      return
    }

    setIsApplying(true)
    try {
      const response = await fetch('https://basedtraders.onrender.com/api/admin/players/bulk-balance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fid': fid.toString()
        },
        body: JSON.stringify({
          threshold,
          amount
        })
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Successfully updated ${data.updated} players`)
        setBalanceThreshold('')
        setBalanceAmount('')
        setAffectedPlayers(0)
      } else {
        alert('Failed to update balances')
      }
    } catch (error) {
      alert('Error updating balances')
    } finally {
      setIsApplying(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full min-h-screen p-4 flex items-center justify-center">
        <div className="text-2xl text-gray-400">Loading admin panel...</div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-8 border border-gray-700/50 mb-6 relative overflow-hidden backdrop-blur-sm shadow-xl">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#0000FF] opacity-[0.08] rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <h1 className="text-4xl font-bold mb-2">Admin Panel</h1>
            <p className="text-gray-400">Manage tokens, fees, and system configuration</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
              activeTab === 'tokens'
                ? 'bg-[#0000FF] text-white'
                : 'bg-[#0f1117] text-gray-400 hover:text-white'
            }`}
          >
            Tokens
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
              activeTab === 'config'
                ? 'bg-[#0000FF] text-white'
                : 'bg-[#0f1117] text-gray-400 hover:text-white'
            }`}
          >
            Fee Configuration
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all whitespace-nowrap ${
              activeTab === 'players'
                ? 'bg-[#0000FF] text-white'
                : 'bg-[#0f1117] text-gray-400 hover:text-white'
            }`}
          >
            Players
          </button>
        </div>

        {/* Tokens Tab */}
        {activeTab === 'tokens' && (
          <div className="space-y-6">
            {/* Add Token Form */}
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4">Add New Token</h3>
              <form onSubmit={handleAddToken} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    placeholder="Symbol (e.g., BTC)"
                    value={newToken.symbol}
                    onChange={(e) => setNewToken({ ...newToken, symbol: e.target.value })}
                    className="bg-[#0a0c12] border border-gray-700 rounded-lg px-4 py-2 text-white"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Name (e.g., Bitcoin)"
                    value={newToken.name}
                    onChange={(e) => setNewToken({ ...newToken, name: e.target.value })}
                    className="bg-[#0a0c12] border border-gray-700 rounded-lg px-4 py-2 text-white"
                    required
                  />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Starting Price"
                    value={newToken.initial_price}
                    onChange={(e) => setNewToken({ ...newToken, initial_price: e.target.value })}
                    className="bg-[#0a0c12] border border-gray-700 rounded-lg px-4 py-2 text-white"
                    required
                    disabled={newToken.is_real_crypto}
                  />
                </div>

                {/* Real Crypto Toggle */}
                <div className="flex items-center gap-4 bg-[#0a0c12] border border-gray-700 rounded-lg px-4 py-3">
                  <input
                    type="checkbox"
                    id="is_real_crypto"
                    checked={newToken.is_real_crypto}
                    onChange={(e) => setNewToken({ ...newToken, is_real_crypto: e.target.checked, initial_price: e.target.checked ? '0' : newToken.initial_price })}
                    className="w-5 h-5 rounded border-gray-700 bg-[#090a0f] checked:bg-[#0000FF] focus:ring-[#0000FF]"
                  />
                  <label htmlFor="is_real_crypto" className="flex-1">
                    <div className="font-semibold text-white">Real Cryptocurrency</div>
                    <div className="text-sm text-gray-400">
                      Use live prices from Binance (requires exact symbol like BTC, ETH, SOL, DOGE, etc.)
                    </div>
                  </label>
                  {newToken.is_real_crypto && (
                    <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-semibold">
                      🔴 LIVE
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#0000FF] hover:bg-[#0000CC] text-white font-semibold rounded-lg px-6 py-3 transition-colors"
                >
                  Add Token
                </button>
              </form>
            </div>

            {/* Tokens List */}
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50">
              <h3 className="text-xl font-bold mb-4">All Tokens ({tokens.length})</h3>
              <div className="space-y-3">
                {tokens.map((token) => (
                  <div
                    key={token.id}
                    className="bg-[#0a0c12] rounded-xl p-4 border border-gray-700/50"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Token Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Token Logo */}
                        {token.logo_url ? (
                          <img
                            src={token.logo_url}
                            alt={token.symbol}
                            className="w-12 h-12 rounded-full flex-shrink-0"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                            }}
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#0000FF] to-[#4444FF] flex items-center justify-center flex-shrink-0">
                            <span className="text-white font-bold text-sm">{token.symbol.slice(0, 3)}</span>
                          </div>
                        )}

                        {/* Token Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="font-bold text-lg">{token.symbol}</div>
                            <div className={`px-2 py-0.5 rounded text-xs font-semibold ${
                              token.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {token.is_active ? 'Active' : 'Inactive'}
                            </div>
                            {token.is_real_crypto && (
                              <div className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-xs font-semibold">
                                🔴 LIVE
                              </div>
                            )}
                          </div>
                          <div className="text-sm text-gray-400 truncate">{token.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {token.is_real_crypto ? (
                              <span>Live price from Binance</span>
                            ) : (
                              <span>Starting Price: ${token.initial_price.toFixed(2)}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleOpenSettings(token)}
                          className="px-4 py-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          ⚙️ Settings
                        </button>
                        <button
                          onClick={() => handleToggleToken(token)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            token.is_active
                              ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30'
                              : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          }`}
                        >
                          {token.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleDeleteToken(token.id)}
                          className="px-4 py-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-sm font-semibold transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {settingsToken && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50 max-w-md w-full shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl font-bold">Token Settings</h3>
                <button
                  onClick={() => setSettingsToken(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                {/* Token Info */}
                <div className="bg-[#0a0c12] rounded-xl p-4 border border-gray-700/50">
                  <div className="flex items-center gap-3 mb-2">
                    {settingsToken.logo_url ? (
                      <img
                        src={settingsToken.logo_url}
                        alt={settingsToken.symbol}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0000FF] to-[#4444FF] flex items-center justify-center">
                        <span className="text-white font-bold text-sm">{settingsToken.symbol.slice(0, 2)}</span>
                      </div>
                    )}
                    <div>
                      <div className="font-bold text-lg">{settingsToken.symbol}</div>
                      <div className="text-sm text-gray-400">{settingsToken.name}</div>
                    </div>
                  </div>
                </div>

                {/* Max Leverage Setting */}
                <div className="bg-[#0a0c12] rounded-xl p-4 border border-gray-700/50">
                  <label className="block mb-3">
                    <div className="font-semibold text-white mb-1">Maximum Leverage</div>
                    <div className="text-sm text-gray-400 mb-3">
                      Set the maximum leverage allowed for this token (1-100x)
                    </div>
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="100"
                      value={maxLeverage}
                      onChange={(e) => setMaxLeverage(parseInt(e.target.value))}
                      className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #0000FF 0%, #0000FF ${maxLeverage}%, #374151 ${maxLeverage}%, #374151 100%)`
                      }}
                    />
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={maxLeverage}
                      onChange={(e) => setMaxLeverage(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="bg-[#090a0f] border border-gray-700 rounded-lg px-3 py-2 text-white w-20 text-center font-bold text-lg"
                    />
                    <span className="text-gray-400 font-semibold">×</span>
                  </div>
                  <div className="mt-3 text-xs text-gray-500 text-center">
                    Current: <span className="text-[#0000FF] font-bold">{maxLeverage}x</span> leverage
                  </div>
                </div>

                {/* Save Button */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setSettingsToken(null)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg px-6 py-3 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="flex-1 bg-[#0000FF] hover:bg-[#0000CC] text-white font-semibold rounded-lg px-6 py-3 transition-colors"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Config Tab */}
        {activeTab === 'config' && (
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50">
            <h3 className="text-xl font-bold mb-6">Fee Configuration</h3>
            <div className="space-y-4">
              {configs.map((config) => (
                <div
                  key={config.key}
                  className="bg-[#0a0c12] rounded-xl p-4 border border-gray-700/50 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="font-semibold">{config.key.replace(/_/g, ' ')}</div>
                    <div className="text-sm text-gray-500">
                      {config.key === 'BASE_TRADING_FEE' && 'Base trading fee percentage (0.002 = 0.2%)'}
                      {config.key === 'PROFIT_FEE' && 'Fee on profits (0.05 = 5%)'}
                      {config.key === 'FUNDING_RATE_PER_HOUR' && 'Hourly funding rate (0.0005 = 0.05%)'}
                      {config.key === 'MAX_POSITION_SIZE_PERCENT' && 'Max position size as % of portfolio (0.80 = 80%)'}
                      {config.key === 'INITIAL_CASH' && 'Starting cash for new players'}
                    </div>
                  </div>
                  <input
                    type="number"
                    step="0.0001"
                    defaultValue={config.value}
                    onBlur={(e) => handleUpdateConfig(config.key, e.target.value)}
                    className="bg-[#090a0f] border border-gray-700 rounded-lg px-4 py-2 text-white w-32 text-right font-mono"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Players Tab */}
        {activeTab === 'players' && (
          <div className="bg-gradient-to-br from-[#0f1117] to-[#0a0c12] rounded-3xl p-6 border border-gray-700/50">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-[#0000FF] to-[#0000AA] rounded-2xl flex items-center justify-center">
                <span className="text-2xl">💰</span>
              </div>
              <div>
                <h3 className="text-2xl font-bold">Bulk Balance Update</h3>
                <p className="text-gray-400 text-sm">Add balance to players below a certain threshold</p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Balance Threshold Input */}
              <div className="bg-[#0a0c12] rounded-xl p-6 border border-gray-700/50">
                <label className="block mb-3">
                  <div className="font-semibold text-white mb-1">Balance Threshold</div>
                  <div className="text-sm text-gray-400 mb-3">
                    Select players with balance below this amount
                  </div>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g., 100"
                    value={balanceThreshold}
                    onChange={(e) => {
                      setBalanceThreshold(e.target.value)
                    }}
                    onBlur={checkAffectedPlayers}
                    className="flex-1 bg-[#090a0f] border border-gray-700 rounded-lg px-4 py-3 text-white text-xl font-bold"
                  />
                </div>
                {affectedPlayers > 0 && (
                  <div className="mt-4 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="text-blue-400 font-semibold">
                      📊 {affectedPlayers} player{affectedPlayers !== 1 ? 's' : ''} will be affected
                    </div>
                  </div>
                )}
              </div>

              {/* Amount to Add Input */}
              <div className="bg-[#0a0c12] rounded-xl p-6 border border-gray-700/50">
                <label className="block mb-3">
                  <div className="font-semibold text-white mb-1">Amount to Add</div>
                  <div className="text-sm text-gray-400 mb-3">
                    How much balance to add to each selected player
                  </div>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-2xl text-green-400">+$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="e.g., 50"
                    value={balanceAmount}
                    onChange={(e) => setBalanceAmount(e.target.value)}
                    className="flex-1 bg-[#090a0f] border border-gray-700 rounded-lg px-4 py-3 text-white text-xl font-bold"
                  />
                </div>
              </div>

              {/* Apply Button */}
              <button
                onClick={handleBulkBalanceUpdate}
                disabled={isApplying || !balanceThreshold || !balanceAmount || affectedPlayers === 0}
                className="w-full bg-gradient-to-r from-[#0000FF] to-[#4444FF] hover:from-[#0000DD] hover:to-[#3333DD] disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 disabled:transform-none shadow-lg shadow-[#0000FF]/50 disabled:shadow-none"
              >
                {isApplying ? 'Applying...' : `Apply to ${affectedPlayers} Player${affectedPlayers !== 1 ? 's' : ''}`}
              </button>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div>
                    <div className="font-semibold text-yellow-400 mb-1">Warning</div>
                    <div className="text-sm text-gray-300">
                      This action will immediately add the specified amount to all players with balance below the threshold.
                      This action cannot be undone. Make sure you've entered the correct values before applying.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

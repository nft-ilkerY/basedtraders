import { useState, useEffect } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import TradingInterface from './components/TradingInterface'
import ProfileComponent from './components/Profile'
import Leaderboard from './components/Leaderboard'
import FarcasterAuth from './components/FarcasterAuth'
import AdminPanel from './components/AdminPanel'

function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'trading' | 'profile' | 'leaderboard' | 'admin'>('home')
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isSDKLoaded, setIsSDKLoaded] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Initialize SDK
  useEffect(() => {
    const load = async () => {
      try {
        // Timeout after 5 seconds if SDK doesn't load
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SDK timeout')), 5000)
        )

        const context = await Promise.race([
          sdk.context,
          timeoutPromise
        ]) as any

        if (context?.user) {
          const username = context.user.username || `user${context.user.fid}`
          const userFid = context.user.fid
          setProfile({
            fid: userFid,
            username: username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          })
          setIsAuthenticated(true)
          // Check if user FID is 326821 (admin)
          setIsAdmin(userFid === 326821)
        }

        sdk.actions.ready()

        // Auto-prompt to add miniapp on first load
        try {
          await sdk.actions.addFrame()
        } catch (error) {
          // User declined or error occurred
        }
      } catch (error) {
        console.log('SDK load error or timeout:', error)
        // SDK failed to load, but allow app to continue
      } finally {
        setIsSDKLoaded(true)
      }
    }

    load()
  }, [])

  const isLoggedIn = isAuthenticated && profile

  if (!isSDKLoaded) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#090a0f] via-[#0a0b10] to-[#0b0c11] text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#090a0f] via-[#0a0b10] to-[#0b0c11] text-white">
      {/* Modern Navigation with Glassmorphism */}
      <nav className="border-b border-gray-700/30 bg-gradient-to-r from-[#0f1117]/80 to-[#0a0c12]/80 backdrop-blur-xl fixed top-0 left-0 right-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-4">
            {/* Left side - Logo and Navigation */}
            <div className="flex items-center gap-4">
              {/* Hamburger Menu (Mobile Only - when authenticated) */}
              {isLoggedIn && (
                <div className="lg:hidden flex items-center gap-3">
                  <button
                    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    className="flex flex-col gap-1.5 w-6 h-6 justify-center"
                  >
                    <span className="w-full h-0.5 bg-white transition-all"></span>
                    <span className="w-full h-0.5 bg-white transition-all"></span>
                    <span className="w-full h-0.5 bg-white transition-all"></span>
                  </button>
                  <span className="font-bold text-lg">
                    <span className="text-[#0000FF]">Based</span> <span className="text-white">Traders</span>
                  </span>
                </div>
              )}

              {/* Logo - Hidden on mobile when logged in */}
              <button
                onClick={() => setCurrentPage('home')}
                className={`flex items-center gap-2 ${isLoggedIn ? 'hidden sm:flex' : 'flex'}`}
              >
                <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg" />
                <span className="font-bold text-lg hidden sm:inline">
                  <span className="bg-gradient-to-r from-[#0000FF] to-[#4444FF] bg-clip-text text-transparent">Based</span> Traders
                </span>
              </button>

              {/* Desktop Navigation Tabs (only when authenticated) */}
              {isLoggedIn && (
                <div className="hidden lg:flex gap-2 ml-4">
                  <button
                    onClick={() => setCurrentPage('trading')}
                    className={`py-2 px-4 border-b-2 transition-all duration-300 font-medium ${
                      currentPage === 'trading'
                        ? 'border-[#0000FF] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>📈</span>
                      Trading
                    </span>
                  </button>
                  <button
                    onClick={() => setCurrentPage('profile')}
                    className={`py-2 px-4 border-b-2 transition-all duration-300 font-medium ${
                      currentPage === 'profile'
                        ? 'border-[#0000FF] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>👤</span>
                      Profile
                    </span>
                  </button>
                  <button
                    onClick={() => setCurrentPage('leaderboard')}
                    className={`py-2 px-4 border-b-2 transition-all duration-300 font-medium ${
                      currentPage === 'leaderboard'
                        ? 'border-[#0000FF] text-white'
                        : 'border-transparent text-gray-400 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>🏆</span>
                      Leaderboard
                    </span>
                  </button>
                  {isAdmin && (
                    <button
                      onClick={() => setCurrentPage('admin')}
                      className={`py-2 px-4 border-b-2 transition-all duration-300 font-medium ${
                        currentPage === 'admin'
                          ? 'border-[#0000FF] text-white'
                          : 'border-transparent text-gray-400 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>⚙️</span>
                        Admin
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right side - Auth */}
            <div className="flex items-center gap-3">
              {isLoggedIn && profile ? (
                <div className="flex items-center gap-2 bg-gradient-to-br from-[#8a63d2] to-[#6a4bb5] px-2 py-1 rounded-lg border border-purple-400/30 lg:px-3 lg:py-2">
                  {profile.pfpUrl && (
                    <img
                      src={profile.pfpUrl}
                      alt={profile.username}
                      className="w-6 h-6 rounded-full lg:w-7 lg:h-7"
                    />
                  )}
                  <span className="text-xs font-semibold text-white hidden sm:inline lg:text-sm">
                    @{profile.username}
                  </span>
                </div>
              ) : (
                <FarcasterAuth />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Side Menu (only when authenticated) */}
      {isLoggedIn && mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="fixed left-0 top-0 bottom-0 w-64 bg-gradient-to-br from-[#0f1117] to-[#0a0c12] border-r border-gray-700/50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pt-20">
              {/* Logo */}
              <div className="flex items-center justify-center mb-8 pb-6 border-b border-gray-700/50">
                <img src="/menulogo.png" alt="Menu Logo" className="w-32 h-32 object-contain" />
              </div>
              <h3 className="text-sm font-bold mb-4 text-gray-500 uppercase tracking-wider">Menu</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setCurrentPage('trading')
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left py-3 px-4 rounded-lg transition-all ${
                    currentPage === 'trading'
                      ? 'bg-[#0000FF]/20 text-white border border-[#0000FF]/50'
                      : 'text-gray-400 hover:text-white hover:bg-[#0a0c12]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">📈</span>
                    <span className="font-medium">Trading</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('profile')
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left py-3 px-4 rounded-lg transition-all ${
                    currentPage === 'profile'
                      ? 'bg-[#0000FF]/20 text-white border border-[#0000FF]/50'
                      : 'text-gray-400 hover:text-white hover:bg-[#0a0c12]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">👤</span>
                    <span className="font-medium">Profile</span>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setCurrentPage('leaderboard')
                    setMobileMenuOpen(false)
                  }}
                  className={`w-full text-left py-3 px-4 rounded-lg transition-all ${
                    currentPage === 'leaderboard'
                      ? 'bg-[#0000FF]/20 text-white border border-[#0000FF]/50'
                      : 'text-gray-400 hover:text-white hover:bg-[#0a0c12]'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span className="text-xl">🏆</span>
                    <span className="font-medium">Leaderboard</span>
                  </span>
                </button>
                {isAdmin && (
                  <button
                    onClick={() => {
                      setCurrentPage('admin')
                      setMobileMenuOpen(false)
                    }}
                    className={`w-full text-left py-3 px-4 rounded-lg transition-all ${
                      currentPage === 'admin'
                        ? 'bg-[#0000FF]/20 text-white border border-[#0000FF]/50'
                        : 'text-gray-400 hover:text-white hover:bg-[#0a0c12]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">⚙️</span>
                      <span className="font-medium">Admin Panel</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Page Content */}
      <div className="pt-[73px]">
        {!isLoggedIn || currentPage === 'home' ? (
          <TradingInterface profile={profile} isLoggedIn={isLoggedIn} />
        ) : currentPage === 'trading' ? (
          <TradingInterface profile={profile} isLoggedIn={isLoggedIn} />
        ) : currentPage === 'profile' ? (
          <ProfileComponent profile={profile} isLoggedIn={isLoggedIn} />
        ) : currentPage === 'leaderboard' ? (
          <Leaderboard />
        ) : currentPage === 'admin' && isAdmin ? (
          <AdminPanel fid={profile.fid} />
        ) : (
          <TradingInterface profile={profile} isLoggedIn={isLoggedIn} />
        )}
      </div>
    </div>
  )
}

export default App

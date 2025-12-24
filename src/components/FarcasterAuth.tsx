export default function FarcasterAuth() {
  const handleClick = () => {
    window.location.href = 'https://farcaster.xyz/miniapps/GlmJsUyW-yPo/based-traders'
  }

  return (
    <button
      onClick={handleClick}
      className="bg-[#8a63d2] hover:bg-[#7a53c2] text-white font-semibold py-2 px-4 rounded-xl transition-colors"
    >
      Sign In
    </button>
  )
}

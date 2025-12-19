// Rank System
export function getRankByPosition(position: number): string {
  if (position === 1) return '🥇 Champion'
  if (position === 2) return '🥈 Master'
  if (position === 3) return '🥉 Expert'
  if (position >= 4 && position <= 10) return '💎 Diamond'
  if (position >= 11 && position <= 25) return '💠 Platinum'
  if (position >= 26 && position <= 100) return '⭐ Gold'
  if (position >= 101 && position <= 250) return '🔷 Silver'
  if (position >= 251 && position <= 1000) return '🔶 Bronze'
  if (position > 1000) return '⚔️ Warrior'
  return 'Unranked'
}

export function calculateRank(submittedCash: number, allPlayers: { address: string, submitted_cash: number }[]): { rank: string, position: number } {
  // Sort players by submitted_cash (highest first)
  const sortedPlayers = allPlayers
    .filter(p => p.submitted_cash > 0)
    .sort((a, b) => b.submitted_cash - a.submitted_cash)

  // Find position (1-indexed)
  const position = sortedPlayers.findIndex(p => p.submitted_cash === submittedCash) + 1

  if (position === 0) {
    return { rank: 'Unranked', position: 0 }
  }

  return {
    rank: getRankByPosition(position),
    position
  }
}

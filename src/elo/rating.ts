// Standard ELO math. E = expected score, R' = R + K*(S - E).
// Referensi umum (chess-style), disesuaikan K-tier di config/elo.json.

export interface KTier { max_games: number | null; k: number; label: string; }

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function kFactor(gamesPlayed: number, tiers: KTier[]): number {
  for (const t of tiers) {
    if (t.max_games === null || gamesPlayed < t.max_games) return t.k;
  }
  return tiers[tiers.length - 1].k;
}

// sA = 1 (menang), 0.5 (draw), 0 (kalah) -- dari sudut pandang A.
export function updateRating(ratingA: number, ratingB: number, sA: number, k: number): number {
  const eA = expectedScore(ratingA, ratingB);
  return Math.round(ratingA + k * (sA - eA));
}

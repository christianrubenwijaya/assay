// Rank tier (Perunggu/Perak/Emas/Platina) -> nentuin brief pool yang "sah" buat tier itu.
// PROVISIONAL -- lihat _rank_tiers_note di config/elo.json. Jangan aktifin tier di atas
// Perunggu buat event beneran sampai brief 02/03/10 punya dummy validation.
export interface RankTier { name: string; min_rating: number; briefs: string[]; }

export function tierFor(rating: number, tiers: RankTier[]): RankTier {
  const sorted = [...tiers].sort((a, b) => b.min_rating - a.min_rating);
  return sorted.find(t => rating >= t.min_rating) ?? sorted[sorted.length - 1];
}

// Rank tier (Perunggu/Perak/Emas/Platina) -> nentuin brief pool yang "sah" buat tier itu.
// UPDATE 2026-07-11: gate brief 02/03/10 (dummy validation lewat harness beneran) SUDAH
// TERPENUHI -- npm run selftest:briefs 100% lulus. Tier di atas Perunggu boleh diaktifin.
// min_rating threshold masih tebakan awal, belum dikalibrasi -- lihat _rank_tiers_note
// di config/elo.json + README "Rating (ELO)"/"Known gaps".
export interface RankTier { name: string; min_rating: number; briefs: string[]; }

export function tierFor(rating: number, tiers: RankTier[]): RankTier {
  const sorted = [...tiers].sort((a, b) => b.min_rating - a.min_rating);
  return sorted.find(t => rating >= t.min_rating) ?? sorted[sorted.length - 1];
}

// Matchmaking buat 1 ROUND (bukan queue realtime -- Season 0 formatnya event/Jam
// terjadwal, bukan ladder yang orang bisa masuk kapan aja. Realtime queue butuh infra
// yang gak sepadan buat budget/skala sekarang -- lihat README).
//
// Algoritma: sort by rating, pair adjacent (greedy), skip pasangan yang UDAH pernah
// ketemu (dari `playedPairs`) dengan geser ke kandidat rating-terdekat berikutnya yang
// belum pernah lawan. ~mirip Swiss pairing sederhana, cukup buat puluhan peserta/N ronde
// kecil. Peserta ganjil -> 1 orang dapet BYE (auto, gak ngefek rating, ditandain explicit).
import type { PlayerRecord } from "./store.js";

export interface Pair { a: string; b: string; ratingGap: number; }
export interface PairingResult { pairs: Pair[]; bye: string | null; }

function pairKey(a: string, b: string): string { return [a, b].sort().join("::"); }

export function pairRound(players: PlayerRecord[], playedPairs: Set<string> = new Set()): PairingResult {
  const sorted = [...players].sort((x, y) => y.rating - x.rating);
  const remaining = new Set(sorted.map(p => p.id));
  const byId = new Map(sorted.map(p => [p.id, p]));
  const pairs: Pair[] = [];
  let bye: string | null = null;

  for (const p of sorted) {
    if (!remaining.has(p.id)) continue;
    remaining.delete(p.id);
    // cari kandidat rating-terdekat di antara yg masih remaining, yg belum pernah lawan
    const candidates = [...remaining].map(id => byId.get(id)!).sort((x, y) => Math.abs(x.rating - p.rating) - Math.abs(y.rating - p.rating));
    let opp: PlayerRecord | undefined = candidates.find(c => !playedPairs.has(pairKey(p.id, c.id)));
    if (!opp) opp = candidates[0]; // semua kandidat udah pernah lawan (pool kecil) -- lebih baik rematch drpd gak main
    if (!opp) { bye = p.id; continue; } // gak ada kandidat sama sekali -> peserta ganjil terakhir, BYE
    remaining.delete(opp.id);
    pairs.push({ a: p.id, b: opp.id, ratingGap: Math.abs(p.rating - opp.rating) });
  }
  return { pairs, bye };
}

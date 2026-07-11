// Spearman rank correlation -- dipakai buat VALIDASI, bukan buat skoring submission.
// Tujuan: buktiin urutan skor yang dihasilkan harness match urutan kualitas yang
// disepakati manusia (golden set). Rating (Bible §6: "FIDE buat AI piloting") cuma
// valid kalau harness konsisten SETUJU sama penilaian manusia soal siapa lebih baik --
// bukan cuma "harness jalan tanpa crash".

export interface RankedItem { id: string; score: number; expectedRank: number; }

function rankOf(values: number[]): number[] {
  // rank 1 = terbaik (nilai tertinggi). Ties dapet rank rata-rata (standard Spearman tie handling).
  const idx = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const ranks = new Array(values.length).fill(0);
  let i = 0;
  while (i < idx.length) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1].v === idx[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-indexed
    for (let k = i; k <= j; k++) ranks[idx[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

// rho = 1 - (6 * sum(d^2)) / (n * (n^2 - 1)), pakai average-rank formula biar valid saat ada ties.
export function spearman(items: RankedItem[]): { rho: number; n: number } {
  const n = items.length;
  if (n < 2) return { rho: NaN, n };
  const harnessRanks = rankOf(items.map(x => x.score));
  const expectedRanks = rankOf(items.map(x => -x.expectedRank)); // expectedRank 1=terbaik juga
  let sumD2 = 0;
  for (let i = 0; i < n; i++) { const d = harnessRanks[i] - expectedRanks[i]; sumD2 += d * d; }
  const rho = 1 - (6 * sumD2) / (n * (n * n - 1));
  return { rho, n };
}

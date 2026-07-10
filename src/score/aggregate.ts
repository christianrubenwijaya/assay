// Skoring 2 tahap:
// 1) harness sub-score: renormalize di antara harness_components yang BENERAN dihitung
//    run ini (mis. build/smoke/spec_seed -- perf & a11y saat ini di-nol-in di weights.json
//    karena belum diimplementasi, lihat README "Known gaps").
// 2) track-level score: gabungin `harness` dengan komponen ekstra yang BENERAN ada
//    (panel/human -- lewat `extra`), lalu renormalize LAGI di level track supaya
//    komponen yang belum jalan gak diam-diam nge-cap skor akhir (mis. competitive
//    kecap max ~70, final max ~60 kalau panel/human dianggap "ada" padahal kosong).
export function aggregate(
  present: Record<string, number>,
  harnessComponents: Record<string, number>,
  track: string,
  tracks: Record<string, Record<string, number>>,
  extra: Record<string, number> = {}
): { score: number; harness: number; components: Record<string, number> } {
  let wsum = 0, ssum = 0;
  for (const k of Object.keys(present)) { const w = harnessComponents[k] ?? 0; wsum += w; ssum += w * present[k]; }
  const harness = wsum > 0 ? ssum / wsum : 0;

  const tw = tracks[track] ?? { harness: 1 };
  const trackVals: Record<string, number> = { harness, ...extra };
  let twsum = 0, tssum = 0;
  for (const k of Object.keys(trackVals)) { const w = tw[k] ?? 0; twsum += w; tssum += w * trackVals[k]; }
  const finalFrac = twsum > 0 ? tssum / twsum : harness;

  const score = Math.round(finalFrac * 100);
  return { score, harness: Math.round(harness * 100), components: present };
}

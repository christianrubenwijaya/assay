export function aggregate(
  present: Record<string, number>,
  harnessComponents: Record<string, number>,
  track: string,
  tracks: Record<string, Record<string, number>>
): { score: number; harness: number; components: Record<string, number> } {
  let wsum = 0, ssum = 0;
  for (const k of Object.keys(present)) { const w = harnessComponents[k] ?? 0; wsum += w; ssum += w * present[k]; }
  const harness = wsum > 0 ? ssum / wsum : 0;
  const tw = tracks[track] ?? { harness: 1 };
  const score = Math.round(harness * (tw.harness ?? 1) * 100);
  return { score, harness: Math.round(harness * 100), components: present };
}

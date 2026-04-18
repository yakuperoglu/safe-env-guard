# Local Try Demo

Bu klasor, `safe-env-guard` davranisini lokal olarak hizlica denemek icin hazirlandi.

## Komutlar

- `npm run demo:ok`  
  Basarili senaryo. `.env.example` ve `.env` uyumlu oldugu icin validasyon gecer.

- `npm run demo:missing`  
  Eksik env degiskeni senaryosu. Hata raporu basar ve process `exit(1)` ile kapanir.

- `npm run demo:strict`  
  Strict mode senaryosu. `.env.example` olmadigi icin hata verip `exit(1)` yapar.

## Not

PowerShell'de son cikis kodunu gormek icin:

```powershell
echo $LASTEXITCODE
```

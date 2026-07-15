# Noll33 — byggd sajt

Statisk produktionssajt (startsida + subsidor + produktkatalog), byggd i vanilla HTML/CSS/JS. Reproduktion av Atelier Motion-handoffen i mappen "Noll33.se startsida redesign/".

## Filer
- `index.html` — hela sajten (sidväxling via JS)
- `site.css`, `site.js` — stil och logik (versionsfrågesträng bustar cache)
- `katalog-data.js` — genererad demodata (`window.NOLL33_*`); byts i drift mot bygget ur TopTex-syncen
- `assets/` — bilder, video, logotyper
- `serve.mjs` — lokal statisk server för utveckling

## Kör lokalt
```
node serve.mjs
```
Serverar på http://127.0.0.1:8899 (no-store, så en omladdning hämtar alltid ny CSS/JS).

## Deploy
Statisk sajt — peka värdens (Vercel) Root Directory till `sajt/`. Inget byggsteg.

## Integrationer
- Offertkorg → Supabase edge function `noll33-inquiry` (Noll33:s eget projekt).
- "Designa med tryck" → PRNTR-studion (`prntr.dahlquist.se/?from=noll33&...`); avstängd ("kommer snart") tills studion släpps publikt.

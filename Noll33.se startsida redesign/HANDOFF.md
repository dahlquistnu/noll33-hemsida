# HANDOFF — Noll33.se startsida

> Läs den här filen först. Den beskriver **nuläget** så en ny session kan fortsätta utan gammal chatthistorik. Öppna `Noll33 Startsida - Förslag.dc.html` för att se sidan live.

## ⏭️ NÄSTA STEG — todo 37 del 2 (säg "fortsätt med todo 37 del 2")
Matcha varje **koncepts undersidor** (innehållsbredd) mot konceptets EGNA startsidebredd. KLART: (1) header-bredd per koncept (Atelier 2040, Kollektion 1600, Magasin 1600) och (3) mindre hero-rubriker på Magasin+Atelier-undersidorna. KVAR: **(2) innehållsbredd** — undersidorna har blandad max-width (Design Studio/apply 1080, Förädling/Kontakt 1240, Hållbarhet 1240, Om oss 1160, Sortiment/katalog full-bleed). Sätt varje koncepts undersidor till konceptets startsidebredd: **Atelier 2040px**, **Kollektion 1600px**, **Magasin 1600px** (behåll `margin:0 auto`). Blocken ligger i `Noll33 Startsida - Förslag.dc.html` som `<sc-if value="{{ isForadling }}">`/`isHallbarhet`/`isKontakt`/`isAbout`/`isApply`, var och en med 3 underblock (isA/isC/isD). Ett koncept i taget, `ready_for_verification` efter varje.

---

## 0. Snabbstart
- **Fortsätta bygga:** §3 (huvudfil + arkitektur) och §7 (arbetssätt).
- **Öppna punkter att göra först:** §6 (todo 27 + 28).
- **Deploya om till Vercel:** §5.
- **Figma / Fable-material:** §8 (export-paketet `noll33-handoff/`) + §9 (Fable-prompt).

---

## 1. Om kunden
**Noll33** — textilförädling till **återförsäljare**, Borås. Affärsmodell: "du säljer vidare, vi förädlar". Sex förädlingsmetoder: **screentryck, screentransfer, DTG, transfer (DTF), brodyr, vävda märken**. De har en egen designmodul, **PRNTR Studio** (separat React-app, repo `dahlquistnu/printrstudio`, live på `prntr.dahlquist.se`) som ska integreras i sajten och bli en SaaS-produkt — håll den separat från själva hemsidan.

## 2. Designsystem (bindande)
### Typsnitt (Google Fonts)
- **Hanken Grotesk** 400/500/600/700/800 + italic 400 — primärt (UI, brödtext, de flesta rubriker).
- **Albert Sans** 400–700 — Atelier feature-rubriker.
- **Instrument Serif** / **Bricolage Grotesque** — redaktionella/display-accenter.

### Färger per koncept
| Roll | Atelier (A) | Kollektion (C) | Magasin (D) |
|---|---|---|---|
| Bakgrund | `#FAFAF7` off-white | `#EEF2F2` sval | `#F4EFE4` beige |
| Accent | `#B8860B` antik-guld | `#23416E` marin | `#8A4650`/`#8A3344` vinröd |
| Text | `#14181A` | `#14181A` | `#14181A` |
Gemensamt: text dämpad `#5A615C`, kantlinje varm `#E3DECF`.

### Regler
- Allt byggs som **Design Components (`.dc.html`) med inline-styles** (inga stylesheets/CSS-klasser).
- Små ändringar: rör bara det som efterfrågas. Punktändringar via `dc_html_str_replace` / `dc_js_str_replace`.

## 3. Huvudfil — `Noll33 Startsida - Förslag.dc.html` ⭐
En fil, **3 koncept** växlas med väljaren nere till höger. State `this.state.variant`: **A = Atelier**, **C = Kollektion**, **D = Magasin**. (Plattform `B` och Studio `E` är **arkiverade** i `Noll33 Startsida - 5 koncept (arkiv).dc.html` — finns kvar i koden men borttagna ur väljaren.)

### Arkitektur / navigering
- **`this.state.page`**: `'home'` | `'catalog'` | `'apply'` | `'foradling'` | `'hallbarhet'` | `'kontakt'` | `'about'`. När en undersida är aktiv **avmonteras heminnehållet** (så bara en scrollbar finns → loggan hoppar inte i sidled).
- **Delad header:** `Noll33 Header.dc.html` (via `<dc-import concept="…" active="…">`). Renderar **varje koncepts exakta header** — Atelier: `NOLL33.`-wordmark (guld `#B8860B`) + Sök/Logga in/Kundvagn; Kollektion: cirkellogga + navyblå "Bli kund"; Magasin: cirkellogga + versal nav. Klick på logga/`data-gohome` → hem.
- **Klick-routing** (i `_applyClick`, document-nivå, textbaserad): "Bli kund/Bli återförsäljare/Design Studio" → `apply`; "Plaggen vi förädlar" → `catalog`; basplagg-kort & kategori-listor → `catalog` med rätt kategori (via props `initial-main`/`initial-sub`, karta `_bc`).
- **Reveal-effekter:** Atelier editorial-rader glider ihop **horisontellt** (`.ed-slide.ed-left/.ed-right`) först vid scroll (armas på första scroll). Sortiment-bandet (fullbredds-flatlay `Mockup 11`, parallax) har opacitets-fade + `opacity:.82`.
- **Video:** alla `<video data-rate>` — `_setRates()` tvingar `muted`+`loop`+playbackRate och **pausar videor utanför skärmen** (IntersectionObserver) så sidan inte fryser.

### Kataloger & flöden (egna DC-filer, mountade i huvudfilen)
- **`Produktkatalog.dc.html`** — öppnas som helskärms-overlay (z-index 2500). Tvånivå-kategorier (huvud: Kläder/Huvudbonader/Väskor → subkategorier), sök, sortering, produktvy med storlekar, och **PRNTR Design Studio-vy** (recolorbar tröja, tryckmetoder, motiv, live-pris). **Representativ Toptex-data** (riktig API-koppling är ett dev-steg senare). Läser `initial-main`/`initial-sub` för att öppna på rätt kategori. Tema via `concept`-prop (`.theme-c`/`.theme-d`).
- **Återförsäljar-ansökan** (`apply`-sidan, i huvudfilen) — koncept-temad, fält: Företagsnamn/Org.nr/Kontaktperson/E-post/Telefon → "Tack, vi återkommer inom 1–2 dagar". Design Studio-filmen visas överst.

### Videor (hostade på Cloudinary — cloud `e9t94hoz`)
Externa `https://res.cloudinary.com/e9t94hoz/video/upload/<PublicID>.mp4` (gjordes för att bundlen skulle bli liten nog för Vercel):
- Header-video (Magasin hero, ultra-wide) · Design Studio-film (Atelier/Kollektion/Magasin-kort + apply) · Kollektion-hero ("Tjej med tryck") · brodyr-video (Magasin) — brodyr kan ligga lokalt (liten).

## 4. Print Drop-animationen — `Print Drop.dc.html`
Fristående. Boomerang-video (canvas, `tee-fr1.jpg`+`tee-fr2.jpg`) + 12 tryckmotiv som flyger in och följer rörelsen. `Print Drop (standalone).html` = offline-version. (Inte inlagd i startsidan.)

## 5. Deploy — Vercel (via GitHub) ✅ LIVE
Sajten är **deployad**. Single-file-bundling (`bundle_project`) fungerar INTE — designen har för många assets (>30 MiB inbäddat). **Rätt väg: deploya projektmappen som Git-repo.** Repo finns; videorna ligger externt (Cloudinary) så mappen är liten. Vid ny deploy: commita ändrade filer + push → Vercel auto-deployar. (Root Directory i Vercel = projektmappen.)

## 5b. Undersidor per koncept ✅ KLART
Alla undersidor är uppdelade i egna koncept-layouter (sc-if isA/isC/isD, matchar startsidan): **Förädling, Hållbarhet, Kontakt** samt **Om oss** (`aboutA/C/D`) och **Design Studio/ansökan** (`applyA/C/D`). Atelier = redaktionell/guld `#B8860B`/Albert Sans, Kollektion = rundade navy `#23416E`-kort, Magasin = skarp/vinröd `#8A3344`/N°-masthead. (Apply-sidans yttre wrapper + "Tack"-bekräftelse + Design Studio-filmband använder `{{ theme.* }}` men de resolvas per koncept korrekt.)

## 6. ÖPPNA PUNKTER (gör dessa)
**Todo 27 — tjock linje vid Sortiment-klick.** När katalog-overlayt öppnas blinkar en tjock linje till i headern (GPU repaint-flash; layouten är stabil 92px så den syns EJ i `getBoundingClientRect` — **verifiera visuellt i webbläsaren**). Testat utan resultat: `box-shadow`, `translateZ(0)`. Nästa ansats: gör katalog-headern **icke-sticky**, eller bygg om overlayt (fixed z2500 + `overflow-y:scroll` + sticky Noll33 Header ger flashen).

**Todo 28 — Magasin-mosaik 9×3.** "Allt vi rör vid"-mosaiken visar nu **2 rader**. Målet: **9 kolumner × 3 rader**. Grid är redan `repeat(9,1fr)`, MEN bygg-JS:en ritar ett **fast antal rutor (18)** — så `this._mosaicImgs` (~rad 1533) räcker inte att utöka; **själva bygg-loopen/antalet måste ändras till 27**. Baka de **9 nya bilderna** (redan i `uploads/`: brodyr-keps, svart pikémockup, screentryck-ros, `Namnlös …`-serien, `pexels-artempodrez`, `pexels-johndetochka`, `tees-please` YOUR BRAND) till nedskalade jpg i `assets/` (baka i **småbatchar 2–3 st**, annars timeout) och lägg in 27 UNIKA (inga dubbletter).

## 7. Arbetssätt
- `.dc.html` + inline-styles. Efter arbete: `ready_for_verification`.
- Bildbearbetning: `run_script` + canvas (nedskalning, keying). Filnamn med **å/ö/mellanslag** kraschar `run_script` → kopiera först till rena namn.
- Hot-reload kör INTE om `componentDidMount` — helomladdning krävs för ändringar där.

## 8. Export-paket — `noll33-handoff/` (Figma)
`DESIGNSPEC.txt` (färger/typsnitt) · `motiv/` (tryckmotiv som PNG) · `design-filer/` (källfiler) · `fable/` (prompt + stills). Skapa color/text styles enligt DESIGNSPEC, dra in motiv-PNG:er.

## 9. Fable (generativ video)
Separat verktyg. Image-to-video från still i `fable-export/`. Prompt: modellen andas subtilt, trycket sitter fast och följer tyget, matt/inbäddat, statisk kamera, 4 s. Negativ: sliding/warping/glossy/flicker/morph. Kort klipp, ett tryck/klipp, stort motiv överlever.

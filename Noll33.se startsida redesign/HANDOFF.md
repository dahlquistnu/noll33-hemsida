# HANDOFF — Noll33.se startsida redesign

> Läs den här filen först. Den sammanfattar **allt** i projektet så du (eller en ny session) kan fortsätta utan att gå igenom gammal chatt-historik — särskilt för att jobba vidare i **Figma** och **Fable**. Alla filer ligger kvar i projektet.

---

## 0. Snabbstart — så fortsätter du

- **Vill du jobba i Figma?** → gå till §2 (Designsystem/spec) + §9 (export-paketet `noll33-handoff/`). Där finns färger, typsnitt, typskala och alla motiv som PNG.
- **Vill du köra video i Fable?** → gå till §6. Prompt + inställningar + färdiga input-bilder.
- **Vill du fortsätta bygga här (HTML)?** → gå till §3–§4 och §10 (arbetssätt).
- **Vill du ha allt som en nedladdning?** → mappen `noll33-handoff/` är packad för det (be om nedladdning).

---

## 1. Om kunden
**Noll33** — textilförädling & journal till återförsäljare, baserade i Borås. Förädlar plagg med **screentryck, DTG, transfer (DTF), brodyr och vävda märken**. Affärsmodell: säljer via återförsäljare ("du säljer vidare, vi förädlar").

## 2. Designsystem (bindande visuell stil) — **Figma-spec**

### Typsnitt (Google Fonts)
- **Hanken Grotesk** — 400/500/600/700/800 + italic 400. *Primärt* — UI, brödtext, de flesta rubriker.
- **Albert Sans** — 400/500/600/700. Feature-rubriker (variant A "Design Studio").
- **Bricolage Grotesque** — 500/600/700/800. Display-rubriker i vissa koncept.
- **Instrument Serif** — roman + italic. Redaktionella accenter/kursiv.

Import-URL (klistra in i kod, eller matcha i Figma):
`https://fonts.googleapis.com/css2?family=Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=Instrument+Serif:ital@0;1&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&family=Albert+Sans:wght@400;500;600;700&display=swap`

### Färger (Figma color styles)
| Roll | Hex |
|---|---|
| Guld / accent (primär) | `#F4B300` |
| Guld varm (Print Drop) | `#D8A93A` |
| Off-white bakgrund | `#FAFAF7` |
| Text nästan-svart | `#14181A` |
| Text dämpad | `#5A615C` |
| Text dämpad (länk/meny) | `#6A6F69` |
| Varm kantlinje | `#E3DECF` |
| Mörk bakgrund | `#0E0F11` (≈ `#0d0d10`) |
| Variant B bakgrund | `#EBEFEF` |
| Variant D bakgrund (beige) | `#F4EFE4` |
| Variant E accent (rosé) | `#B14A5C` |

### Typskala (så den används i sidan)
- Hero H1: `clamp(...)` upp till ~64–72px, weight 700–800, letter-spacing −0.02em.
- Sektionsrubrik: `clamp(26px, 2.6vw, 50px)`, weight 600–800.
- Kort-rubrik: 24px/700.
- Brödtext: 15–18px/1.6, weight 400.
- Eyebrow/label: 10–11px, weight 600–700, letter-spacing 0.16–0.2em, UPPERCASE.
- Knapp/pill: 13–14.5px, weight 600–700, border-radius 999px.

### Regler
- **Allt byggs som Design Components (`.dc.html`) med inline-styles** (inga stylesheets/CSS-klasser).
- Projektets kopplade designsystem är visuell referens — utforska det innan nya visuals byggs.

## 3. Startsidan — `Noll33 Startsida - Förslag.dc.html` ⭐
Huvudfilen. **5 kompletta koncept** av startsidan i EN fil, växlas med koncept-väljaren nere till höger (prop `showSwitcher`; startkoncept via prop `startVariant`, default `A`). State: `this.state.variant` ('A'–'E'). Alla följer samma designsystem men har egen hero/layout/ton:

| Variant | Namn | Bakgrund/känsla |
|---|---|---|
| A | **Atelier** | Ljus `#FAFAF7`, redaktionell, standardval |
| B | **Plattform** | Ljusgrå `#EBEFEF`, produkt/SaaS-känsla |
| C | **Kollektion** | Ljus, produktfokus (250+ basplagg) |
| D | **Magasin** | Varm beige `#F4EFE4`, tidnings-/journalkänsla |
| E | **Studio** | Mörk `#0E0F11`, COI-inspirerad |

- Varje koncept har en **egen logo-ticker** (leverantörslogotyper) anpassad till konceptet.
- Sid-animationer (`@keyframes n33-*` i `<helmet>`): `n33-up`, `n33-fade`, `n33-marquee` (ticker), `n33-glare`, `n33-squeegee` (screentryck), `n33-stitchgrow` + `n33-needle` (brodyr), `n33-logoswap`, `n33-spinin`. Respekterar `prefers-reduced-motion`.
- Scroll-reveal via `[data-reveal]` (IntersectionObserver) och `[data-parallax]`.
- Logotyper i `uploads/logos/` och `uploads/`. Vissa har vit bakgrund borttagen.
- **För Figma:** öppna filen och växla koncept för att se var och en live (skärmbilder kunde inte fångas automatiskt i den här sessionen — öppna filen och skärmklipp de koncept du vill återskapa).

## 4. Print Drop-animationen — `Print Drop.dc.html` ⭐
Mest bearbetade filen. En **boomerang-video** (kvinna i grå t-shirt) som spelas fram→åter och loopar sömlöst i 60fps. (Webbläsare kan inte spela video baklänges, så videons bildrutor ritas fram-och-åter på en `<canvas>`; bildarken är `assets/tee-fr1.jpg` + `tee-fr2.jpg`.)

Ovanpå tröjan flyger **12 tryckmotiv** in ett i taget, pressas ner i tyget (multiply-inbländning + mjuk kontaktskugga) och **följer hennes rörelse dämpat** (utslätad rörelsekurva, `damp 0.42`). Ingen rotation. Placeringar varierar: stort centrerat, vänster bröst, höger bröst.
- Motiv: PEAK (screentryck), fågel, måne (DTG), jordgubbe, asterisk, löv, coastal-badge, blomma, "hey", signatur (Josefine), PRNTR/Resurs11, noll33-patch (vävt märke). **Sköldpaddan borttagen** (gick inte att klippa ur rent mot vattnet).
- Tweak: `showCaptions` (visa/dölj etiketter). Rörelse/tempo styrs i `componentDidMount` (`this.CYCLE`, `this.damp`, `_fly`).
- **Viktigt:** ändringar i `componentDidMount` (rörelsekurva/tempo) slår igenom först vid **full omladdning**, inte hot-reload.
- `Print Drop (standalone).html` = inbakad offline-version (öppna i webbläsare, spela upp, skärminspela).

## 5. Övriga filer
- `Fable Kit.dc.html` — samlad Fable-sida: kopierbar prompt + negativ prompt, alla 12 motiv (klickbara), inställningar och källvideon.
- `Screentryck Mockup.dc.html`, `Screentryck Mockup v2.dc.html`, `Screentryck Still.dc.html` — utforskningar av screentryck-mockup på plagg.
- `Typsnittsförslag.dc.html` — typsnittsförslag.
- `embroidery-render.html` / `embroidery-render.png` — brodyr-render.
- `Mejl till kund - material.txt` — färdigt mejl som ber kunden om material (produktionsfoton, kunduppdrag, teamfoton, texter/fakta, certifieringar, FAQ).
- `uploads/` — alla tryckmotiv, logotyper, källvideon (`6787106-uhd_3840_2160_30fps.mp4`). `assets/` — bearbetade bilder + video-frames.
- `fable-export/` — Fable-input: `still-peak.png` (hjälte-still), `flyin/01–07.png` (inflygningssekvens), `stills/` (5 produkt-stills).

## 6. Fable (generativ video) — trycket på riktig video
**Fable är ett separat, generativt video-verktyg** (inte den här design-miljön; inte samma sak som Claude/Opus som bygger här). Kör **image-to-video** från en still i `fable-export/`.

**Prompt (engelska — Fable lyssnar bäst så):**
```
The model breathes and shifts her weight very subtly; the cotton t-shirt moves
and folds naturally with her body. The printed design stays locked to the same
spot on the chest and conforms to the fabric — flexing over the folds, matte and
absorbed into the cotton, never sliding or floating. Soft studio light, static
camera, shallow depth of field. Gentle, premium, photoreal. 4 seconds.
```
**Negativ prompt:**
```
print sliding, warping logo, distorted text, glossy sticker, floating decal,
drop shadow halo, flickering, duplicated print, morphing, extra hands,
face distortion, camera movement, zoom
```
**Inställningar:** image-to-video (inte text-to-video) · kort klipp 3–5 s · ett tryck per klipp, klipp ihop flera · statisk kamera, liten rörelse · stort/enkelt motiv överlever, finstilt smetar · format 3:4 eller 1:1.
**Ärlig begränsning:** generativ video håller inte ett tryck 100% stilla — för exakt varumärkes-återgivning krävs tracking i After Effects/Mocha.

## 7. Status
**Klart:** 5 startsidekoncept med tickers · Print Drop-animationen (sömlös 60fps, tryck följer rörelsen) · Fable Kit + export + prompt · kundmejl · komplett handoff + export-paket.

## 8. Nästa steg (förslag)
- Välja/vidareutveckla ett av de 5 koncepten till en färdig startsida.
- Ev. koppla in Print Drop-animationen som en sektion i valt koncept.
- Fylla in riktiga material när kunden svarat på mejlet (produktionsfoton, teamfoton, kundcitat, siffror).
- Köra trycken i Fable för fotorealistisk video (§6), återskapa valt koncept i Figma (§2 + §9).

## 9. Export-paket — `noll33-handoff/` (för Figma + Fable)
Allt relevant samlat i en mapp, redo att laddas ner som zip:
```
noll33-handoff/
  HANDOFF.md            — den här filen
  DESIGNSPEC.txt        — färger, typsnitt, typskala (för Figma color/text styles)
  motiv/                — 12 tryckmotiv som transparent PNG (placeras i Figma/på mockups)
  fable/
    prompt.txt          — prompt + negativ prompt + inställningar
    kallvideo.mp4       — 4K-källvideo (modell i enfärgad t-shirt)
    stillbilder/        — färdiga input-stills (motiv på tröjan) + inflygningssekvens
  design-filer/         — .dc.html-källfiler + Print Drop (standalone).html för referens
```
**I Figma:** skapa color styles och text styles enligt `DESIGNSPEC.txt`; dra in `motiv/`-PNG:erna som komponenter/assets; öppna `design-filer/` i webbläsare som visuell referens när du återskapar layouten.
**I Fable:** använd `fable/stillbilder/still-peak.png` som image-to-video-input med prompten i `fable/prompt.txt`.

## 10. Arbetssätt (om du fortsätter bygga HTML här)
- Bygg allt som `.dc.html` med inline-styles (inga stylesheets/CSS-klasser).
- Små ändringar: ändra bara det som efterfrågas, rör inte övrig layout.
- Punktändringar: `dc_html_str_replace` (mall) / `dc_js_str_replace` (logik).
- Efter arbete: `ready_for_verification`.
- Bild-urklipp/bearbetning: `run_script` med canvas (så gjordes motiv-keying, video-frames, sköldpaddsförsöken).

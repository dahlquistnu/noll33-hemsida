# Produktkatalog: brief till Claude design

> Ladda upp den här filen + `katalog-standalone.html` till design-projektet
> (samma projekt som startsidan, se HANDOFF.md där). Standalone-filen har all
> produktdata inbakad och fungerar var som helst som EN fil: öppna den i
> webbläsaren, den är facit för layout, interaktion och ton.
>
> (`katalog.html` + `katalog-data.js` är uppdelade källfiler för vidare arbete
> lokalt. Öppnas `katalog.html` utan datafilen bredvid blir katalogen tom.)

## Vad det här är

En produktkatalog för noll33.se. Kunder bläddrar bland basplagg, väljer färg
och storlek och begär offert på förädling (tryck, brodyr, vävda märken). Datat är
riktigt: 98 produkter från TopTex (leverantörens API), med riktiga packshots,
färger och publika listpriser i SEK.

## Mallprincipen (viktigast av allt)

Katalogen designas **mot ett datakontrakt, aldrig mot enskilda produkter**.
Ett (1) produktkort-komponent + en (1) detaljpanel renderar ALLA produkter,
nuvarande 98 och framtida tusentals när hela sortimentet synkas in.

Kontraktet per produkt (så ser objekten i `katalog-data.js` ut):

```
{
  id: "BE4810GD",            // artikelnummer (TopTex catalog_reference)
  name: "Thick unisex faded t-shirt",
  brand: "BELLA+CANVAS",
  family: "Kläder",           // Kläder | Huvudbonader & Accessoarer | Väskor
  image: "https://cdn.toptex.com/packshots/…",   // startbild (första färgens face)
  priceFrom: 188,             // lägsta publika listpris i SEK, kan vara null
  colors: [
    {
      name: "Black",
      hex: "#000000",
      face: "https://…",      // packshot framifrån
      back: "https://…",      // packshot bakifrån, kan vara null
      sizes: ["XS","S","M","L","XL","XXL"]
    }
  ]
}
```

Bygg aldrig något som förutsätter ett visst antal färger, storlekar eller en viss
familj. Allt hämtas ur kontraktet. Fält kan vara null (back-bild, pris), hantera det.

## Designsystem

Samma bindande system som startsidan (HANDOFF.md §2 / DESIGNSPEC.txt):

- **Typsnitt:** Hanken Grotesk, inget annat (ingen serif i katalogen)
- **Färger:** off-white `#FAFAF7` bakgrund, text `#14181A`, dämpad `#5A615C`/`#6A6F69`,
  kantlinje `#E3DECF`, accent guld `#F4B300` (ENDA accenten, används på primär-CTA)
- **Bildplatta:** `#F1EFE9` (varm ljusgrå bakom packshots)
- **Radius-regel:** interaktiva element = pill (999px), ytor/kort = 14px, thumbnails = 10px
- Ton: koncept A "Atelier", alltså redaktionell, luftig, ljus

## Vad referensen innehåller (och varför)

1. **Sidhuvud.** Eyebrow "Sortiment", rubrik "Plagg att förädla", en mening ingress.
2. **Verktygsrad.** Kategori-pills (Alla/Kläder/Huvudbonader/Väskor), märkes-select,
   sökfält, resultaträknare. Sticky-känsla är INTE nödvändig; håll den enkel.
3. **Kort-grid.** Auto-fill, minst 240px per kort, 2 kolumner på mobil. Kortet:
   packshot på platta (3:4, object-contain), hover = crossfade till back-bild
   (om den finns) + mjuk zoom, märke (litet, dämpat), namn, färgprickar (max 6, sen "+N"),
   "från X kr · storleksspann".
4. **Detaljpanel.** Öppnas vid klick, drawer från höger (fullskärm på mobil).
   Stor bild + fram/bak-thumbnails, färgväljare (prickar; vald färg byter bild och
   storlekslista), storlekar som pills (visning, ej val), pris "från X kr" med noten
   "Publikt listpris. Ditt pris med förädling lämnas i offert.", primär-CTA "Begär offert"
   (guld pill) som kopplas till offertflödet senare.
5. **Tomt läge.** "Inga produkter matchar" + "Rensa filter"-knapp.
6. **Rörelse.** Diskret: kort fadar in vid scroll, hover-crossfade. Respektera
   `prefers-reduced-motion`. Inga marquees, inga scroll-hijacks i katalogen.

## Regler (ärvda från referensen, håll dem)

- En (1) CTA-intent på sidan: "Begär offert". Ingen dubblett med annan etikett.
- Max en eyebrow. Inga dekorativa etiketter/pills OVANPÅ produktbilderna.
- Inga em-dash (—) någonstans i copy. Vanligt bindestreck.
- Alla priser heltal SEK ("från 188 kr"). Storleksspann med bindestreck ("XS-XXL").
- Färgprickar behöver 1px kantlinje (ljusa färger mot ljus bakgrund).

## Kända dataluckor

- 28 produkter saknar färgspecifika packshots (TopTex foto-avtal ej accepterat än).
  De visar produktens frontbild för alla färger: `face` är null, fall tillbaka på
  produktens `image`. När avtalet accepterats och seeden körts om får de riktiga
  färgbilder automatiskt.
- `priceFrom` är publikt listpris, INTE kundens inköpspris. Inköpspris + marginal
  hanteras i offertflödet senare.

## Uppdatera datat senare

Datat regenereras utanför design-miljön: TopTex-seeden körs om, sen
`build-demo-data.ts` som skriver en ny `katalog-data.js`. Bygg så att datafilen
kan bytas rakt av: läs bara `window.NOLL33_PRODUCTS`, hårdkoda aldrig produkter
i komponenten.

## Framtida utbyggnad (designa inte nu, men blockera inte)

- Sortering (pris/namn) i verktygsraden
- Tryckytor per plagg (`printAreas` i kontraktet, fylls av PRNTR-modulen)
- Kundspecifika priser efter inloggning
- Fler familjer när hela sortimentet synkas (pills → dropdown vid behov)

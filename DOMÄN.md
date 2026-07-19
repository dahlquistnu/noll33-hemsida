# Domänuppsättning: noll33.se

Målbild: ett domän-paraply. Besökaren möter alltid noll33.se, appen bor på en subdomän.

| Adress | Innehåll | Var den bor |
|---|---|---|
| `noll33.se` | Marknadssajten (denna repo, mappen `sajt/`) | Vercel-projekt för noll33-hemsida |
| `app.noll33.se` | PRNTR-appen: inloggning, kundportal, admin | Vercel-projektet `printrstudio` |

Sajten autentiserar aldrig själv. Alla "Logga in"-vägar skickar till appens
`/logga-in`, som role-routar: admin hamnar i `/admin`, kund i `/konto`.

## Steg 1: koppla noll33.se till sajten

1. Skapa/öppna Vercel-projektet för `noll33-hemsida` (root directory: `sajt`).
2. Vercel → Settings → Domains → lägg till `noll33.se` och `www.noll33.se`.
3. Hos domänregistraren (där noll33.se är köpt), sätt DNS enligt Vercels anvisning:
   - `noll33.se` → A-post `76.76.21.21`
   - `www` → CNAME `cname.vercel-dns.com`
4. Vänta in certifikatet (Vercel fixar automatiskt, oftast minuter).

## Steg 2: koppla app.noll33.se till appen

1. Vercel → projektet `printrstudio` → Settings → Domains → lägg till `app.noll33.se`.
2. Hos registraren: `app` → CNAME `cname.vercel-dns.com`.

## Steg 3: efterjusteringar (när DNS pekar rätt)

1. `sajt/site.js`: byt konstanten `PRNTR_STUDIO` från
   `https://printrstudio.vercel.app` till `https://app.noll33.se` (exakt ett ställe).
   Bumpa `?v=` på script-taggen i `index.html`.
2. Supabase (projekt koczj) → Authentication → URL Configuration:
   - Site URL: `https://app.noll33.se`
   - Redirect URLs: lägg till `https://app.noll33.se/**` (behåll vercel-URL:en
     under övergången).
3. Behåll `printrstudio.vercel.app` som den är: Vercel svarar på båda tills ni
   aktivt tar bort den. Gamla bokmärken fortsätter fungera.

## Vad som INTE behövs

- Ingen kodändring i appen: den är origin-oberoende.
- Ingen flytt av Supabase eller data.
- Inga nya nycklar: anon-nyckeln är publik per design och domänoberoende.

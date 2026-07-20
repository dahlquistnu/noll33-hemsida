# Domänuppsättning: noll33.se

Målbild: ett domän-paraply. Besökaren möter alltid noll33.se, appen bor på en subdomän.

| Adress | Innehåll | Var den bor |
|---|---|---|
| `noll33.se` | Marknadssajten (denna repo, mappen `sajt/`) | Vercel-projekt för noll33-hemsida |
| `app.noll33.se` | PRNTR-appen: inloggning, kundportal, admin | Vercel-projektet `printrstudio` |

Sajten autentiserar aldrig själv. Alla "Logga in"-vägar skickar till appens
`/logga-in`, som role-routar: admin hamnar i `/admin`, kund i `/konto`.

## Steg 0: publicera nya sajten (görs FÖRE domänflytten)

Nya sajten behöver en publik adress redan innan noll33.se pekas om
(noll33.se visar gamla webshopen tills dess, och adminens
"Till hemsidan"-genväg pekar på Vercel-adressen):

1. vercel.com → Add New → Project → importera `dahlquistnu/noll33-hemsida`.
2. Project Name: **noll33-hemsida** (exakt så — admin-genvägen pekar på
   `https://noll33-hemsida.vercel.app`).
3. Root Directory: `sajt`. Framework: Other (statisk, ingen build).
4. Deploy. Klart — varje push till main deployas automatiskt.

## Steg 1: koppla noll33.se till sajten

1. Öppna Vercel-projektet `noll33-hemsida` (skapat i steg 0).
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

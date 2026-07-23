/* Noll33 — Atelier Motion. Sidväxling + fullt motion-lager (portat ur design_handoff,
   ren vanilla utan dc-runtime). */
(function () {
  'use strict';

  var PAGES = ['home', 'catalog', 'apply', 'foradling', 'hallbarhet', 'kontakt', 'about', 'ansok', 'login', 'konto'];
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && window.matchMedia('(max-width: 768px), (hover: none) and (pointer: coarse)').matches;

  /* ============ Laddningsstreck ============ */
  // Tunt guldstreck överst (samma guld som headerlinjen, se #loadbar i CSS).
  // Trickle mot 90%, klart => 100% + tona ut. Startar först efter 250 ms så
  // snabba laddningar aldrig blinkar till.
  var LOADBAR = (function () {
    var el = null, timer = null, delay = null, cap = null, pct = 0, active = 0;
    function ensure() { if (!el) { el = document.createElement('div'); el.id = 'loadbar'; document.body.appendChild(el); } return el; }
    function tick() { pct += (90 - pct) * 0.16; ensure().style.width = pct + '%'; timer = setTimeout(tick, 140); }
    function begin() {
      ensure().classList.add('on'); pct = Math.max(pct, 12); ensure().style.width = pct + '%'; if (!timer) tick();
      // Säkerhetstak: strecket får ALDRIG bli stående (QA 2026-07-21:
      // "fastnar vid 80%") — efter 8 s stängs det oavsett vad som väntar.
      if (!cap) cap = setTimeout(function () { cap = null; active = 0; finish(); }, 8000);
    }
    function finish() {
      if (delay) { clearTimeout(delay); delay = null; }
      if (timer) { clearTimeout(timer); timer = null; }
      if (cap) { clearTimeout(cap); cap = null; }
      if (el && el.classList.contains('on')) {
        el.style.width = '100%';
        setTimeout(function () { el.classList.remove('on'); setTimeout(function () { el.style.width = '0'; pct = 0; }, 350); }, 250);
      } else { pct = 0; }
    }
    return {
      start: function () {
        active++;
        if (active === 1 && !delay && !timer) delay = setTimeout(function () { delay = null; if (active > 0) begin(); }, 250);
      },
      done: function () {
        active = Math.max(0, active - 1);
        if (active > 0) return;
        finish();
      }
    };
  })();

  // Vy-bilder som inte hunnit in när vyn visas (t.ex. Om oss / Hållbarhet):
  // visa strecket tills de är klara. BARA bilder nära viewporten räknas —
  // lazy-bilder under fold börjar inte laddas förrän man scrollar dit och
  // skulle annars hålla strecket öppet för evigt (QA 2026-07-21).
  function watchPageMedia(page) {
    var root = document.querySelector('.page[data-page="' + page + '"]');
    if (!root) return;
    // 1.1 viewport: bara bilder webbläsaren faktiskt börjar hämta direkt —
    // längre ner tar lazy-laddningen dem först vid scroll, och då är de
    // små nog att inte behöva något streck.
    var nearH = (window.innerHeight || 800) * 1.1;
    var pending = [].filter.call(root.querySelectorAll('img'), function (im) {
      if (!im.src || im.complete) return false;
      var r = im.getBoundingClientRect();
      return r.top < nearH;
    });
    if (!pending.length) return;
    // Tvinga igång hämtningen: lazy-bilder i en nyss dold vy får aldrig sin
    // laddning triggad av webbläsaren när vyn visas (QA 2026-07-21 — requesten
    // startade aldrig trots synlig bild). Eager på de synliga löser det;
    // bilder under fold behåller lazy och laddas vid scroll.
    pending.forEach(function (im) { im.loading = 'eager'; });
    LOADBAR.start();
    var left = pending.length;
    pending.forEach(function (im) {
      var fin = function () { im.removeEventListener('load', fin); im.removeEventListener('error', fin); if (--left === 0) LOADBAR.done(); };
      im.addEventListener('load', fin);
      im.addEventListener('error', fin);
    });
  }

  /* ============ Katalogdata på begäran ============ */
  // katalog-data.js är 6.5 MB (550 KB över nätet) — laddas först när
  // katalogen eller söket faktiskt öppnas, inte på varje sidvisning.
  // CAT.mount har redan "Laddar sortimentet…" + retry, och sökets render
  // visar samma text tills datan är inne.
  var katalogLoad = null;
  function loadKatalogData() {
    if (window.NOLL33_PRODUCTS) return Promise.resolve();
    if (katalogLoad) return katalogLoad;
    LOADBAR.start();
    katalogLoad = new Promise(function (resolve) {
      var s = document.createElement('script');
      s.src = 'katalog-data.js?v=d2';
      s.onload = s.onerror = function () { LOADBAR.done(); resolve(); };
      document.head.appendChild(s);
    });
    return katalogLoad;
  }

  /* ============ Sidväxling ============ */
  function goto(page, opts) {
    // login + kundportal renderas PÅ sajten (interim-B): sajten autentiserar
    // kund själv; admin skickas vidare till printrstudio efter verifierad login.
    if (PAGES.indexOf(page) === -1) page = 'home';
    document.querySelectorAll('.page').forEach(function (el) { el.classList.toggle('active', el.dataset.page === page); });
    document.querySelectorAll('[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === page); });
    document.body.dataset.page = page;
    if ((location.hash.slice(1) || 'home') !== page) history.replaceState(null, '', page === 'home' ? location.pathname : '#' + page);
    if (!opts || !opts.keepScroll) window.scrollTo(0, 0);
    closeMobileNav();
    // Ny vy → tagga + avslöja dess element; tickers på nyvisad sida byggs om
    // (initTicker hoppar över dolda — se kommentaren där).
    moInit(); edObserve(true); setRates(); initTicker();
    watchPageMedia(page);
    // Katalogen monteras EFTER moInit (så dess noder inte auto-taggas/döljs).
    if (page === 'catalog') { loadKatalogData(); CAT.mount(); }
    if (page === 'konto') KONTO.mount();
  }
  window.NOLL33_goto = goto;

  /* ============ Mobil-meny ============ */
  function openMobileNav() { var m = document.getElementById('mobileNav'); if (m) m.classList.add('open'); }
  function closeMobileNav() { var m = document.getElementById('mobileNav'); if (m) m.classList.remove('open'); }

  /* ============ Header-scroll + scroll-reaktiv ticker ============ */
  var lastY = null;
  function onScrollHeader() {
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var de = document.documentElement;
    if (y > 100) de.setAttribute('data-mo-scrolled', ''); else de.removeAttribute('data-mo-scrolled');
    lastY = y;
  }

  /* Kontinuerlig ticker: repetera enheten tills en halva täcker containern, dubblera för sömlös -50%-loop (ingen synlig söm oavsett bredd). */
  function initTicker() {
    document.querySelectorAll('[data-ticker]').forEach(function (t) {
      if (!t.__base) { var h0 = t.querySelector('[data-ticker-half]'); if (!h0) return; t.__base = h0.innerHTML; }
      // På en dold sida (display:none) mäter halvan 0px — upprepningen rusar då till
      // guard-taket och banan får 30+ kopior = skenande hastighet. Bygg bara synliga
      // tickers; goto() initierar om när sidan visas.
      if (!t.offsetParent) return;
      var cw = ((t.parentElement || t).getBoundingClientRect().width) || window.innerWidth || 1200;
      var half = document.createElement('div');
      half.style.display = 'flex'; half.setAttribute('data-ticker-half', '');
      half.innerHTML = t.__base;
      t.innerHTML = ''; t.appendChild(half);
      var guard = 0, hw;
      while ((hw = half.getBoundingClientRect().width) > 0 && hw < cw && guard++ < 30) { half.innerHTML += t.__base; }
      var copy = half.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); copy.removeAttribute('data-ticker-half');
      t.appendChild(copy);
    });
  }

  /* ============ PRNTR-koppling (koczj) — anon-nyckeln är publik per design ============ */
  var PRNTR_SUPABASE = 'https://koczjxjjcvgsuvdlooft.supabase.co';
  var PRNTR_ANON = 'sb_publishable_txgCWP0y-jpt6HP2rd-Uuw_3Ng8ehUb';
  var PRNTR_STUDIO = 'https://printrstudio.vercel.app';
  // Lokal QA: sajt på localhost → prata med lokala appen så hela kedjan
  // (inloggning, handskakning, direktlänkar) kan testas utan deploy.
  var IS_LOCAL_QA = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (IS_LOCAL_QA) {
    PRNTR_STUDIO = 'http://localhost:8080';
  }

  /* Handshake borttaget (interim-B): sajten autentiserar kund själv via
     /auth/v1/token → ingen cross-origin session-probe behövs. Headern speglas
     av KONTO.updateHeader ur den egna sessionen. Vid domänflytten ersätts detta
     av delad-cookie-SSO (inte iframe-handskaket, som ändå var dött på vercel). */

  // Designa-knappen i katalogen är "kommer snart" publikt tills studion är klar.
  // Förhandsvisning slås på per webbläsare med ?designa=1 (av med ?designa=0) —
  // flaggan sparas i localStorage så hela flödet katalog → studio kan testas
  // utan att kunder ser den skarpa knappen.
  var DESIGNA_LS = 'n33_designa_preview';
  try {
    var dq = new URLSearchParams(location.search).get('designa');
    if (dq === '1') localStorage.setItem(DESIGNA_LS, '1');
    if (dq === '0') localStorage.removeItem(DESIGNA_LS);
  } catch (e) {}
  function designPreviewOn() { try { return localStorage.getItem(DESIGNA_LS) === '1'; } catch (e) { return false; } }

  function prntrRpc(name, args) {
    return fetch(PRNTR_SUPABASE + '/rest/v1/rpc/' + name, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: PRNTR_ANON, Authorization: 'Bearer ' + PRNTR_ANON },
      body: JSON.stringify(args)
    }).then(function (res) { if (!res.ok) throw new Error('RPC ' + name + ' ' + res.status); return res.json(); });
  }

  /* ============ Mitt konto + admin (demo-exempeldata + riktig data vid verifierad inloggning) ============ */
  var KONTO = (function () {
    var LS = 'n33_demo_session';

    function demoLogo(bg, fg, txt) {
      var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'><rect width='120' height='120' rx='10' fill='" + bg + "'/><text x='60' y='70' font-family='Arial,Helvetica,sans-serif' font-size='20' font-weight='700' fill='" + fg + "' text-anchor='middle' letter-spacing='1'>" + txt + "</text></svg>";
      return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    }

    var KUNDER = [
      { id: 'k1', foretag: 'Sportbutiken i Borås AB', kontakt: 'Anna Svensson', email: 'anna@sportbutiken.se', modell: 'A', status: 'Aktiv', sedan: '2022', ordrar: 48 },
      { id: 'k2', foretag: 'Profilpartner Väst AB', kontakt: 'Erik Johansson', email: 'erik@profilpartner.se', modell: 'B', status: 'Aktiv', sedan: '2019', ordrar: 36 },
      { id: 'k3', foretag: 'Eventbolaget Sthlm', kontakt: 'Maria Lindqvist', email: 'maria@eventbolaget.se', modell: 'A', status: 'Aktiv', sedan: '2023', ordrar: 28 },
      { id: 'k4', foretag: 'Café Central', kontakt: 'Per Andersson', email: 'per@cafecentral.se', modell: 'A', status: 'Vilande', sedan: '2021', ordrar: 22 },
      { id: 'k5', foretag: 'Nordic Workwear AB', kontakt: 'Lisa Bergström', email: 'lisa@nordicworkwear.se', modell: 'B', status: 'Ny ansökan', sedan: '2026', ordrar: 0 }
    ];

    var STEG = ['Mottagen', 'Korrektur', 'Produktion', 'Skickad', 'Levererad'];
    var ORDERS = [
      { nr: 'N33-2417', datum: '2026-07-02', status: 4, summa: '14 880 kr', track: 'PN10482291SE', rader: [
        { plagg: 'T-shirt Premium 180g', farg: 'Marinblå', antal: 120, tryck: 'Screentryck 2-färg · bröst vänster' },
        { plagg: 'T-shirt Premium 180g', farg: 'Vit', antal: 40, tryck: 'Screentryck 2-färg · bröst vänster' } ] },
      { nr: 'N33-2398', datum: '2026-06-12', status: 2, summa: '31 250 kr', track: null, rader: [
        { plagg: 'Hoodie Heavy 350g', farg: 'Svart', antal: 85, tryck: 'Brodyr · bröst + DTF rygg' } ] },
      { nr: 'N33-2371', datum: '2026-05-28', status: 1, summa: '9 640 kr', track: null, rader: [
        { plagg: 'Piké Classic', farg: 'Kaki', antal: 60, tryck: 'Brodyr · bröst vänster' } ] },
      { nr: 'N33-2344', datum: '2025-11-20', status: 4, summa: '22 400 kr', track: 'PN10331877SE', rader: [
        { plagg: 'Arbetsjacka Pro', farg: 'Antracit', antal: 45, tryck: 'Screentransfer · rygg + vävt märke ärm' },
        { plagg: 'Keps 5-panel', farg: 'Svart', antal: 100, tryck: 'Brodyr · front' } ] }
    ];

    var BIBLIOTEK = [
      { namn: 'sportbutiken-logga.svg', typ: 'Vektor', farger: 2,
        pantone: [{ n: 'PMS 872 C', hex: '#B8860B' }, { n: 'PMS Black 6 C', hex: '#14181A' }],
        plagg: 'Hoodie Heavy 350g', pfarg: 'Svart', antal: 85, metod: 'Brodyr · bröst', order: 'N33-2398',
        img: demoLogo('#14181A', '#C79A2E', 'SPORT') },
      { namn: 'kampanj-2026.png', typ: 'Raster', farger: 2,
        pantone: [{ n: 'PMS 1235 C', hex: '#B8860B' }, { n: 'Vit', hex: '#FFFFFF' }],
        plagg: 'T-shirt Bio 180g', pfarg: 'Vit', antal: 120, metod: 'DTF · bröst', order: 'N33-2350',
        img: demoLogo('#B8860B', '#FFFFFF', 'RUN -26') },
      { namn: 'ryggtryck-slogan.svg', typ: 'Vektor', farger: 1,
        pantone: [{ n: 'PMS Black 6 C', hex: '#14181A' }],
        plagg: 'Piké Classic', pfarg: 'Kaki', antal: 60, metod: 'Screentryck · rygg', order: 'N33-2371',
        img: demoLogo('#F1EEE6', '#14181A', 'JUST GO') },
      { namn: 'jubileum-25ar.pdf', typ: 'Vektor', farger: 2,
        pantone: [{ n: 'PMS 872 C', hex: '#B8860B' }, { n: 'Cool Gray 3 C', hex: '#C8C4BC' }],
        plagg: 'Sweatshirt Premium', pfarg: 'Marin', antal: 40, metod: 'Brodyr · vänster bröst', order: 'N33-2299',
        img: demoLogo('#2A3440', '#E8E5DC', '25 ÅR') }
    ];

    var PRISER = [
      { teknik: 'Screentryck (1 färg)', enhet: 'kr/st', steg: [['1–9', '70:30'], ['50–99', '30:30'], ['250–499', '17:00'], ['1000+', '12:60']] },
      { teknik: 'Brodyr (≤5 000 stygn)', enhet: 'kr/st', steg: [['1–9', '112:70'], ['50–99', '75:00'], ['250–499', '58:80'], ['1000+', '44:10']] },
      { teknik: 'Digitaltransfer DTF (≤100 cm²)', enhet: 'kr/st', steg: [['1–4', '82:60'], ['50–99', '28:10'], ['200–399', '19:70'], ['1000+', '9:80']] },
      { teknik: 'Vävt märke (≤25 cm²)', enhet: 'kr/st', steg: [['10–24', '31:40'], ['100–199', '14:60'], ['500–999', '9:20'], ['1000+', '7:40']] }
    ];

    var st = load();
    function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } }
    function save() { try { localStorage.setItem(LS, JSON.stringify(st)); } catch (e) {} }
    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
    function kund() { var id = (st.role === 'admin' && st.viewAs) ? st.viewAs : 'k1'; return KUNDER.filter(function (k) { return k.id === id; })[0] || KUNDER[0]; }
    function loggedIn() { return st.role === 'kund' || st.role === 'admin'; }

    // email sätts vid riktig inloggning (Supabase-verifierad); demo-knapparna lämnar den tom.
    function login(role, email) { st = { role: role, email: email || null, tab: role === 'admin' ? 'adm-kunder' : 'oversikt', viewAs: null }; save(); updateHeader(); window.NOLL33_goto('konto'); }
    function logout() { st = {}; save(); updateHeader(); window.NOLL33_goto('home'); }
    function go(tab) { if (tab) st.tab = tab; save(); window.NOLL33_goto('konto'); }

    function updateHeader() {
      document.querySelectorAll('[data-nav="login"], [data-nav="konto"], .acct-pill').forEach(function (a) {
        // Pillen är en ren länk: inloggad → till kontot, utloggad → till login.
        // Ingen dropdown i headern — utloggning sker inne på kontot.
        if (loggedIn()) {
          a.dataset.nav = 'konto';
          a.textContent = st.role === 'admin' ? 'Admin' : 'Mitt konto';
        } else {
          a.dataset.nav = 'login';
          a.textContent = 'Logga in';
        }
      });
      // Portal-läge: sajtens skal byter skepnad (Ansökan döljs, guldlinje under headern).
      document.documentElement.toggleAttribute('data-portal', loggedIn());
    }

    function halsning() {
      var h = new Date().getHours();
      return h < 5 ? 'God kväll' : h < 10 ? 'God morgon' : h < 18 ? 'God dag' : 'God kväll';
    }

    /* ---- Riktig kunddata (hämtas när sessionen har verifierad e-post) ----
       Demo-knappen ger ingen e-post → exempeldatan visas. Riktig inloggning
       → ordrar/offerter/tryck från PRNTR, med egna tomma tillstånd. */
    var live = { key: null, loading: false, loaded: false, error: false, orders: [], quotes: [], designs: [] };
    function isLive() { return !!st.email; }
    // PRNTR:s orderstatus → portalens fem steg (Mottagen Korrektur Produktion Skickad Levererad)
    var STATUS_STEG = { 'new': 0, 'artwork_check': 1, 'stock_confirmed': 1, 'confirmed': 1, 'in_production': 2, 'printing': 2, 'packing': 2, 'shipped': 3, 'delivered': 4 };
    function mapOrder(o) {
      return {
        nr: '#' + o.order_number,
        datum: String(o.created_at || '').slice(0, 10),
        status: Object.prototype.hasOwnProperty.call(STATUS_STEG, o.status) ? STATUS_STEG[o.status] : 0,
        cancelled: o.status === 'cancelled',
        summa: Number(o.total_price || 0).toLocaleString('sv-SE') + ' kr',
        track: null,
        live: true,
        raw: o,
        rader: [{ plagg: 'T-shirt', farg: o.color || '—', antal: o.quantity || 0, tryck: '—' }]
      };
    }
    function loadLive() {
      var key = (st.email || '').toLowerCase();
      if (!key || live.loading || (live.loaded && live.key === key)) return;
      live = { key: key, loading: true, loaded: false, error: false, orders: [], quotes: [], designs: [] };
      render();
      Promise.all([
        prntrRpc('get_customer_orders', { p_email: key }),
        prntrRpc('get_customer_quotes', { p_email: key }),
        prntrRpc('get_customer_designs', { p_email: key })
      ]).then(function (r) {
        live.orders = (r[0] || []).filter(function (o) { return !mapOrder(o).cancelled; }).map(mapOrder);
        live.quotes = r[1] || [];
        live.designs = r[2] || [];
        live.loading = false; live.loaded = true;
        render();
      }).catch(function () {
        live.loading = false; live.loaded = true; live.error = true;
        render();
      });
    }
    function ordersData() { return isLive() ? live.orders : ORDERS; }

    var QUOTE_LABEL = { 'new': 'Ny', 'sent': 'Skickad', 'accepted': 'Accepterad', 'rejected': 'Avvisad' };
    // Demo-offerter så fliken lever i Mats-genomgången
    var DEMO_QUOTES = [
      { quote_number: 118, created_at: '2026-07-10', status: 'sent', quantity: 150, price_per_piece: 62, total_price: 9300 },
      { quote_number: 112, created_at: '2026-06-24', status: 'accepted', quantity: 80, price_per_piece: 74, total_price: 5920 }
    ];
    function quotesData() { return isLive() ? live.quotes : DEMO_QUOTES; }

    /* ---- render-hjälpare ---- */
    function statusPill(i) {
      var lbl = STEG[i]; var cls = i === 4 ? 'done' : (i === 0 ? 'new' : 'act');
      return '<span class="kt-status ' + cls + '">' + esc(lbl) + '</span>';
    }
    function timeline(i) {
      var h = '<div class="kt-timeline">';
      STEG.forEach(function (s, idx) {
        h += '<div class="kt-step' + (idx <= i ? ' on' : '') + '"><span class="kt-dot"></span><span class="kt-steplbl">' + esc(s) + '</span></div>';
        if (idx < STEG.length - 1) h += '<span class="kt-line' + (idx < i ? ' on' : '') + '"></span>';
      });
      return h + '</div>';
    }
    function tabs() {
      var T = st.role === 'admin' && !st.viewAs
        ? [['adm-kunder', 'Kundregister'], ['adm-priser', 'Prismodeller']]
        : [['oversikt', 'Översikt'], ['order', 'Ordrar'], ['offerter', 'Offerter'], ['bibliotek', 'Mina tryck'], ['priser', 'Mina priser'], ['uppgifter', 'Uppgifter']];
      return '<nav class="kt-tabs">' + T.map(function (t) {
        return '<button class="kt-tab' + (st.tab === t[0] ? ' is-active' : '') + '" data-kt-tab="' + t[0] + '">' + t[1] + '</button>';
      }).join('') + '</nav>';
    }
    /* Nästa händelse som handling: portalens viktigaste rad. Godkänn-knappen
       driver demo-flödet vidare (status 1 → 2) så Mats kan känna på interaktionen. */
    function nextStep(o) {
      if (o.status >= 4) return '';
      var msg, act = '';
      if (o.status === 0) msg = 'Vi går igenom er order och förbereder korrektur.';
      else if (o.status === 1) {
        msg = 'Korrektur väntar på ert godkännande.';
        // Riktiga godkännanden sker via korrektur-mejlet — knappen driver bara demot.
        act = o.live
          ? '<a class="pill pill-ink" href="mailto:info@noll33.se?subject=' + encodeURIComponent('Korrektur ' + o.nr) + '">Svara på korrektur</a>'
          : '<button class="pill pill-ink" data-kt-approve="' + esc(o.nr) + '">Godkänn korrektur</button>';
      }
      else if (o.status === 2) msg = 'I produktion. Beräknat klart inom 5-7 arbetsdagar.';
      else msg = 'Skickad. Följ paketet via spårningsnumret nedan.';
      return '<div class="kt-next"><span>' + msg + '</span>' + act + '</div>';
    }

    function orderCard(o, compact, withNext) {
      var rows = o.rader.map(function (r) { return '<tr><td>' + esc(r.plagg) + '</td><td>' + esc(r.farg) + '</td><td>' + r.antal + ' st</td><td>' + esc(r.tryck) + '</td></tr>'; }).join('');
      return '<div class="kt-order"><div class="kt-orderhead"><div><span class="kt-ordernr">' + esc(o.nr) + '</span><span class="kt-dim">  ' + esc(o.datum) + '</span></div>' + statusPill(o.status) + '</div>'
        + (compact ? '' : timeline(o.status))
        + (withNext ? nextStep(o) : '')
        + '<table class="kt-table"><thead><tr><th>Plagg</th><th>Färg</th><th>Antal</th><th>Förädling</th></tr></thead><tbody>' + rows + '</tbody></table>'
        + '<div class="kt-orderfoot"><span>' + (o.track ? 'Spårning: <a class="gold-link" style="font-size:13px" href="#" onclick="return false">' + esc(o.track) + '</a>' : '&nbsp;') + '</span>'
        + '<span class="kt-sum">' + esc(o.summa) + '</span><button class="pill pill-ink kt-again" data-kt-again="' + esc(o.nr) + '">Beställ igen</button></div></div>';
    }

    /* Sektionsrubrik: eyebrow + hårfin linje (+ ev. handling till höger) — ger
       Översikten struktur utan att stapla tunga paneler. */
    function secHead(label, action) {
      return '<div class="kt-sechead"><span class="eyebrow">' + esc(label) + '</span><span class="kt-secline"></span>' + (action || '') + '</div>';
    }
    /* Tomt tillstånd: eyebrow + en mening + EN handling — inbjudande, inte ursäktande. */
    function emptyState(rubrik, text, cta) {
      return '<div class="kt-empty"><span class="eyebrow">' + esc(rubrik) + '</span><p class="prose">' + text + '</p>' + (cta || '') + '</div>';
    }
    /* Laddar-skelett i orderkortens siluett — sidan behåller sin form medan datan hämtas. */
    function skeleton() {
      var kort = '<div class="kt-order kt-skelcard" aria-hidden="true"><div class="kt-skelrow" style="width:38%"></div><div class="kt-skelrow" style="width:72%"></div><div class="kt-skelrow" style="width:100%"></div><div class="kt-skelrow" style="width:100%"></div><div class="kt-skelrow" style="width:26%"></div></div>';
      return '<div role="status" aria-label="Hämtar era uppgifter">' + kort + kort + '</div>';
    }
    /* Kompakt orderkort för Översikten: timeline + nästa handling är stjärnan,
       innehållet komprimeras till tunna rader (full tabell bor i Orderhistoriken).
       Ingen "Beställ igen" här — man beställer inte om en order som är i produktion. */
    function overviewOrderCard(o) {
      var lines = o.rader.map(function (r) {
        var bits = [r.farg, r.antal + ' st', r.tryck].filter(function (x) { return x && x !== '—'; });
        return '<li><span class="kt-oplagg">' + esc(r.plagg) + '</span>'
          + (bits.length ? '<span class="kt-ometa">' + esc(bits.join(' · ')) + '</span>' : '') + '</li>';
      }).join('');
      return '<div class="kt-order kt-order-ov"><div class="kt-orderhead"><div><span class="kt-ordernr">' + esc(o.nr) + '</span><span class="kt-dim">  ' + esc(o.datum) + '</span></div>' + statusPill(o.status) + '</div>'
        + timeline(o.status)
        + '<ul class="kt-olines">' + lines + '</ul>'
        + '<div class="kt-ovfoot"><button class="kt-textlink" data-kt-tab="order">Se orderdetaljer →</button><span class="kt-sum">' + esc(o.summa) + '</span></div></div>';
    }

    /* ---- flikar ---- */
    function vOversikt(k) {
      // Portalens fråga är alltid "var är mina grejer och hur beställer jag igen?"
      // — pågående ordrar med nästa handling överst, ombeställning direkt under.
      var alla = ordersData();
      var pagaende = alla.filter(function (o) { return o.status < 4; });
      var pag = pagaende.length
        ? pagaende.map(overviewOrderCard).join('')
        : '<div class="kt-panel"><p class="prose" style="margin:0">Inga pågående ordrar just nu.</p></div>';
      // Beställ igen bor i Orderhistoriken, inte på översikten (för mycket annars).
      var antalTryck = isLive() ? live.designs.length : BIBLIOTEK.length;
      var antalOfferter = isLive() ? live.quotes.length : DEMO_QUOTES.length;
      // C-dashboard: handlingsbara summeringsrutor högst upp (ersätter botten-stats).
      var tiles = '<div class="kt-stats">'
        + '<div class="kt-stat"><div class="big">' + pagaende.length + '</div><div class="cap">Pågående ordrar</div></div>'
        + '<div class="kt-stat"><div class="big">' + antalOfferter + '</div><div class="cap">Öppna offerter</div></div>'
        + '<div class="kt-stat"><div class="big">' + antalTryck + '</div><div class="cap">Sparade tryck</div></div>'
        + '</div>';
      // Kontaktkort borttaget här: kontakt nås via header-navet "Kontakt"
      // (telefon + mejl finns på Kontakt-sidan och i footern). Översikten
      // slutar med Pågående ordrar — mindre brus.
      return '<div class="kt-in">' + tiles + '</div>'
        + '<div class="kt-in" style="margin-top:30px">' + secHead('Pågående just nu', pagaende.length > 1 ? '<span class="kt-seccount">' + pagaende.length + ' ordrar</span>' : '') + pag + '</div>';
    }
    function vOrder() {
      // Orderhistoriken bär samma tänk som Översikten: pågående ordrar med nästa
      // handling överst, avslutade samlade under — men här FULL historik med tabell.
      var alla = ordersData();
      if (!alla.length) return emptyState('Inga ordrar ännu',
        'Er orderhistorik samlas här — status, innehåll och summa för varje beställning.',
        '<a href="#" class="pill pill-ink" data-nav="catalog">Till sortimentet</a>');
      var pag = alla.filter(function (o) { return o.status < 4; });
      var klar = alla.filter(function (o) { return o.status >= 4; });
      var ordText = function (n) { return n + (n === 1 ? ' order' : ' ordrar'); };
      var out = '<p class="kt-lead">Alla era beställningar med status, innehåll och summa. Beställ om en tidigare order med ett klick.</p>';
      if (pag.length) {
        out += '<div class="kt-in">' + secHead('Pågående', '<span class="kt-seccount">' + ordText(pag.length) + '</span>')
          + pag.map(function (o) { return orderCard(o, false, true); }).join('') + '</div>';
      }
      if (klar.length) {
        // Medvetet inga filterkontroller: Pågående/Avslutade + årsgruppering täcker
        // behovet tills historiken blir oöverskådlig. Årsrubrikerna dyker upp först
        // när ordrarna spänner mer än ett år — innan dess ser vyn ut som idag.
        var byYear = {};
        klar.forEach(function (o) { var y = String(o.datum).slice(0, 4); (byYear[y] = byYear[y] || []).push(o); });
        var years = Object.keys(byYear).sort().reverse();
        var klarHtml = years.length > 1
          ? years.map(function (y) {
              return '<div class="kt-yearhead"><span>' + esc(y) + '</span><span class="kt-secline"></span></div>'
                + byYear[y].map(function (o) { return orderCard(o, false, false); }).join('');
            }).join('')
          : klar.map(function (o) { return orderCard(o, false, false); }).join('');
        out += '<div class="kt-in" style="animation-delay:.08s;margin-top:' + (pag.length ? '34px' : '0') + '">'
          + secHead('Avslutade', '<span class="kt-seccount">' + ordText(klar.length) + '</span>')
          + klarHtml + '</div>';
      }
      return out;
    }
    function vOfferter() {
      // Offertkort i samma vokabulär som Översiktens orderkort (olines + ovfoot),
      // inte en trång tabell för en enda rad. Summan är stjärnan i foten.
      var q = quotesData();
      if (!q.length) return emptyState('Inga offerter ännu',
        'Designa i studion och begär offert — era offerter samlas här med status och pris.',
        '<a href="#" class="pill pill-ink" data-nav="apply">Designa i studion</a>');
      var cards = q.map(function (o) {
        // Avgjorda offerter (accepterad/avvisad) dämpas som avslutade ordrar; öppna är guld.
        var cls = (o.status === 'accepted' || o.status === 'rejected') ? 'done' : 'act';
        var per = Number(o.price_per_piece || 0).toLocaleString('sv-SE');
        var sum = Number(o.total_price || 0).toLocaleString('sv-SE') + ' kr';
        var open = (o.status === 'new' || o.status === 'sent');
        var foot = open
          ? '<a class="kt-textlink" style="text-decoration:none" href="mailto:info@noll33.se?subject=' + encodeURIComponent('Offert #' + o.quote_number) + '">Frågor om offerten →</a>'
          : '<span>&nbsp;</span>';
        return '<div class="kt-order kt-order-ov"><div class="kt-orderhead"><div><span class="kt-ordernr">#' + esc(o.quote_number) + '</span>'
          + '<span class="kt-dim">  ' + esc(String(o.created_at || '').slice(0, 10)) + '</span></div>'
          + '<span class="kt-status ' + cls + '">' + esc(QUOTE_LABEL[o.status] || o.status) + '</span></div>'
          + '<ul class="kt-olines"><li><span class="kt-oplagg">Antal</span><span class="kt-ometa">' + (o.quantity || 0) + ' st</span></li>'
          + '<li><span class="kt-oplagg">Pris per styck</span><span class="kt-ometa">' + per + ' kr</span></li></ul>'
          + '<div class="kt-ovfoot">' + foot + '<span class="kt-sum">' + sum + '</span></div></div>';
      }).join('');
      return '<p class="kt-lead">Era offerter från studion. En offert gäller tills ni beställer eller den avvisas.</p>'
        + '<div class="kt-in">' + secHead('Offerter', '<span class="kt-seccount">' + q.length + (q.length === 1 ? ' offert' : ' offerter') + '</span>') + cards + '</div>';
    }
    // Ett tryck-kort: tryckets specar (typ, färgantal, pantone) + var det senast
    // användes (plagg, färg, antal, metod) + åtgärder. Fält som saknas döljs, så
    // live-designer utan full metadata ändå ser rena ut.
    function libCard(c) {
      var farg = c.farger ? ' · ' + c.farger + (c.farger === 1 ? ' färg' : ' färger') : '';
      var tag = c.typ ? '<span class="kt-libtag">' + esc(c.typ) + farg + '</span>' : '';
      var pant = (c.pantone && c.pantone.length)
        ? '<div class="kt-libpant">' + c.pantone.map(function (p) {
            return '<span class="kt-libsw"><span class="kt-libdot" style="background:' + esc(p.hex) + '"></span>' + esc(p.n) + '</span>';
          }).join('') + '</div>' : '';
      var detalj = [c.pfarg, (c.antal ? c.antal + ' st' : ''), c.metod].filter(Boolean).join(' · ');
      var used = (c.plagg || detalj)
        ? '<div class="kt-libsep"></div><div class="kt-libused"><span class="kt-libused-lbl">Senast använt</span>'
          + (c.plagg ? '<a class="kt-libplagg" href="#" data-nav="catalog">' + esc(c.plagg) + ' <span aria-hidden="true">→</span></a>' : '')
          + (detalj ? '<span class="kt-libdetalj">' + esc(detalj) + '</span>' : '')
          + '</div>' : '';
      var dl = c.img ? '<a class="kt-libdl" href="' + c.img + '" download="' + esc(c.namn || 'tryck') + '" title="Ladda ner filen" aria-label="Ladda ner filen"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"></path></svg></a>' : '';
      var again = c.order ? '<button class="pill pill-ink kt-libagain" data-kt-again="' + esc(c.order) + '">Beställ igen</button>' : '';
      var studio = '<a class="kt-libstudio" href="' + (c.studioHref || (PRNTR_STUDIO + '/?from=noll33')) + '" target="_blank" rel="noopener">Öppna i studion →</a>';
      return '<div class="kt-libitem">'
        + '<div class="kt-libimg"><img src="' + c.img + '" alt="' + esc(c.namn) + '">' + dl + '</div>'
        + '<div class="kt-libbody"><strong class="kt-libname">' + esc(c.namn) + '</strong>'
        + tag + pant + used
        + '<div class="kt-libcta">' + again + studio + '</div></div></div>';
    }
    function vBibliotek() {
      var lead, n, grid;
      var LEAD = 'Era sparade tryck med specar och pantone-färger. Beställ om en tidigare order, öppna i studion för en variant, gå till plagget eller ladda ner filen.';
      if (isLive()) {
        if (!live.designs.length) return emptyState('Inga sparade tryck ännu',
          'Spara en design i studion så dyker den upp här — redo att beställa vid nästa order.',
          '<a href="#" class="pill pill-ink" data-nav="apply">Öppna designstudion</a>');
        n = live.designs.length;
        lead = LEAD;
        grid = live.designs.map(function (d) {
          return libCard({
            img: d.thumbnail_url || demoLogo('#14181A', '#C79A2E', (d.name || 'D').slice(0, 6).toUpperCase()),
            namn: d.name, typ: d.file_kind || d.kind, farger: d.color_count,
            pantone: d.pantone || d.colors, plagg: d.last_garment, pfarg: d.last_color,
            antal: d.last_quantity, metod: d.last_method, order: d.last_order_number
          });
        }).join('');
      } else {
        n = BIBLIOTEK.length;
        lead = LEAD;
        grid = BIBLIOTEK.map(function (b) {
          return libCard({
            img: b.img, namn: b.namn, typ: b.typ, farger: b.farger, pantone: b.pantone,
            plagg: b.plagg, pfarg: b.pfarg, antal: b.antal, metod: b.metod, order: b.order
          });
        }).join('');
      }
      return '<p class="kt-lead">' + lead + '</p>'
        + '<div class="kt-in">' + secHead('Sparade tryck', '<span class="kt-seccount">' + n + ' tryck</span>')
        + '<div class="kt-lib">' + grid + '</div></div>';
    }
    function vPriser(k) {
      // Modell-etiketten är intern (admin) — kunden ser bara "era priser".
      var note = '<span class="kt-note a">Era avtalade priser · 2026</span>';
      return '<p class="kt-lead">Era priser per teknik och volym. Exakt pris räknas alltid live i designstudion.' + note + '</p>'
        + '<div class="kt-in">' + secHead('Era priser')
        + '<div class="kt-prisgrid">' + PRISER.map(function (p) {
          return '<div class="kt-pris"><strong class="kt-pristitel">' + esc(p.teknik) + '</strong><table><tbody>'
            + p.steg.map(function (s) { return '<tr><td>' + esc(s[0]) + ' st</td><td>' + esc(s[1]) + '</td></tr>'; }).join('')
            + '</tbody></table></div>';
        }).join('') + '</div></div>';
    }
    function vUppgifter(k) {
      var rows = isLive()
        ? '<div class="kt-kv"><span>E-post</span><strong>' + esc(st.email) + '</strong></div>'
          + '<p class="prose" style="margin:14px 0 0;font-size:13px;color:var(--muted2)">Företagsuppgifter kompletteras av oss. Hör av er om något behöver ändras.</p>'
        : '<div class="kt-kv"><span>Företag</span><strong>' + esc(k.foretag) + '</strong></div>'
          + '<div class="kt-kv"><span>Kontakt</span><strong>' + esc(k.kontakt) + '</strong></div>'
          + '<div class="kt-kv"><span>E-post</span><strong>' + esc(k.email) + '</strong></div>'
          + '<div class="kt-kv"><span>Leveransadress</span><strong>Hållingsgatan 15, Borås</strong></div>';
      return '<p class="kt-lead">Ert företagskonto hos Noll33. Hör av er om något behöver ändras.</p>'
        + '<div class="kt-in"><div class="kt-grid2 kt-even"><div class="kt-panel"><div class="eyebrow" style="margin-bottom:16px">Företag</div>' + rows + '</div>'
        + '<div class="kt-panel"><div class="eyebrow" style="margin-bottom:16px">Kommer snart</div>'
        + '<p class="prose">Flera användare per företag, fler leveransadresser, fakturor som PDF och ordernotiser via mejl.</p></div></div></div>';
    }

    /* ---- admin ---- */
    function vAdmKunder() {
      return '<p class="kt-lead">Alla återförsäljare. Koppla prismodell och kliv in i deras vy för att se exakt vad de ser.</p>'
        + '<table class="kt-admtable"><thead><tr><th>Företag</th><th>Kontakt</th><th>Status</th><th>Prismodell</th><th>Ordrar</th><th></th></tr></thead><tbody>'
        + KUNDER.map(function (k) {
          return '<tr><td><strong>' + esc(k.foretag) + '</strong></td><td>' + esc(k.kontakt) + '</td><td>' + esc(k.status) + '</td>'
            + '<td><span class="kt-modell ' + (k.modell === 'B' ? 'b' : 'a') + '">Modell ' + esc(k.modell) + '</span></td>'
            + '<td>' + k.ordrar + '</td><td><button class="kt-viewas" data-kt-viewas="' + esc(k.id) + '">Visa som kund →</button></td></tr>';
        }).join('') + '</tbody></table>';
    }
    function vAdmPriser() {
      return '<div class="kt-grid2">'
        + '<div class="kt-panel"><strong class="kt-pristitel">Prismodell A · Standard 2026</strong><p class="prose" style="margin:10px 0 4px">Officiella prislistan. Gäller alla kunder utan egen koppling. Verifierad mot systemet.</p><span class="kt-note a">Aktiv · ' + (KUNDER.filter(function (k) { return k.modell === 'A'; }).length) + ' kunder</span></div>'
        + '<div class="kt-panel"><strong class="kt-pristitel">Prismodell B · Avtalskunder</strong><p class="prose" style="margin:10px 0 4px">Samma struktur som A med egna priser per cell. Läggs in när tabellen är klar, kopplas per kund.</p><span class="kt-note b">Förbereds · ' + (KUNDER.filter(function (k) { return k.modell === 'B'; }).length) + ' kunder väntar</span></div></div>';
    }

    function render() {
      var root = document.getElementById('kontoRoot'); if (!root) return;
      if (!loggedIn()) { root.innerHTML = '<div style="max-width:420px;margin:60px auto;text-align:center"><p class="prose">Du är inte inloggad.</p><a href="#" class="pill pill-ink" data-nav="login" style="margin-top:14px;display:inline-flex">Till inloggningen →</a></div>'; return; }
      var k = kund();
      var adminBar = '';
      if (st.role === 'admin') {
        adminBar = st.viewAs
          ? '<div class="kt-adminbar"><span><strong>ADMIN</strong> · Visar som: ' + esc(k.foretag) + ' (prismodell ' + esc(k.modell) + ')</span><button class="kt-adminback" data-kt-back="1">‹ Tillbaka till admin</button></div>'
          : '<div class="kt-adminbar"><span><strong>ADMIN</strong> · Noll33' + (st.email ? ' · ' + esc(st.email) : '') + '</span><span class="kt-dim">' + (st.email ? 'Inloggad — innehållet är exempeldata' : 'Demo med exempeldata') + '</span></div>';
      }
      var isAdminHome = st.role === 'admin' && !st.viewAs;
      // Kund möts av en hälsning istället för generiskt "Mitt konto" — portalen ska
      // kännas personlig direkt vid inloggning. Admins visa-som-kund behåller neutralt.
      var title = isAdminHome ? 'Admin'
        : (st.role === 'kund' ? halsning() + (k.kontakt ? ', ' + esc(k.kontakt.split(' ')[0]) : '') : 'Mitt konto');
      var sub = isAdminHome ? 'Kunder, prismodeller och förfrågningar.'
        : (isLive() ? esc(st.email) : esc(k.foretag) + ' · ' + esc(k.kontakt));
      var body = '';
      if (isLive() && live.loading) {
        body = skeleton();
      } else if (isLive() && live.error) {
        body = '<div class="kt-empty"><span class="eyebrow">Något gick fel</span>'
          + '<p class="prose">Vi kunde inte hämta era uppgifter just nu. Kontrollera uppkopplingen och försök igen.</p>'
          + '<button class="pill pill-outline" data-kt-retry="1">Försök igen</button></div>';
      } else switch (st.tab) {
        case 'order': body = vOrder(); break;
        case 'offerter': body = vOfferter(); break;
        case 'bibliotek': body = vBibliotek(); break;
        case 'priser': body = vPriser(k); break;
        case 'uppgifter': body = vUppgifter(k); break;
        case 'adm-kunder': body = vAdmKunder(); break;
        case 'adm-priser': body = vAdmPriser(); break;
        default: body = vOversikt(k);
      }
      root.innerHTML = adminBar
        + '<div class="kt-head"><div><div class="eyebrow kt-eyebrow" style="margin-bottom:14px">' + (isAdminHome ? 'Noll33 intern' : 'Återförsäljarportal') + '</div>'
        + '<h1 class="h-statement">' + title + '</h1><p class="kt-sub">' + sub + '</p></div>'
        + '<button class="kt-logout" data-kt-logout="1">Logga ut</button>'
        + '</div>'
        + tabs() + '<div class="kt-body">' + body + '</div>'
        // Skiss-notisen gäller bara exempeldata — riktigt inloggade ser sin riktiga data.
        + (isLive() ? '' : '<p class="kt-demonote">Klickbar skiss med exempeldata — kopplas till riktiga konton och order i nästa steg.</p>');
    }

    function mount() { if (isLive()) loadLive(); render(); }

    function init() {
      updateHeader();
      document.addEventListener('click', function (e) {
        var b;
        if ((b = e.target.closest('[data-demo-login]'))) { e.preventDefault(); login(b.getAttribute('data-demo-login')); return; }
        if ((b = e.target.closest('[data-kt-tab]'))) { e.preventDefault(); st.tab = b.getAttribute('data-kt-tab'); save(); render(); return; }
        if ((b = e.target.closest('[data-kt-viewas]'))) { e.preventDefault(); st.viewAs = b.getAttribute('data-kt-viewas'); st.tab = 'oversikt'; save(); render(); window.scrollTo(0, 0); return; }
        if ((b = e.target.closest('[data-kt-back]'))) { e.preventDefault(); st.viewAs = null; st.tab = 'adm-kunder'; save(); render(); return; }
        if ((b = e.target.closest('[data-kt-logout]'))) { e.preventDefault(); logout(); return; }
        if ((b = e.target.closest('[data-kt-retry]'))) { e.preventDefault(); live.loaded = false; live.error = false; loadLive(); return; }
        if ((b = e.target.closest('[data-kt-approve]'))) {
          e.preventDefault();
          var onr = b.getAttribute('data-kt-approve');
          var ord = ORDERS.filter(function (x) { return x.nr === onr; })[0];
          if (ord) { ord.status = 2; render(); }
          return;
        }
        if ((b = e.target.closest('[data-kt-again]'))) {
          e.preventDefault();
          if (isLive()) {
            // Riktig ombeställning: ny offertförfrågan i PRNTR med orderns underlag.
            var onr2 = b.getAttribute('data-kt-again');
            var src = live.orders.filter(function (x) { return x.nr === onr2; })[0];
            if (!src || b.disabled) return;
            b.disabled = true; b.textContent = 'Skickar…';
            fetch(PRNTR_SUPABASE + '/rest/v1/quote_requests', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: PRNTR_ANON, Authorization: 'Bearer ' + PRNTR_ANON },
              body: JSON.stringify({
                customer_name: src.raw.customer_name_snapshot || st.email.split('@')[0],
                customer_email: st.email,
                color: src.raw.color,
                quantity: src.raw.quantity,
                total_price: src.raw.total_price,
                price_per_piece: src.raw.price_per_piece,
                pdf_config: src.raw.pdf_config,
                notes: 'Ombeställning av order ' + src.nr + ' via portalen'
              })
            }).then(function (res) {
              if (!res.ok) throw new Error(String(res.status));
              b.textContent = 'Förfrågan skickad ✓'; b.style.opacity = '.65';
            }).catch(function () {
              b.disabled = false; b.textContent = 'Beställ igen';
            });
          } else {
            b.textContent = 'Lagd i korgen ✓'; b.disabled = true; b.style.opacity = '.65';
          }
          return;
        }
        if ((b = e.target.closest('[data-kt-use]'))) {
          e.preventDefault();
          b.textContent = 'Vald ✓'; b.disabled = true; b.style.opacity = '.65';
          return;
        }
      });
    }
    return { mount: mount, init: init, loggedIn: loggedIn, login: login };
  })();

  /* ============ mo-reveal: auto-tagga + avslöja (systemisk motion) ============ */
  var moSecMap = new WeakMap(), moSecN = 0;
  function moInit() {
    if (reduceMotion) return;
    // hero-text + cta rullar upp
    document.querySelectorAll('.page.active .hero h1, .page.active .hero .hero-eyebrow, .page.active .hero .hero-lead, .page.active .hero .hero-cta').forEach(function (el) {
      if (!el.__mo) { el.__mo = true; el.setAttribute('data-mo-up', ''); }
    });
    // bilder → data-mo-img (a–e per sektion), länk-omslutna → zoom
    document.querySelectorAll('.page.active img').forEach(function (img) {
      if (img.__mo) return; img.__mo = true;
      if (img.closest('.ed-slide,.hero-media,.brand-track,header,.site-header,.mobile-nav,.metod-card')) return;
      var s = img.getAttribute('src') || ''; if (/tile\.openstreetmap|\/logos\//i.test(s)) return;
      var box = img.parentElement; if (!box) return;
      var cs = getComputedStyle(box), ics = getComputedStyle(img);
      if (!(cs.overflow === 'hidden' || box.style.aspectRatio || ics.objectFit === 'cover' || ics.position === 'absolute')) return;
      var sec = box.closest('section') || box.parentElement;
      if (!moSecMap.has(sec)) { moSecMap.set(sec, ['a', 'b', 'c', 'd', 'e'][moSecN % 5]); moSecN++; }
      if (!box.hasAttribute('data-mo-img')) box.setAttribute('data-mo-img', moSecMap.get(sec));
      var link = img.closest('a'); if (link) link.setAttribute('data-mo-zoom', '');
    });
    // rubriker rullar upp
    document.querySelectorAll('.page.active h2, .page.active h3').forEach(function (el) {
      if (el.__mo) return; el.__mo = true;
      if (el.closest('.metod-card, .cat-card')) return;
      el.setAttribute('data-mo-up', '');
    });
    // textlänkar (ej pill/underline/bild) → mo-link underline
    document.querySelectorAll('.page.active a').forEach(function (a) {
      if (a.__mo) return; a.__mo = true;
      if (a.closest('header, .site-header, .brand-track, .mobile-nav')) return;
      if (a.classList.contains('pill') || a.classList.contains('gold-link')) return;
      if (a.querySelector('img,svg')) return;
      if (!(a.textContent || '').trim()) return;
      a.setAttribute('data-mo-link', '');
    });
    moReveal();
  }
  function moReveal() {
    var vh = window.innerHeight || document.documentElement.clientHeight;
    document.querySelectorAll('[data-mo-img]:not([data-mo-in]), [data-mo-up]:not([data-mo-in])').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return;
      if (r.top < vh * 0.86 && r.bottom > 4) {
        var idx = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.transitionDelay = (Math.min(idx, 6) * 0.11) + 's';
        el.setAttribute('data-mo-in', '');
      }
    });
    // enkel fade-up för .reveal-block (section-head, statrad, manifest)
    document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < vh * 0.92 && r.bottom > 0) el.classList.add('in');
    });
  }

  /* ============ Editorial slide-in ============ */
  var edIO = null, edSeen = new WeakSet();
  function edObserve(immediate) {
    var els = document.querySelectorAll('.page.active .ed-slide');
    if (!els.length) return;
    if (reduceMotion || touch) { els.forEach(function (el) { el.classList.add('ed-in'); }); return; }
    if (!edIO) {
      edIO = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('ed-in'); edSeen.add(en.target); edIO.unobserve(en.target); } });
      }, { threshold: 0.35, rootMargin: '0px 0px -25% 0px' });
    }
    els.forEach(function (el) { if (edSeen.has(el)) el.classList.add('ed-in'); else edIO.observe(el); });
  }

  /* ============ Video: playbackRate + autoplay + IO-paus ============ */
  function setRates() {
    document.querySelectorAll('video').forEach(function (v) {
      var r = parseFloat(v.getAttribute('data-rate')) || 1;
      v.muted = true; v.defaultMuted = true; v.playsInline = true; v.loop = true;
      try { v.playbackRate = r; } catch (e) {}
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
      if (!v._io && 'IntersectionObserver' in window) {
        v._io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            if (e.isIntersecting) { if (v.paused) { var q = v.play(); if (q && q.catch) q.catch(function () {}); } }
            else if (!v.paused) { try { v.pause(); } catch (_) {} }
          });
        }, { threshold: 0.05 });
        v._io.observe(v);
      }
    });
  }

  /* ============ Varumärkes-marquee: drift + scroll-momentum ============ */
  var BRAND_LOGOS = ['gildan','bella-canvas','fruit-of-the-loom','russell','kariban','bandc','lee','wrangler','napapijri','timberland','puma-workwear','dickies','beechfield','flexfit','result','premier','front-row','native-spirit','build-your-brand','mumbles','bagbase','westford-mill','towel-city','yoko'];
  var LOGO_EXT = { 'brook-taverner':'jpg', buff:'jpg', cat:'jpg', 'cg-international':'jpg', henbury:'jpg', quadra:'jpg', result:'jpg', spiro:'jpg', tombo:'jpg', yoko:'jpg' };
  var mqX = 0, mqVel = 0, mqLast = 0;
  function buildBrandMarquee() {
    var track = document.getElementById('brandTrack');
    if (!track) return;
    function cell(name) {
      var ext = LOGO_EXT[name] || 'png';
      var label = name.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
      return '<span class="cell"><img loading="lazy" src="assets/logos/' + name + '.' + ext + '" alt="' + label + '"></span>';
    }
    var half = BRAND_LOGOS.map(cell).join('');
    track.setAttribute('data-marquee', '');
    track.style.animation = 'none';
    track.innerHTML = '<span style="display:flex;align-items:center;">' + half + '</span>'
      + '<span aria-hidden="true" style="display:flex;align-items:center;">' + half + '</span>';
    fitMarqueeLogos(track);
  }
  /* Lika-yta-normalisering (samma princip som NOLL33_fitLogo): skala varje logga så
     dess renderade YTA ≈ konstant → bred wordmark väger inte tyngre än liten kvadrat.
     Höjd clampas så inget blir absurt smalt/högt. */
  function fitMarqueeLogos(track) {
    var TARGET = 2100, HMIN = 20, HMAX = 42;
    Array.prototype.forEach.call(track.querySelectorAll('.cell img'), function (im) {
      function size() {
        var r = im.naturalWidth / (im.naturalHeight || 1); if (!r || !isFinite(r)) return;
        var h = Math.max(HMIN, Math.min(HMAX, Math.sqrt(TARGET / r)));
        im.style.height = h.toFixed(1) + 'px'; im.style.width = 'auto';
        im.style.maxHeight = 'none'; im.style.maxWidth = 'none';
      }
      if (im.complete && im.naturalWidth) size(); else im.addEventListener('load', size, { once: true });
    });
  }
  function mqTick() {
    var track = document.getElementById('brandTrack');
    if (track && track.firstElementChild) {
      mqX -= 0.5 + Math.max(-14, Math.min(mqVel * 0.14, 14));
      mqVel *= 0.88;
      var groupW = track.firstElementChild.offsetWidth;
      if (groupW > 0) { while (-mqX >= groupW) mqX += groupW; while (mqX > 0) mqX -= groupW; }
      track.style.transform = 'translate3d(' + mqX.toFixed(1) + 'px,0,0)';
    }
    requestAnimationFrame(mqTick);
  }

  /* ============ Hero-tygrippel (desktop, spring-fysik ur design_handoff) ============ */
  function heroRipple() {
    if (reduceMotion || touch) return;
    var host = document.querySelector('.page[data-page="home"] .hero');
    var bump = document.querySelector('[data-bump]');
    var disp = document.querySelector('[data-disp]');
    var emask = document.querySelector('[data-emask]');
    var fab = document.querySelector('[data-hero-fab]');
    if (!host || !bump || !disp || !fab) return;
    host.style.cursor = 'none';
    var p = { mw: 0, mh: 0, filtered: false, tx: -9999, ty: -9999, cx: -9999, cy: -9999, px: -9999, py: -9999, on: false, down: false, push: 0, depth: 0, dv: 0, graze: 0.55 };
    function move(e) {
      var t = e.touches && e.touches[0];
      var cx = t ? t.clientX : e.clientX, cy = t ? t.clientY : e.clientY;
      var tgt = t ? document.elementFromPoint(cx, cy) : e.target;
      if (tgt && tgt.closest && tgt.closest('header, nav, .site-header')) { p.on = false; return; }
      var r = host.getBoundingClientRect();
      var x = cx - r.left, y = cy - r.top;
      if (r.width > 0 && x >= -40 && y >= -40 && x <= r.width + 40 && y <= r.height + 40) {
        if (!p.on) { p.cx = x; p.cy = y; p.px = x; p.py = y; p.depth = 0; p.dv = 0; p.graze = 0.55; }
        p.tx = x; p.ty = y; p.on = true;
      } else { p.on = false; }
    }
    window.addEventListener('mousemove', move, { passive: true });
    function off() { p.on = false; p.down = false; }
    document.documentElement.addEventListener('mouseleave', off);
    window.addEventListener('blur', off);
    window.addEventListener('mousedown', function (e) { if (e.button === 0) p.down = true; }, { passive: true });
    window.addEventListener('mouseup', function () { p.down = false; }, { passive: true });
    function tick() {
      requestAnimationFrame(tick);
      if (p.on) { p.cx += (p.tx - p.cx) * 0.22; p.cy += (p.ty - p.cy) * 0.22; }
      var spd = 0;
      if (p.on && p.px !== -9999) spd = Math.hypot(p.cx - p.px, p.cy - p.py);
      p.px = p.cx; p.py = p.cy;
      var gT = p.on ? Math.max(0.34, Math.min(1, 1 - spd / 30)) : 1;
      p.graze += (gT - p.graze) * (gT < p.graze ? 0.3 : 0.05);
      p.push += (((p.on && p.down) ? 1 : 0) - p.push) * 0.16;
      var target = p.on ? (0.42 + 0.58 * Math.max(p.graze, p.push)) * (1 + 0.42 * p.push) : 0;
      p.dv += (target - p.depth) * (0.135 + 0.09 * p.push);
      p.dv *= (0.74 + 0.1 * Math.min(1, p.push));
      p.depth += p.dv;
      var active = p.on || Math.abs(p.depth) > 0.012 || Math.abs(p.dv) > 0.006;
      if (active) {
        if (!p.filtered) { p.filtered = true; fab.style.filter = 'url(#n33-ripple)'; }
        var hw = host.clientWidth, hh = host.clientHeight, m = 60;
        if (emask && (p.mw !== hw || p.mh !== hh)) { p.mw = hw; p.mh = hh; emask.setAttribute('width', hw); emask.setAttribute('height', hh); }
        var bx = Math.max(m, Math.min(hw - m, p.cx)), by = Math.max(m, Math.min(hh - m, p.cy));
        var sz = 360 * (0.86 + 0.2 * Math.min(1.4, Math.max(0, p.depth)));
        bump.setAttribute('x', (bx - sz / 2).toFixed(1));
        bump.setAttribute('y', (by - sz / 2).toFixed(1));
        bump.setAttribute('width', sz.toFixed(1));
        bump.setAttribute('height', sz.toFixed(1));
        var EDGE = 130;
        var edgeF = Math.max(0, Math.min(1, Math.min(p.cx, p.cy, hw - p.cx, hh - p.cy) / EDGE));
        disp.setAttribute('scale', (-60 * p.depth * edgeF).toFixed(2));
      } else if (p.filtered) {
        p.filtered = false; p.depth = 0; p.dv = 0; p.push = 0; p.cx = p.cy = p.px = p.py = -9999;
        fab.style.filter = 'none';
        bump.setAttribute('x', '-9999'); bump.setAttribute('y', '-9999');
        disp.setAttribute('scale', '0');
      }
    }
    requestAnimationFrame(tick);
  }

  /* ============ Förädlingsmetoder (kort + tabell + modal) ============ */
  // Ordning + bilder följer startsidans metodkort (startsidan = referens).
  var METODER = [
    { n: '01', name: 'Brodyr', img: 'assets/m6-brodyr.jpg', what: 'Motivet sys med tråd.', colors: 'max 15', bestFor: 'Loggor på pikéer, kepsar, arbetskläder', priceWhen: 'Rimlig storlek, återkommande', lessGood: 'Stora ytor, fina detaljer, foto', feel: 'Upphöjd tråd, gedigen', volume: 'Liten–medel, återkommande', durability: 'Mycket hög' },
    { n: '02', name: 'Screentryck', img: 'assets/mnew13.jpg', what: 'Färgen trycks genom en schablon, ett lager per färg.', colors: 'max 8', bestFor: 'Solida färger, stora serier', priceWhen: 'Hög volym, få färger', lessGood: 'Små upplagor, foto, gradienter', feel: 'Ovanpå tyget, matt', volume: 'Stora serier', durability: 'Mycket hög' },
    { n: '03', name: 'Digitaltransfer (DTF)', img: 'assets/m4-dtf.jpg', what: 'Motivet skrivs på film och pressas på.', colors: 'Full färg', bestFor: 'Full färg på nästan alla material', priceWhen: 'Små–medel upplagor, blandade material', lessGood: 'Mycket stora upplagor, stora heltäckande ytor', feel: 'Tunt lager ovanpå', volume: 'Små–medel', durability: 'Hög' },
    { n: '04', name: 'Screentransfer', img: 'assets/mnew7.jpg', what: 'Screentryckt motiv på film som värmepressas på.', colors: 'max 7', bestFor: 'Samma motiv på begäran, namn/nummer', priceWhen: 'Återkommande motiv, mindre serier', lessGood: 'Unika lågvolymsmotiv, färgrika bilder', feel: 'Slät, lätt blank, ovanpå', volume: 'Små–medel, återkommande', durability: 'Hög' },
    { n: '05', name: 'Digitaltryck (DTG)', img: 'assets/m3-dtg.jpg', what: 'Bläck skrivs direkt in i plaggets fibrer.', colors: 'Full färg', bestFor: 'Foto, detaljer, små serier', priceWhen: 'Liten–medel upplaga, komplext motiv', lessGood: 'Stora upplagor, polyester och mörka plagg', feel: 'Mjuk, i tyget', volume: 'Liten–medel', durability: 'Medel' },
    { n: '06', name: 'Vävt märke', img: 'assets/Print/vavt%20marke.jpg', what: 'Motivet vävs som ett separat märke och sys på.', colors: 'max 10', bestFor: 'Fina detaljer, skarpa loggor, märken', priceWhen: 'Volym, återkommande', lessGood: 'Låg volym, stora ytor', feel: 'Platt vävt textilmärke', volume: 'Medel–hög', durability: 'Mycket hög' },
  ];
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
  function buildMetoder() {
    var grid = document.getElementById('metodGrid');
    if (grid && !grid.dataset.built) {
      grid.dataset.built = '1';
      grid.innerHTML = METODER.map(function (m, i) {
        return '<div class="metod-card" data-metod="' + i + '"><img class="metod-bg" src="' + esc(m.img) + '" alt="" aria-hidden="true" loading="lazy"><div class="inner">'
          + '<div class="top"><span class="n">' + m.n + '</span><h3>' + esc(m.name) + '</h3></div>'
          + '<p>' + esc(m.what) + '</p>'
          + '<div class="mfields"><div><div class="k">Bäst för</div><div class="v">' + esc(m.bestFor) + '</div></div>'
          + '<div><div class="k">Färger</div><div class="v">' + esc(m.colors) + '</div></div></div>'
          + '<div class="arrow" style="text-align:right;">→</div></div></div>';
      }).join('');
    }
    var tb = document.querySelector('#metodTable tbody');
    if (tb && !tb.dataset.built) {
      tb.dataset.built = '1';
      tb.innerHTML = METODER.map(function (m) {
        return '<tr><th scope="row"><span class="mn">' + m.n + '</span><span class="mname">' + esc(m.name) + '</span></th>'
          + '<td>' + esc(m.bestFor) + '</td><td>' + esc(m.volume) + '</td><td>' + esc(m.colors) + '</td><td>' + esc(m.durability) + '</td><td>' + esc(m.feel) + '</td></tr>';
      }).join('');
    }
  }
  function openMetodModal(i) {
    var m = METODER[i]; if (!m) return;
    var host = document.getElementById('metodModal');
    host.innerHTML = '<div class="metod-modal-panel" role="dialog" aria-modal="true" aria-label="' + esc(m.name) + '">'
      + '<button class="close" aria-label="Stäng">✕</button>'
      + '<div style="aspect-ratio:16/9;overflow:hidden;background:#EBE7DC;"><img src="' + m.img + '" alt="" style="width:100%;height:100%;object-fit:cover;"></div>'
      + '<div style="padding:clamp(24px,3.5vw,40px);">'
      + '<div style="display:flex;align-items:baseline;gap:12px;"><span style="font-weight:700;font-size:14px;letter-spacing:.04em;color:var(--gold);">' + m.n + '</span>'
      + '<h3 class="h-sub" style="margin:0;">' + esc(m.name) + '</h3></div>'
      + '<p style="font-size:15px;line-height:1.6;color:rgba(28,23,18,.66);margin:14px 0 0;">' + esc(m.what) + '</p>'
      + '<div class="mgrid">'
      + field('Bäst för', m.bestFor) + field('Färger', m.colors) + field('Volym', m.volume)
      + field('Tålighet', m.durability) + field('Prisvärt när', m.priceWhen) + field('Mindre bra för', m.lessGood)
      + '<div style="grid-column:1 / -1;">' + fieldInner('Känsla', m.feel) + '</div>'
      + '</div></div></div>';
    host.style.display = 'flex';
    function field(k, v) { return '<div>' + fieldInner(k, v) + '</div>'; }
    function fieldInner(k, v) { return '<div class="k">' + k + '</div><div class="v">' + esc(v) + '</div>'; }
  }
  function closeMetodModal() { var h = document.getElementById('metodModal'); if (h) { h.style.display = 'none'; h.innerHTML = ''; } }

  /* Ansökan: designad inline-validering (formuläret är novalidate → detta är enda vägen).
     Fel = röd kant + fältmeddelande under inputen; rensas när användaren rättar. */
  function setFieldError(lab, inp, msg) {
    var err = lab.querySelector('.field-err-msg');
    if (msg) {
      inp.classList.add('field-invalid');
      inp.setAttribute('aria-invalid', 'true');
      if (!err) { err = document.createElement('span'); err.className = 'field-err-msg'; lab.appendChild(err); }
      err.textContent = msg;
    } else {
      inp.classList.remove('field-invalid');
      inp.removeAttribute('aria-invalid');
      if (err) err.remove();
    }
  }
  function validateAnsokForm(form) {
    var labels = form.querySelectorAll('label'); var firstBad = null;
    Array.prototype.forEach.call(labels, function (lab) {
      var inp = lab.querySelector('input'); if (!inp) return;
      var v = (inp.value || '').trim(); var msg = '';
      if (!v) { msg = 'Fyll i det här fältet.'; }
      else if (inp.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msg = 'Ange en giltig e-postadress.'; }
      else if (/org/i.test(lab.textContent) && !/^\d{6}-?\d{4}$/.test(v.replace(/\s/g, ''))) { msg = 'Ange org.nr som 556000-0000.'; }
      setFieldError(lab, inp, msg);
      if (msg && !firstBad) firstBad = inp;
    });
    if (firstBad) firstBad.focus();
    return !firstBad;
  }

  /* ============================================================
     KATALOG (D4) — reproducerar Noll33 Katalog.dc.html i vanilla.
     Ett val i taget: start → kön/kategori → plaggtyp → lista →
     produktsida + offertkorg. Läser window.NOLL33_*. Egen state,
     full re-render av kropp/overlay; sök-fältet är persistent (behåller
     fokus). Data-k-attribut + delegering styr allt.
     ============================================================ */
  var CAT = (function () {
    var GORDER = ['Dam', 'Herr', 'Barn', 'Unisex'];
    var PAGE = 48;
    // Kanonisk plaggtyps-ordning (samma i Herr/Dam/Unisex-menyerna för delade kategorier).
    var SUB_ORDER = ['T-shirts', 'Pikéer', 'Skjortor & blusar', 'Sweatshirts & hoodies', 'Stickat', 'Linnen', 'Byxor & jeans', 'Shorts', 'Klänningar & kjolar', 'Jackor & ytterplagg', 'Västar', 'Rockar & tunikor', 'Overaller', 'Förkläden', 'Sportkläder', 'Badkläder'];
    function subRank(s) { var i = SUB_ORDER.indexOf(s); return i < 0 ? 900 : i; }
    // "Sport & bad" + felklassade "Baby" delas per produkt: swim → Badkläder, annars Sportkläder.
    function normalizeSub(p) {
      var s = p.sub || '';
      if (s === 'Sport & bad' || s === 'Baby') return /swim/i.test(p.name || '') ? 'Badkläder' : 'Sportkläder';
      return s;
    }
    // Könsanpassat visningsnamn: Herr/Unisex döljer kvinnliga ord.
    function subLabel(sub, gender) {
      if (gender === 'Herr' || gender === 'Unisex') {
        if (sub === 'Skjortor & blusar') return 'Skjortor';
        if (sub === 'Rockar & tunikor') return 'Rockar';
      }
      return sub;
    }
    var ENDPOINT = 'https://lpumzlgmlhtaihbroxqg.supabase.co/functions/v1/noll33-inquiry';
    var root = null, bound = false, io = null, safetyTimer = null, data = null;
    var st = { family: '', gender: '', sub: '', brand: '', q: '', shown: 48, showAll: false,
      detailId: null, dcolor: 0, dview: 0, menu: null, sort: 'pop',
      cartOpen: false, panelQty: false, cartMsg: '', cartErr: '', cartKind: 'quote',
      cartSent: null, cartBusy: false, form: null, _retry: false };

    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function top() { try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); } }

    function ensureData() {
      if (data) return true;
      var P = window.NOLL33_PRODUCTS;
      if (!P || !P.length) return false;
      P.forEach(function (p) { p.sub = normalizeSub(p); });  // rätta plaggtyps-namn (split sport/bad + baby)
      var byId = {}, brands = [];
      P.forEach(function (p) { byId[p.id] = p; if (p.brand && brands.indexOf(p.brand) < 0) brands.push(p.brand); });
      brands.sort(function (a, b) { return a.localeCompare(b, 'sv'); });
      data = { P: P, FEAT: window.NOLL33_FEATURED || [], CATS: window.NOLL33_CATEGORIES || [], byId: byId, brands: brands };
      return true;
    }

    /* --- urval / härledning --- */
    function passes(p, skipG, skipS) {
      if (st.family && p.family !== st.family) return false;
      if (!skipG && st.gender && p.gender !== st.gender) return false;
      if (!skipS && st.sub && p.sub !== st.sub) return false;
      if (st.brand && p.brand !== st.brand) return false;
      if (st.q) { var hay = (p.name + ' ' + (p.brand || '') + ' ' + p.id).toLowerCase(); if (hay.indexOf(st.q) < 0) return false; }
      return true;
    }
    function mode() {
      if (st.detailId && data && data.byId[st.detailId]) return 'product';
      if (st.detailId && data) return 'notfound';   // id satt + katalog laddad men produkten finns ej → designat 404
      if (st.q) return 'products';
      if (!st.family) return 'start';
      if (!st.sub && !st.showAll) return 'category';
      return 'products';
    }
    function colorSort(colors) {
      function rank(c) {
        var hex = (((c && c.hex) || '') + '').replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&');
        var n = parseInt(hex, 16); if (hex.length !== 6 || isNaN(n)) return 1.5;
        var R = (n >> 16 & 255) / 255, G = (n >> 8 & 255) / 255, B = (n & 255) / 255;
        var mx = Math.max(R, G, B), mn = Math.min(R, G, B), d = mx - mn, l = (mx + mn) / 2, s = (d === 0) ? 0 : d / (1 - Math.abs(2 * l - 1));
        if (s < 0.16) return (1 - l);
        var hh = 0; if (mx === R) hh = ((G - B) / d) % 6; else if (mx === G) hh = (B - R) / d + 2; else hh = (R - G) / d + 4;
        hh *= 60; if (hh < 0) hh += 360; return 2 + hh / 360;
      }
      return (colors || []).map(function (c, i) { return { c: c, i: i, r: rank(c) }; })
        .sort(function (a, b) { return (a.r - b.r) || (a.i - b.i); }).map(function (x) { return x.c; });
    }
    function sizeSpan(p) {
      var all = []; (p.colors || []).forEach(function (c) { (c.sizes || []).forEach(function (sz) { if (all.indexOf(sz) < 0) all.push(sz); }); });
      if (!all.length) return ''; if (all.length === 1) return all[0]; return all[0] + '-' + all[all.length - 1];
    }
    // Prisgrind: listpriser visas bara för inloggade (Fas 1-kravet).
    function priceLabel(p) {
      if (!KONTO.loggedIn()) return 'Pris vid inloggning';
      return (p.priceFrom != null) ? ('från ' + p.priceFrom + ' kr') : 'Pris i offert';
    }
    // Varumärkesloggor per produkt: slug-matcha brand mot filnamn i assets/logos (hanterar .png/.jpg).
    var LOGO_FILES = ['bagbase.png','bandc.png','beechfield.png','bella-canvas.png','bombers-original.png','brook-taverner.jpg','buff.jpg','build-your-brand.png','cat.jpg','cg-international.jpg','cherokee.jpg','crocs.png','dickies-medical.png','dickies.png','estex.png','flexfit.png','front-row.png','fruit-of-the-loom.png','gildan.png','henbury.jpg','ideal-basic-brand.png','jsp.png','k-up.png','kariban-premium.png','kariban.png','kimood.png','larkwood.png','lee.png','mumbles.png','napapijri.png','native-spirit.png','onna.png','premier.png','proact.png','puma-workwear.png','quadra.jpg','result.jpg','russell.png','rywan.png','safejawz.png','sf-clothing.png','spasso.png','spiro.jpg','splashmacs.png','tiger-grip.png','timberland.png','tombo.jpg','towel-city.png','u-power.png','westford-mill.png','wk-designed-to-work.png','wrangler.png','yoko.jpg'];
    var LOGO_INDEX = (function () { var m = {}; LOGO_FILES.forEach(function (f) { m[f.replace(/\.[a-z]+$/, '')] = f; }); return m; })();
    function brandSlug(b) { return String(b || '').toLowerCase().replace(/&/g, 'and').replace(/[®™]/g, '').replace(/\./g, '').trim().replace(/[+\s]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''); }
    function brandLogoFile(b) { var s = brandSlug(b); return (s && LOGO_INDEX[s]) ? LOGO_INDEX[s] : null; }
    /* Loggorna har vitt skilda proportioner (kvadratiska emblem ↔ mycket breda
       ordmärken). En fast höjd/box gör breda märken dominanta och emblem till
       prickar. Vi normaliserar därför mot LIKA SYNLIG YTA: höjden sätts till
       √(mål-yta / bredd·höjd-förhållande) så alla loggor får ungefär samma
       "bläckmängd" på skärmen. Klamras bara som säkerhet mot extremfall. */
    function fitLogo(img) {
      var nw = img.naturalWidth, nh = img.naturalHeight;
      if (!nw || !nh) return;
      var lg = img.classList.contains('k-blogo-lg');
      var area = lg ? 2900 : 560;     // mål-yta i px² (detaljvyn klart större)
      var maxH = lg ? 62 : 30, maxW = lg ? 250 : 108;
      var r = nw / nh;                 // bredd/höjd
      var h = Math.sqrt(area / r);
      if (h > maxH) h = maxH;
      var w = h * r;
      if (w > maxW) { w = maxW; h = w / r; }
      img.style.height = h.toFixed(1) + 'px';
      img.style.width = w.toFixed(1) + 'px';
    }
    if (typeof window !== 'undefined') window.NOLL33_fitLogo = fitLogo;
    function brandHtml(b, cls) { var f = brandLogoFile(b); return f ? ('<img class="' + (cls || 'k-blogo') + '" src="assets/logos/' + f + '" alt="' + esc(b) + '" title="' + esc(b) + '" loading="lazy" onload="window.NOLL33_fitLogo&&window.NOLL33_fitLogo(this)">') : esc(b || ''); }
    function subCountsSorted() {
      var counts = {}; data.P.forEach(function (p) { if (passes(p, false, true) && p.sub) counts[p.sub] = (counts[p.sub] || 0) + 1; });
      var keys = Object.keys(counts).sort(function (a, b) { if (a === 'Övrigt' || a === 'Ovrigt') return 1; if (b === 'Övrigt' || b === 'Ovrigt') return -1; return (subRank(a) - subRank(b)) || (counts[b] - counts[a]); });
      return keys.map(function (k) { return { sub: k, n: counts[k] }; });
    }
    function typeImage(sub) {
      var packshot = null;
      for (var i = 0; i < data.P.length; i++) { var p = data.P[i]; if (p.sub === sub && passes(p, false, true)) {
        if (p.imagePhoto && p.image) return { src: p.image, photo: true };
        if (!packshot) { var f = (p.colors && p.colors[0] && p.colors[0].face) || p.image; if (f) packshot = { src: f, photo: false }; }
      } }
      return packshot || { src: '', photo: false };
    }
    function studioUrl(p, col) { return PRNTR_STUDIO + '/?from=noll33&garment_id=' + encodeURIComponent(p.id) + '&color=' + encodeURIComponent((col && col.name) || '') + '&qty=50'; }
    // Kuraterade kategoribilder (valda av kund) — vinner över auto-valet.
    var CAT_IMG = {
      'Klädaccessoarer': 'https://cdn.toptex.com/pictures/K861-2_2026.jpg',   // burgundy satin-halsduk
      'Hemtextil': 'https://cdn.toptex.com/pictures/GI18900_2025.jpg',        // vikta fleeceplädar på stol
      'Underkläder': 'https://cdn.toptex.com/pictures/K800-4_2025.jpg'        // herrkalsong
    };
    // Kategoribild: kuraterad → modellfoto i förstahand (första produkt i kategorin med imagePhoto) → packshot.
    function catImage(cat, fallback) {
      if (CAT_IMG[cat]) return { src: CAT_IMG[cat], photo: true };
      for (var i = 0; i < data.P.length; i++) { var p = data.P[i]; if (p.family === cat && p.imagePhoto && p.image) return { src: p.image, photo: true }; }
      return { src: fallback || '', photo: false };
    }

    /* --- korg (localStorage) --- */
    function loadCart() { try { var a = JSON.parse(localStorage.getItem('noll33_cart_v1')); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
    function saveCart(c) { try { localStorage.setItem('noll33_cart_v1', JSON.stringify(c)); } catch (e) {} }
    function clientKey() { try { var k = localStorage.getItem('noll33_cart_key_v1'); if (!k) { k = 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10); localStorage.setItem('noll33_cart_key_v1', k); } return k; } catch (e) { return 'c_' + Date.now(); } }
    function cartLines() { return loadCart().length; }
    function detailCtx() {
      var p = data.byId[st.detailId]; if (!p) return null;
      var colors = colorSort(p.colors || []);
      var ci = Math.min(st.dcolor, Math.max(0, colors.length - 1));
      var col = colors[ci] || {};
      var photoViews = (p.gallery || []).slice(0, 4).map(function (g) { return { src: g, photo: true }; });
      var packViews = [col.face, col.back, col.side].filter(Boolean).map(function (x) { return { src: x, photo: false }; });
      var views = packViews.concat(photoViews); if (!views.length) views = [{ src: p.image, photo: false }];
      var vi = Math.min(st.dview || 0, views.length - 1);
      return { p: p, colors: colors, ci: ci, col: col, views: views, vi: vi };
    }

    /* --- navigering --- */
    function setState(patch) {
      if (st.cartOpen) snapshotForm();
      Object.assign(st, patch);
      // Rör bara menyn? Rendera inte om sidkroppen — annars byggs alla
      // produktbilder om vid varje kategoriväxling (ser ut som sidomladdning).
      var keys = Object.keys(patch);
      if (keys.length && keys.every(function (k) { return k === 'menu'; })) { renderMenu(); return; }
      renderAll();
    }
    function goCategory(name, gender) { setState({ family: name, gender: gender || '', sub: '', showAll: false, brand: '', q: '', shown: 48, detailId: null }); top(); }
    function setSub(sub) { setState({ sub: sub, showAll: false, shown: 48 }); top(); }
    function showAllProducts() { setState({ showAll: true, sub: '', shown: 48 }); top(); }
    function goBack() {
      if (st.q) { setState({ q: '', shown: 48 }); top(); return; }
      if (st.sub || st.showAll) { setState({ sub: '', showAll: false, shown: 48 }); top(); return; }
      setState({ family: '', gender: '', shown: 48 }); top();
    }
    function clearFilters() { setState({ q: '', family: '', gender: '', sub: '', brand: '', showAll: false, shown: 48 }); }
    function openDetail(id) { setState({ detailId: id, dcolor: 0, dview: 0, panelQty: false, cartMsg: '' }); top(); }
    function closeDetail() { setState({ detailId: null }); }
    function stepView(dir) { var c = detailCtx(); if (c && c.views.length > 1) setState({ dview: (c.vi + dir + c.views.length) % c.views.length }); }

    /* --- korg-åtgärder --- */
    function addToCart() {
      if (!st.panelQty) { setState({ panelQty: true, cartMsg: '' }); return; }
      var c = detailCtx(); if (!c) return; var col = c.col;
      var sizes = {}; root.querySelectorAll('[data-qtysize]').forEach(function (inp) { var n = parseInt(inp.value, 10); if (!inp.disabled && n > 0) sizes[inp.getAttribute('data-qtysize')] = n; });
      if (!Object.keys(sizes).length) { setState({ cartMsg: 'Ange antal för minst en storlek.' }); return; }
      var cart = loadCart(), ex = null;
      cart.forEach(function (r) { if (r.productId === c.p.id && r.color === (col.name || '')) ex = r; });
      if (ex) { Object.keys(sizes).forEach(function (sz) { ex.sizes[sz] = (ex.sizes[sz] || 0) + sizes[sz]; }); }
      else cart.push({ productId: c.p.id, productName: c.p.name, brand: c.p.brand || '', color: col.name || '', hex: col.hex || '', sizes: sizes, priceFrom: (c.p.priceFrom != null ? c.p.priceFrom : null), image: col.face || c.p.image || null });
      saveCart(cart);
      setState({ panelQty: false, cartMsg: 'Tillagd i korgen ✓' });
    }
    function removeRow(idx) { var c = loadCart(); c.splice(idx, 1); saveCart(c); setState({}); }
    function onCartQty(t) {
      snapshotForm();
      var idx = Number(t.getAttribute('data-cartidx')), sz = t.getAttribute('data-cartsize'), n = parseInt(t.value, 10);
      var c = loadCart(), r = c[idx]; if (!r) return;
      if (n > 0) r.sizes[sz] = n; else delete r.sizes[sz];
      c = c.filter(function (x) { return Object.keys(x.sizes).length > 0; });
      saveCart(c); renderAll();
    }
    function snapshotForm() { var f = st.form || {}; ['name', 'company', 'email', 'phone', 'message'].forEach(function (k) { var el = document.getElementById('k-cart-' + k); if (el) f[k] = el.value; }); st.form = f; }
    function submitCart() {
      if (st.cartBusy) return;
      var cart = loadCart();
      if (!cart.length) { setState({ cartErr: 'Korgen är tom.' }); return; }
      function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
      var name = val('k-cart-name'), email = val('k-cart-email');
      if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setState({ cartErr: 'Fyll i namn och en giltig e-postadress.' }); return; }
      var kind = st.cartKind === 'order' ? 'order' : 'quote';
      var payload = { client_key: clientKey(), kind: kind, customer: { name: name, company: val('k-cart-company'), email: email, phone: val('k-cart-phone') }, message: val('k-cart-message'), items: cart.map(function (r) { return { productId: r.productId, productName: r.productName, brand: r.brand, color: r.color, sizes: r.sizes, priceFrom: r.priceFrom }; }) };
      snapshotForm(); st.cartBusy = true; st.cartErr = ''; renderAll();
      fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (res) { return res.json().then(function (b) { return { status: res.status, body: b }; }); })
        .then(function (r) {
          if (r.status === 200 && r.body && r.body.ok) { saveCart([]); try { localStorage.removeItem('noll33_cart_key_v1'); } catch (e) {} st.form = null; setState({ cartBusy: false, cartSent: { nr: r.body.request_number, kind: kind } }); }
          else { setState({ cartBusy: false, cartErr: (r.body && r.body.error) || 'Något gick fel. Försök igen.' }); }
        })
        .catch(function () { setState({ cartBusy: false, cartErr: 'Kunde inte nå servern. Försök igen.' }); });
    }

    /* --- karusell "Köp ihop med" --- */
    function relMove(dir) {
      var vp = root.querySelector('.k-related-grid'); var tr = vp && vp.querySelector('.k-related-track'); if (!tr) return;
      var max = tr.scrollWidth - vp.clientWidth; if (max < 0) max = 0;
      var cur = parseFloat(vp.getAttribute('data-off') || '0'); var step = Math.round(vp.clientWidth * 0.8);
      var next = cur + dir * step; if (next > 0) next = 0; if (next < -max) next = -max;
      vp.setAttribute('data-off', next); tr.style.transition = 'transform .45s cubic-bezier(.16,1,.3,1)'; tr.style.transform = 'translateX(' + next + 'px)';
    }
    function attachRelWheel() {
      var g = root.querySelector('.k-related-grid'); if (!g || g.__mw) return; g.__mw = 1;
      g.addEventListener('wheel', function (e) {
        var tr = g.querySelector('.k-related-track'); if (!tr) return;
        var max = tr.scrollWidth - g.clientWidth; if (max <= 0) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        var cur = parseFloat(g.getAttribute('data-off') || '0'); var next = cur - e.deltaY * 3.2;
        if (next > 0) next = 0; if (next < -max) next = -max;
        g.setAttribute('data-off', next); tr.style.transition = 'none'; tr.style.transform = 'translateX(' + next + 'px)'; e.preventDefault();
      }, { passive: false });
    }

    /* --- rendering --- */
    function renderNavBtns() {
      var present = {}; data.P.forEach(function (p) { if (p.family === 'Kläder') present[p.gender] = 1; });
      var keys = GORDER.filter(function (g) { return present[g]; }).concat(['Sortiment']);
      return keys.map(function (k) {
        var open = st.menu === k;
        return '<button class="k-navbtn' + (open ? ' is-open' : '') + '" data-k="toggleMenu" data-menu="' + esc(k) + '" aria-haspopup="true" aria-expanded="' + (open ? 'true' : 'false') + '"><span class="k-navlbl">' + esc(k) + '</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"></path></svg></button>';
      }).join('');
    }
    function renderFly() {
      if (!st.menu) return '';
      var inner;
      if (st.menu === 'Sortiment') {
        // Ingen rubrik i flyouten — guld-understrykningen på navknappen pekar redan ut valet.
        inner = '<div class="k-fly-list">' +
          data.CATS.map(function (c) { return '<button class="k-fly-link" data-k="flyCat" data-cat="' + esc(c.name) + '"><span class="k-fly-lbl">' + esc(c.name) + '</span></button>'; }).join('') + '</div>' +
          '<button class="k-fly-all" data-k="flyReset">Visa hela sortimentet</button>';
      } else {
        var mg = st.menu, subc = {};
        data.P.forEach(function (p) { if (p.family === 'Kläder' && p.gender === mg && p.sub) subc[p.sub] = (subc[p.sub] || 0) + 1; });
        var mk = Object.keys(subc).sort(function (a, b) { if (a === 'Övrigt' || a === 'Ovrigt') return 1; if (b === 'Övrigt' || b === 'Ovrigt') return -1; return (subRank(a) - subRank(b)) || (subc[b] - subc[a]); });
        inner = '<div class="k-fly-list">' +
          mk.map(function (sub) { return '<button class="k-fly-link" data-k="flySub" data-gender="' + esc(mg) + '" data-sub="' + esc(sub) + '"><span class="k-fly-lbl">' + esc(subLabel(sub, mg)) + '</span></button>'; }).join('') +
          '</div><button class="k-fly-all" data-k="flyAll" data-gender="' + esc(mg) + '">Visa alla ' + esc(mg.toLowerCase()) + 'plagg</button>';
      }
      return '<div class="k-fly"><div class="k-fly-inner">' + inner + '</div></div>';
    }
    function renderStart() {
      function findImg(g) {
        for (var i = 0; i < data.P.length; i++) { var p = data.P[i]; if (p.family === 'Kläder' && p.gender === g && p.imagePhoto && p.image) return { src: p.image, photo: true }; }
        for (var j = 0; j < data.P.length; j++) { var q = data.P[j]; if (q.family === 'Kläder' && q.gender === g) { var f = (q.colors && q.colors[0] && q.colors[0].face) || q.image; if (f) return { src: f, photo: false }; } }
        return { src: '', photo: false };
      }
      var present = {}; data.P.forEach(function (p) { if (p.family === 'Kläder') present[p.gender] = 1; });
      var DISCOVER_IMG = {
        Herr: 'https://cdn.toptex.com/pictures/SP504-17_2025.jpg',    // Spasso Men's linen shirt
        Dam: 'https://cdn.toptex.com/pictures/SP5008_2025.jpg',       // Spasso Ladies' linen dress shirt
        Unisex: 'https://cdn.toptex.com/pictures/K497-24_2024.jpg',   // Kariban Unisex teddy fleece jacket
        Barn: 'https://cdn.toptex.com/pictures/CGTK002_2025.jpg'      // B&C Kids t-shirt #E190
      };
      var discover = [['Herr', 'Utforska herrsortimentet'], ['Dam', 'Utforska damsortimentet'], ['Barn', 'Utforska barnsortimentet'], ['Unisex', 'Utforska unisexsortimentet']]
        .filter(function (x) { return present[x[0]]; })
        .map(function (x) {
          if (DISCOVER_IMG[x[0]]) return { g: x[0], sub: x[1], img: DISCOVER_IMG[x[0]], photo: true };
          var r = findImg(x[0]); return { g: x[0], sub: x[1], img: r.src, photo: r.photo };
        });
      var discoverHtml = discover.map(function (c) {
        return '<button class="k-dcard k-reveal" data-k="category" data-cat="Kläder" data-gender="' + esc(c.g) + '" aria-label="' + esc(c.g + ', ' + c.sub) + '">' +
          (!c.photo ? '<span class="k-ph">Lifestylebild kommer</span>' : '') +
          '<img class="' + (c.photo ? 'photo' : '') + '" src="' + esc(c.img) + '" alt="' + esc(c.g) + '">' +
          '<span class="k-dcard-grad"></span>' +
          '<span class="k-dcard-txt"><span class="k-dcard-h">' + esc(c.g) + '</span><span class="k-dcard-sub">' + esc(c.sub) + '</span></span></button>';
      }).join('');
      var catsHtml = data.CATS.map(function (c) {
        var ci = catImage(c.name, c.image);
        return '<div class="k-tile k-reveal"><button class="k-plate" data-k="flyCat" data-cat="' + esc(c.name) + '" aria-label="' + esc(c.name) + '"><img class="' + (ci.photo ? 'photo' : '') + '" src="' + esc(ci.src) + '" alt="' + esc(c.name) + '"></button><div class="k-tile-name">' + esc(c.name) + '</div><div class="k-tile-count">' + esc((c.count || 0) + ' produkter') + '</div></div>';
      }).join('');
      var feat = data.FEAT.map(function (id) { return data.byId[id]; }).filter(Boolean).slice(0, 10).map(function (p) {
        var img = p.image || (p.colors && p.colors[0] && p.colors[0].face) || '';
        return '<button class="k-featcard" data-k="open" data-id="' + esc(p.id) + '" aria-label="' + esc(p.name) + '"><span class="k-plate"><img class="' + (p.imagePhoto ? 'photo' : '') + '" src="' + esc(img) + '" alt="' + esc(p.name) + '" loading="lazy"></span><div class="k-tile-name">' + esc(p.name) + '</div><div class="k-tile-count">' + esc(priceLabel(p)) + '</div></button>';
      }).join('');
      var story = '<div class="k-story"><h3 class="k-story-h">Sortiment byggt för förädling</h3>' +
        '<p class="k-story-lead" style="margin-bottom:14px">Ett kurerat sortiment av basplagg, arbetskläder, sport och accessoarer från ledande varumärken — B&amp;C, Kariban, Native Spirit, Result med flera. Vi väljer plagg som bär tryck, brodyr och vävda märken väl: jämn yta att trycka på, passform som sitter serie efter serie och färger som klarar tvätten. Det mesta finns i hela storleksregistret och ett brett färgspann, så en beställning kan hålla ihop från barnstorlek till 5XL.</p>' +
        '<p class="k-story-lead">Vi trycker, broderar och märker åt återförsäljare — alltid white-label. Du säljer vidare i ditt eget namn, vi står för hantverket. Från enstaka prov till serier i tusental, med samma folk och maskiner genom hela kedjan.</p>' +
        '<div class="k-story-grid">' +
        '<div class="k-story-item"><h4>Brett sortiment</h4><p>Basplagg, arbetskläder, sport, accessoarer och profiltextil — samlade hos en leverantör. Fyll på samma modell om ett år, färgerna och passformen sitter kvar.</p></div>' +
        '<div class="k-story-item"><h4>Sex metoder</h4><p>Screentryck, screentransfer, DTG, DTF, brodyr och vävda märken — allt in-house. Vi väljer metod efter plagg, motiv och upplaga, inte tvärtom.</p></div>' +
        '<div class="k-story-item"><h4>Hållbarhet</h4><p>GOTS- och Oeko-Tex-certifierade basplagg när projektet kräver det, och vattenbaserade färger i trycket. Vi förädlar mot order snarare än lager — det håller nere överproduktion och svinn.</p></div>' +
        '</div></div>';
      return '<div class="k-wrap">' +
        '<div class="k-head"><div class="k-eyebrow">Sortiment</div><h1 class="k-h1">Plagg att förädla</h1><p class="k-lead">Basplagg från ledande varumärken, redo för tryck, brodyr och vävda märken. Välj kön eller kategori i menyn ovan, eller börja med en ingång nedan.</p></div>' +
        '<div class="k-sec k-sec-first"><div class="k-discover">' + discoverHtml + '</div></div>' +
        '<div class="k-sec"><div class="k-sec-h">Bläddra efter kategori</div><div class="k-tiles">' + catsHtml + '</div></div>' +
        (feat ? '<div class="k-sec k-featured"><div class="k-sec-h">Mest populära</div><div class="k-featrow">' + feat + '</div></div>' : '') +
        story + '<div class="k-footpad"></div></div>';
    }
    function renderCategory() {
      var subs = subCountsSorted();
      var tiles = subs.map(function (o) { var ti = typeImage(o.sub); var lbl = subLabel(o.sub, st.gender); return '<div class="k-tile k-reveal"><button class="k-plate" data-k="setSub" data-sub="' + esc(o.sub) + '" aria-label="' + esc(lbl) + '"><img class="' + (ti.photo ? 'photo' : '') + '" src="' + esc(ti.src) + '" alt="' + esc(lbl) + '" loading="lazy"></button><div class="k-tile-name">' + esc(lbl) + '</div><div class="k-tile-count">' + esc(o.n + ' produkter') + '</div></div>'; }).join('');
      var total = 0; data.P.forEach(function (p) { if (passes(p, false, true)) total++; });
      return '<div class="k-wrap"><div class="k-crumb"><button class="k-back" data-k="goBackAll">‹ Alla kategorier</button>' +
        (st.gender ? '<div class="k-ctx">' + esc(st.gender) + '</div>' : '') +
        '<h2 class="k-h2">' + esc(st.family) + '</h2></div>' +
        '<div class="k-tiles">' + tiles + '</div>' +
        '<div class="k-showall"><button data-k="showAll">Visa alla ' + total + ' produkter</button></div>' +
        '<div class="k-footpad"></div></div>';
    }
    function renderCard(p) {
      var c0 = p.colors && p.colors[0];
      var isPhoto = !!p.imagePhoto;
      var face = p.image || (c0 && c0.face) || '';
      var backRaw = isPhoto ? ((p.gallery && p.gallery[1]) || null) : ((c0 && c0.back) || (c0 && c0.side) || null);
      var hasBack = !!backRaw;
      var shown = colorSort(p.colors || []).slice(0, 6);
      var dots = shown.map(function (c) { return '<span class="k-swatch" style="background:' + esc(c.hex || '#ccc') + '"></span>'; }).join('');
      var moreCount = (p.colors || []).length - shown.length;
      var span = sizeSpan(p);
      return '<button class="k-card k-reveal' + (hasBack ? ' k-hasback' : '') + '" data-k="open" data-id="' + esc(p.id) + '" aria-label="' + esc(p.name + (p.brand ? ', ' + p.brand : '')) + '">' +
        '<span class="k-card-img"><img class="k-face' + (isPhoto ? ' photo' : '') + '" src="' + esc(face) + '" alt="' + esc(p.name) + '" loading="lazy">' +
        (hasBack ? '<img class="k-backimg' + (isPhoto ? ' photo' : '') + '" src="' + esc(backRaw) + '" alt="" loading="lazy">' : '') + '</span>' +
        '<div class="k-brand">' + brandHtml(p.brand) + '</div><div class="k-name">' + esc(p.name) + '</div>' +
        '<div class="k-swatches">' + dots + (moreCount > 0 ? '<span class="k-more">+' + moreCount + '</span>' : '') + '</div>' +
        '<div class="k-meta">' + esc(priceLabel(p) + (span ? (' · ' + span) : '')) + '</div></button>';
    }
    function renderProducts() {
      var all = data.P.filter(function (p) { return passes(p, false, false); });
      if (st.sort === 'price-asc') all.sort(function (a, b) { return (a.priceFrom == null ? 1e9 : a.priceFrom) - (b.priceFrom == null ? 1e9 : b.priceFrom); });
      else if (st.sort === 'price-desc') all.sort(function (a, b) { return (b.priceFrom == null ? -1 : b.priceFrom) - (a.priceFrom == null ? -1 : a.priceFrom); });
      else if (st.sort === 'name') all.sort(function (a, b) { return String(a.name || '').localeCompare(String(b.name || ''), 'sv'); });
      var subTitle = st.q ? ('Sökning: ' + st.q) : (st.sub ? subLabel(st.sub, st.gender) : (st.family || 'Alla produkter'));
      var backLabel = st.q ? '‹ Alla kategorier' : ('‹ ' + (st.family || 'Alla kategorier'));
      var ctx = (st.gender && !st.q) ? '<div class="k-ctx">' + esc(st.gender) + '</div>' : '';
      var brandOpts = '<option value="">Alla varumärken</option>' + data.brands.map(function (b) { return '<option value="' + esc(b) + '"' + (st.brand === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('');
      var sortOpts = [['pop', 'Populärast'], ['price-asc', 'Pris: låg till hög'], ['price-desc', 'Pris: hög till låg'], ['name', 'Namn A-Ö']].map(function (o) { return '<option value="' + o[0] + '"' + (st.sort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('');
      var head = '<div class="k-crumb"><button class="k-back" data-k="goBack">' + esc(backLabel) + '</button>' + ctx + '<h2 class="k-h2">' + esc(subTitle) + '</h2></div>';
      var toolbar = '<div class="k-toolbar"><select class="k-select" id="kSort" aria-label="Sortera">' + sortOpts + '</select><select class="k-select" id="kBrand" aria-label="Filtrera på varumärke">' + brandOpts + '</select><span class="k-count">' + all.length + (all.length === 1 ? ' produkt' : ' produkter') + '</span></div>';
      if (!all.length) return '<div class="k-wrap">' + head + toolbar + '<div class="k-empty"><div>Inga produkter matchar.</div><button data-k="clearFilters">Rensa filter</button></div><div class="k-footpad"></div></div>';
      var visible = all.slice(0, st.shown);
      var grid = visible.map(renderCard).join('');
      var more = '';
      if (all.length > st.shown) {
        var pct = Math.max(4, Math.round(visible.length / all.length * 100));
        more = '<div class="k-morewrap"><div class="k-moremeta">' +
          '<span class="k-count">Visar ' + visible.length + ' av ' + all.length + ' produkter</span>' +
          '<div class="k-progress" role="progressbar" aria-valuenow="' + visible.length + '" aria-valuemax="' + all.length + '"><span style="width:' + pct + '%"></span></div>' +
          '</div><button class="k-morebtn" data-k="more">Visa fler</button></div>';
      }
      return '<div class="k-wrap">' + head + toolbar + '<div class="k-grid">' + grid + '</div>' + more + '<div class="k-footpad"></div></div>';
    }
    function renderRelated(p) {
      var seen = {}; seen[p.id] = 1;
      var pool = data.P.filter(function (x) { return !seen[x.id] && (x.gender === p.gender || x.gender === 'Unisex') && x.sub && x.sub !== p.sub; });
      if (pool.length < 8) pool = data.P.filter(function (x) { return !seen[x.id] && x.family === p.family && x.sub && x.sub !== p.sub; });
      var groups = {}, order = [];
      pool.forEach(function (x) { if (!groups[x.sub]) { groups[x.sub] = []; order.push(x.sub); } groups[x.sub].push(x); });
      order.forEach(function (su) { groups[su] = groups[su].filter(function (y) { return y.imagePhoto; }).concat(groups[su].filter(function (y) { return !y.imagePhoto; })); });
      var picked = [], guard = 0;
      while (picked.length < 12 && order.length && guard++ < 400) { var su = order[picked.length % order.length]; if (groups[su] && groups[su].length) picked.push(groups[su].shift()); else { var idx = order.indexOf(su); if (idx > -1) order.splice(idx, 1); } }
      if (picked.length < 12) pool.forEach(function (x) { if (picked.length < 12 && picked.indexOf(x) < 0) picked.push(x); });
      if (!picked.length) return '';
      var cards = picked.map(function (x) {
        var c0 = x.colors && x.colors[0]; var img = x.image || (c0 && c0.face) || ''; var isPhoto = !!x.imagePhoto;
        return '<button class="k-relcard" data-k="open" data-id="' + esc(x.id) + '" aria-label="' + esc(x.name) + '"><span class="k-card-img"><img class="' + (isPhoto ? 'photo' : '') + '" src="' + esc(img) + '" alt="' + esc(x.name) + '" loading="lazy"></span><div class="k-brand">' + brandHtml(x.brand) + '</div><div class="k-name">' + esc(x.name) + '</div><div class="k-meta">' + esc(priceLabel(x)) + '</div></button>';
      }).join('');
      return '<div class="k-related"><div class="k-related-head"><div class="k-related-h">Köp ihop med</div><div class="k-relnav"><button data-k="relPrev" aria-label="Föregående">‹</button><button data-k="relNext" aria-label="Nästa">›</button></div></div><div class="k-related-grid" data-off="0"><div class="k-related-track">' + cards + '</div></div></div>';
    }
    function renderProduct() {
      var c = detailCtx(); if (!c) return renderProducts();
      var p = c.p, col = c.col, colors = c.colors, views = c.views, vi = c.vi, ci = c.ci;
      var mainV = views[vi];
      var stage = '<div class="k-prod-stage" data-k="nextView"><img src="' + esc(mainV.src) + '" alt="' + esc(p.name) + '" class="' + (mainV.photo ? 'photo' : '') + '"></div>';
      var stagenav = views.length > 1 ? '<div class="k-stagenav"><button data-k="prevView" aria-label="Föregående bild">‹</button><button data-k="nextView" aria-label="Nästa bild">›</button></div>' : '';
      var thumbs = views.length > 1 ? '<div class="k-prod-thumbs">' + views.map(function (v, idx) { return '<button class="k-dthumb' + (idx === vi ? ' is-active' : '') + '" data-k="setView" data-i="' + idx + '"><img src="' + esc(v.src) + '" alt="" class="' + (v.photo ? 'photo' : '') + '"></button>'; }).join('') + '</div>' : '';
      var colorsHtml = colors.length ? '<div class="k-dlabel">Färg</div><div class="k-dcolors">' + colors.map(function (cc, i) { return '<button class="k-dcolor' + (i === ci ? ' is-active' : '') + '" style="background:' + esc(cc.hex || '#ccc') + '" data-k="setColor" data-i="' + i + '" aria-label="' + esc(cc.name || '') + '"></button>'; }).join('') + '</div><div class="k-dcolorname">' + esc(col.name || '') + '</div>' : '';
      var sizesArr = col.sizes || [], sizesHtml = '';
      if (sizesArr.length) {
        var chips = sizesArr.map(function (sz) { var lvl = col.stock && col.stock[sz]; var cls = lvl === 'order' ? 'order' : (lvl === 'out' ? 'out' : ''); return '<span class="k-size ' + cls + '">' + esc(sz + (lvl === 'order' ? '*' : '')) + '</span>'; }).join('');
        var stockNote = (function () { if (!col.stock) return ''; var af = false, ao = false; sizesArr.forEach(function (sz) { var l = col.stock[sz]; if (l === 'order') ao = true; else if (l !== 'out') af = true; }); if (!af && !ao) return ''; return (af ? 'I lager hos leverantör — leverans normalt 2–4 dagar. ' : '') + (ao ? '* Beställningsvara — längre leveranstid, bekräftas i offerten.' : ''); })();
        sizesHtml = '<div class="k-dlabel">Storlekar</div><div class="k-dsizes">' + chips + '</div>' + (stockNote ? '<div class="k-stocknote">' + esc(stockNote) + '</div>' : '');
      }
      var specOrder = [['material', 'Material'], ['vikt', 'Vikt'], ['passform', 'Passform'], ['hals', 'Hals'], ['stangning', 'Stängning'], ['etikett', 'Etikett'], ['vattenpelare', 'Vattenpelare'], ['ursprung', 'Ursprung'], ['tryckyta', 'Tryckyta']];
      var specRows = []; specOrder.forEach(function (r) { var v = p.specs && p.specs[r[0]]; if (v) specRows.push('<tr><td>' + esc(r[1]) + '</td><td>' + esc(v) + '</td></tr>'); });
      var certs = p.certs || [], datablad = (p.specs && p.specs.datablad) || '';
      var hasSpecs = specRows.length || certs.length || datablad || p.utgaende;
      var specsHtml = hasSpecs ? '<div class="k-detailsblock"><div class="k-dlabel">Produktdetaljer</div><table class="k-spectable"><tbody>' + specRows.join('') + '</tbody></table>' + (certs.length ? '<div class="k-certs">' + esc(certs.join(' · ')) + '</div>' : '') + (p.utgaende ? '<div class="k-discont">Utgående modell — begär offert för ersättare.</div>' : '') + '</div>' : '';
      var databladHtml = datablad ? '<a class="k-doclink k-doclink-bottom" href="' + esc(datablad) + '" target="_blank" rel="noopener">Tekniskt datablad (PDF)</a>' : '';
      var avail = sizesArr.filter(function (sz) { return !(col.stock && col.stock[sz] === 'out'); });
      var qtyHtml = '';
      if (st.panelQty) {
        var cells = avail.map(function (sz) { var o = col.stock && col.stock[sz] === 'order'; return '<label class="k-qtycell">' + esc(sz + (o ? '*' : '')) + '<input type="number" min="0" step="1" inputmode="numeric" placeholder="0" data-qtysize="' + esc(sz) + '"></label>'; }).join('');
        var anyOrder = avail.some(function (sz) { return col.stock && col.stock[sz] === 'order'; });
        qtyHtml = '<div class="k-dlabel">Antal per storlek</div><div class="k-qtygrid">' + cells + '</div>' + (anyOrder ? '<div class="k-stocknote">* Beställningsvara — längre leveranstid, bekräftas i offerten.</div>' : '');
      }
      var noAvail = avail.length === 0;
      var ctaLabel = noAvail ? 'Tillfälligt slut i denna färg' : (st.panelQty ? 'Lägg till i korgen' : 'Lägg i korgen');
      var cta = '<button class="k-cta" data-k="addToCart"' + (noAvail ? ' disabled style="opacity:.5;cursor:not-allowed"' : '') + '>' + esc(ctaLabel) + '</button>';
      var cartMsg = st.cartMsg ? '<div class="k-ctanote">' + esc(st.cartMsg) + '</div>' : '';
      // Skarp Designa-länk bara i förhandsvisningsläget (?designa=1) — publikt
      // står den som "kommer snart" tills studion är redo för kunder.
      var designbtn = '';
      if (p.designbar) {
        designbtn = designPreviewOn()
          ? '<a class="k-designbtn" href="' + esc(studioUrl(p, col)) + '">Designa med tryck →</a>'
          : '<button class="k-designbtn is-soon" type="button" disabled aria-disabled="true">Designa med tryck — kommer snart</button>';
      }
      var priceHtml = KONTO.loggedIn()
        ? '<div class="k-dprice">' + esc(priceLabel(p)) + '</div><div class="k-dnote">Listpris utan förädling. Ert pris med tryck eller brodyr lämnas i offert.</div>'
        : '<div class="k-dprice">Pris vid inloggning</div><div class="k-dnote"><a href="#" class="gold-link" data-nav="login" style="font-size:12.5px">Logga in</a> för att se era priser.</div>';
      var info = '<div class="k-prod-info"><div class="k-dbrand">' + brandHtml(p.brand, 'k-blogo k-blogo-lg') + '</div><div class="k-dname">' + esc(p.name) + '</div>' + colorsHtml + sizesHtml + specsHtml + databladHtml + priceHtml + qtyHtml + cta + cartMsg + designbtn + '</div>';
      var media = '<div class="k-prod-media">' + stage + stagenav + thumbs + '</div>';
      return '<div class="k-wrap k-prodwrap"><div class="k-crumb"><button class="k-back" data-k="closeDetail">‹ ' + esc(p.sub ? subLabel(p.sub, p.gender) : (p.family || 'Sortiment')) + '</button></div>' +
        '<div class="k-prod">' + media + info + '</div>' + renderRelated(p) + '<div class="k-footpad"></div></div>';
    }
    function renderBody() {
      var m = mode();
      if (m === 'start') return renderStart();
      if (m === 'category') return renderCategory();
      if (m === 'product') return renderProduct();
      if (m === 'notfound') return renderNotFound();
      return renderProducts();
    }
    /* Designat 404-läge för okänd produkt-id (annars föll man tyst till katalog-starten). */
    function renderNotFound() {
      return '<div class="k-wrap">' +
        '<div class="k-crumb"><button class="k-back" data-k="flyReset">‹ Till sortimentet</button></div>' +
        '<div class="k-notfound">' +
          '<div class="k-ctx">404 · Produkten</div>' +
          '<h2 class="k-h2">Produkten hittades inte</h2>' +
          '<p class="k-nf-text">Artikeln kan ha utgått, eller så stämmer inte länken. Utforska hela sortimentet så hittar vi rätt plagg åt dig.</p>' +
          '<button class="k-nf-btn" data-k="flyReset">Till sortimentet →</button>' +
        '</div><div class="k-footpad"></div></div>';
    }
    function renderCart() {
      var cart = loadCart();
      var count = cart.reduce(function (t, r) { return t + Object.keys(r.sizes).reduce(function (a, k) { return a + (r.sizes[k] || 0); }, 0); }, 0);
      var head = '<div class="k-carthead"><div class="k-carttitle">Offertkorg</div><button class="k-drawer-close" data-k="closeCart" aria-label="Stäng korgen">✕</button></div>';
      var inner;
      if (st.cartSent) {
        var kind = st.cartSent.kind;
        inner = '<div class="k-cartsuccess"><div class="k-cartsuccess-h">' + (kind === 'order' ? 'Tack! Din beställning #' : 'Tack! Din offertförfrågan #') + esc(st.cartSent.nr) + ' är mottagen.</div><p>Vi återkommer inom kort till din e-postadress med ' + (kind === 'order' ? 'orderbekräftelse och slutpris.' : 'en offert.') + '</p></div>';
      } else if (!cart.length) {
        inner = '<p class="k-cartempty">Korgen är tom. Öppna en produkt och välj antal per storlek.</p>';
      } else {
        var f = st.form || {};
        var rows = cart.map(function (r, idx) {
          var meta = [r.brand, r.color].filter(Boolean).join(' · ') + (KONTO.loggedIn() && r.priceFrom != null ? (' · från ' + r.priceFrom + ' kr/st') : '');
          var total = Object.keys(r.sizes).reduce(function (a, sz) { return a + (r.sizes[sz] || 0); }, 0);
          var sizes = Object.keys(r.sizes).map(function (sz) { return '<label class="k-qtycell">' + esc(sz) + '<input type="number" min="0" step="1" inputmode="numeric" value="' + r.sizes[sz] + '" data-cartidx="' + idx + '" data-cartsize="' + esc(sz) + '"></label>'; }).join('');
          return '<div class="k-cartrow"><div class="k-cartthumb">' + (r.image ? '<img src="' + esc(r.image) + '" alt="">' : '') + '</div>' +
            '<div><div class="k-cartrow-name">' + esc(r.productName) + '</div><div class="k-cartrow-meta">' + esc(meta) + '</div><div class="k-cartrow-sizes">' + sizes + '</div><div class="k-cartrow-total">Totalt ' + total + ' plagg</div></div>' +
            '<button class="k-cartremove" data-k="removeRow" data-idx="' + idx + '">Ta bort</button></div>';
        }).join('');
        var qk = st.cartKind !== 'order', ok = st.cartKind === 'order';
        var li = KONTO.loggedIn();
        var fromSum = 0, haveFrom = false;
        cart.forEach(function (r) { var q = Object.keys(r.sizes).reduce(function (a, k) { return a + (r.sizes[k] || 0); }, 0); if (li && r.priceFrom != null) { fromSum += r.priceFrom * q; haveFrom = true; } });
        var summaRow = '<div class="k-cartsumma"><span class="k-cartsumma-k">' + count + ' plagg i korgen</span>' +
          (li && haveFrom ? '<span class="k-cartsumma-v">Från ' + fromSum.toLocaleString('sv-SE') + ' kr</span>' : '') + '</div>';
        var priceNote = li
          ? 'Frånpriser ex. moms — slutpris bekräftas i offerten eller orderbekräftelsen.'
          : 'Era priser visas när du loggar in. Slutpris bekräftas i offerten.';
        inner = '<div class="k-cartrows">' + rows + '</div>' +
          summaRow +
          '<div class="k-cartpricenote">' + priceNote + '</div>' +
          '<div class="k-cartform">' +
            '<div class="k-cartkinds"><label data-k="setKind" data-kind="quote"><input type="radio" name="k-cartkind" ' + (qk ? 'checked' : '') + '> Offert</label><label data-k="setKind" data-kind="order"><input type="radio" name="k-cartkind" ' + (ok ? 'checked' : '') + '> Beställning</label></div>' +
            (ok ? '<div class="k-cartordernote">Beställningen är bindande och faktureras. Slutpris bekräftas i orderbekräftelsen.</div>' : '') +
            '<input class="k-cartinput" id="k-cart-name" type="text" placeholder="Namn *" aria-label="Namn" value="' + esc(f.name || '') + '">' +
            '<input class="k-cartinput" id="k-cart-company" type="text" placeholder="Företag" aria-label="Företag" value="' + esc(f.company || '') + '">' +
            '<input class="k-cartinput" id="k-cart-email" type="email" placeholder="E-post *" aria-label="E-post" value="' + esc(f.email || '') + '">' +
            '<input class="k-cartinput" id="k-cart-phone" type="tel" placeholder="Telefon" aria-label="Telefon" value="' + esc(f.phone || '') + '">' +
            '<textarea class="k-cartinput" id="k-cart-message" rows="3" placeholder="Meddelande (valfritt)" aria-label="Meddelande">' + esc(f.message || '') + '</textarea>' +
            '<button class="k-cta" data-k="submitCart">' + (st.cartBusy ? 'Skickar…' : 'Skicka') + '</button>' +
            (st.cartErr ? '<div class="k-carterror">' + esc(st.cartErr) + '</div>' : '') +
          '</div>';
      }
      return '<div class="k-backdrop" data-k="closeCart"></div><aside class="k-cartdrawer" role="dialog" aria-modal="true" aria-label="Offertkorg">' + head + inner + '</aside>';
    }
    function catObserve() {
      var nodes = root.querySelectorAll('.k-reveal:not(.in)');
      if (!io) { nodes.forEach(function (n) { n.classList.add('in'); }); return; }
      nodes.forEach(function (n) { io.observe(n); });
    }
    function updateBadge() { var b = document.getElementById('kBadge'); if (!b) return; var n = cartLines(); if (n > 0) { b.textContent = n; b.hidden = false; } else b.hidden = true; }
    function syncSearch() { var inp = document.getElementById('kSearch'); if (inp && document.activeElement !== inp && inp.value !== st.q) inp.value = st.q; }
    // Flyoutens innehåll linjerar med den öppna kategoriknappen (Dam/Herr/Barn/
    // Unisex/Sortiment) — kolumnerna börjar rakt under ordet man tryckte på.
    function alignFly() {
      var inner = root && root.querySelector('.k-fly-inner'); if (!inner) return;
      var btn = root.querySelector('.k-navbtn.is-open');
      if (!btn || window.innerWidth < 761) return;
      var left = Math.max(0, Math.round(btn.getBoundingClientRect().left));
      inner.style.margin = '0';
      inner.style.paddingLeft = left + 'px';
      inner.style.maxWidth = (1400 + left) + 'px';
    }
    // Nav-raden + flyouten + backdropen — allt menyväxling behöver röra.
    function renderMenu() {
      if (!root) return;
      var nav = document.getElementById('kNavBtns'); if (nav) nav.innerHTML = renderNavBtns();
      var fly = document.getElementById('kFly');
      if (fly) {
        // Intro-animationen (flydown) ska bara köras när flyouten ÖPPNAS.
        // Vid växling Dam→Herr osv. byts bara innehållet — annars blinkar
        // bakgrunden igenom en frame när containern återskapas.
        var hadeFly = !!fly.firstElementChild;
        fly.innerHTML = renderFly();
        if (hadeFly && fly.firstElementChild) fly.firstElementChild.style.animation = 'none';
      }
      alignFly();
      var mb = document.getElementById('kMenuBackdrop'); if (mb) mb.style.display = st.menu ? 'block' : 'none';
    }
    function renderAll() {
      if (!root) return;
      renderMenu();
      var body = document.getElementById('kBody'); if (body) body.innerHTML = renderBody();
      var ov = document.getElementById('kOverlays'); if (ov) ov.innerHTML = st.cartOpen ? renderCart() : '';
      // Cachade loggor är redan complete → onload firar inte; storleksätt dem direkt.
      if (root) root.querySelectorAll('img.k-blogo, img.k-blogo-lg').forEach(function (im) { if (im.complete && im.naturalWidth) fitLogo(im); });
      updateBadge(); syncSearch(); catObserve();
      if (mode() === 'product') attachRelWheel();
    }
    function onClick(e) {
      var b = e.target.closest('[data-k]'); if (!b || !root.contains(b)) return;
      var k = b.getAttribute('data-k'), d = b.dataset;
      switch (k) {
        case 'category': goCategory(d.cat, d.gender || ''); break;
        case 'setSub': setSub(d.sub); break;
        case 'showAll': showAllProducts(); break;
        case 'goBack': goBack(); break;
        case 'goBackAll': setState({ family: '', gender: '', shown: 48 }); top(); break;
        case 'open': openDetail(d.id); break;
        case 'more': setState({ shown: st.shown + PAGE }); break;
        case 'clearFilters': clearFilters(); break;
        case 'closeDetail': closeDetail(); break;
        case 'toggleMenu': setState({ menu: st.menu === d.menu ? null : d.menu }); break;
        case 'flyReset': setState({ detailId: null, q: '', brand: '', family: '', gender: '', sub: '', showAll: false, shown: 48, menu: null }); window.scrollTo(0, 0); break;
        case 'closeMenu': setState({ menu: null }); break;
        case 'flyCat': setState({ family: d.cat, gender: '', sub: '', showAll: false, brand: '', q: '', shown: 48, detailId: null, menu: null }); top(); break;
        case 'flySub': setState({ family: 'Kläder', gender: d.gender, sub: d.sub, showAll: false, shown: 48, detailId: null, menu: null }); top(); break;
        case 'flyAll': setState({ family: 'Kläder', gender: d.gender, sub: '', showAll: true, shown: 48, detailId: null, menu: null }); top(); break;
        case 'setColor': setState({ dcolor: +d.i, dview: 0 }); break;
        case 'setView': setState({ dview: +d.i }); break;
        case 'nextView': stepView(1); break;
        case 'prevView': stepView(-1); break;
        case 'addToCart': addToCart(); break;
        case 'openCart': setState({ cartOpen: true, cartErr: '', cartSent: null }); break;
        case 'closeCart': setState({ cartOpen: false }); break;
        case 'removeRow': removeRow(+d.idx); break;
        case 'setKind': setState({ cartKind: d.kind }); break;
        case 'submitCart': e.preventDefault(); submitCart(); break;
        case 'relPrev': relMove(1); break;
        case 'relNext': relMove(-1); break;
      }
    }
    function onChange(e) {
      var t = e.target;
      if (t.id === 'kSort') { setState({ sort: t.value, shown: 48 }); return; }
      if (t.id === 'kBrand') { setState({ brand: t.value || '', shown: 48 }); return; }
      if (t.hasAttribute && t.hasAttribute('data-cartidx')) { onCartQty(t); return; }
    }
    function buildShell() {
      root.innerHTML =
        '<div class="kx-navrow"><div class="kx-nav">' +
          '<div class="kx-navbtns" id="kNavBtns"></div>' +
          '<div class="k-search"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6"></circle><path d="M14 14l4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"></path></svg><input id="kSearch" type="search" placeholder="Sök i sortimentet" aria-label="Sök i sortimentet"></div>' +
          '<button class="k-navcart" data-k="openCart" aria-label="Öppna offertkorgen"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6.5 8.5h11l-.9 10.2a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6.5 8.5Z" stroke="currentColor" stroke-width="1.6"></path><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5" stroke="currentColor" stroke-width="1.6"></path></svg><span class="k-navcart-badge" id="kBadge" hidden></span></button>' +
        '</div><div id="kFly"></div></div>' +
        '<div id="kMenuBackdrop" class="k-menu-backdrop" style="display:none" data-k="closeMenu"></div>' +
        '<div id="kBody"></div>' +
        '<div id="kOverlays"></div>';
      root.addEventListener('click', onClick);
      root.addEventListener('change', onChange);
      var inp = document.getElementById('kSearch');
      if (inp) { var _searchDeb; inp.addEventListener('input', function () { clearTimeout(_searchDeb); _searchDeb = setTimeout(function () { st.q = (inp.value || '').trim().toLowerCase(); st.shown = 48; st.detailId = null; st.menu = null; renderAll(); }, 140); }); }
      if (!reduceMotion && 'IntersectionObserver' in window) {
        io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.08, rootMargin: '0px 0px -6% 0px' });
      }
      if (!safetyTimer) safetyTimer = setInterval(function () { if (!root) return; root.querySelectorAll('.k-reveal:not(.in)').forEach(function (n) { var r = n.getBoundingClientRect(); if (r.top < (window.innerHeight || 800) * 1.1) n.classList.add('in'); }); }, 400);
      document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (st.cartOpen) setState({ cartOpen: false }); else if (st.detailId) setState({ detailId: null }); else if (st.menu) setState({ menu: null }); });
    }
    return {
      mount: function () {
        root = document.getElementById('catalogRoot');
        if (!root) return;
        if (!ensureData()) {
          root.innerHTML = '<div class="k-wrap"><div class="k-loading">Laddar sortimentet…</div></div>';
          if (!st._retry) { st._retry = true; setTimeout(function () { st._retry = false; if (document.body.dataset.page === 'catalog') CAT.mount(); }, 150); }
          return;
        }
        if (!bound) { buildShell(); bound = true; }
        renderAll();
      },
      // Extern styrning från globala söket.
      ready: function () { return ensureData(); },
      products: function () { return ensureData() ? data.P : []; },
      priceLabel: function (p) { return priceLabel(p); },
      search: function (q) { st.q = (q || '').trim().toLowerCase(); st.shown = 48; st.detailId = null; st.menu = null; st.family = ''; st.gender = ''; st.sub = ''; st.showAll = false; st.brand = ''; if (root && bound) renderAll(); },
      openProduct: function (id) { st.detailId = id; st.dcolor = 0; st.dview = 0; st.panelQty = false; st.cartMsg = ''; if (root && bound) renderAll(); },
      // Djuplänk från startsidans sortimentskort → plaggtyp-lista (könsneutral).
      openSub: function (sub) { st.detailId = null; st.q = ''; st.brand = ''; st.family = 'Kläder'; st.gender = ''; st.sub = sub; st.showAll = false; st.shown = 48; st.menu = null; if (root && bound) renderAll(); },
      // Djuplänk → hel kategori (family) i katalogen.
      openFamily: function (fam) { st.detailId = null; st.q = ''; st.brand = ''; st.family = fam; st.gender = ''; st.sub = ''; st.showAll = false; st.shown = 48; st.menu = null; if (root && bound) renderAll(); },
      // Nollställ till katalogens startsida (header "Sortiment" / "Utforska hela katalogen").
      reset: function () { st.detailId = null; st.q = ''; st.brand = ''; st.family = ''; st.gender = ''; st.sub = ''; st.showAll = false; st.shown = 48; st.menu = null; if (root && bound) renderAll(); },
      // Stäng flyouten vid scroll: blur under transform flimrar, och en öppen
      // mega-meny som följer med scrollen är ändå fel läge.
      closeMenu: function () { if (st.menu) setState({ menu: null }); }
    };
  })();

  /* ============================================================
     GLOBAL SÖK — overlay. "Sök" i headern öppnar en sökruta (inte
     ett sidbyte). Söker produkter live ur katalogdatan; klick → produkt,
     Enter/"Visa alla" → sortimentsvyn med sökningen.
     ============================================================ */
  var SEARCH = (function () {
    var header = null, input = null, resultsEl = null, bound = false, curQ = '';
    function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
    function matches(q) {
      var P = CAT.products(); if (!P.length || !q) return [];
      var needle = q.toLowerCase(), out = [];
      for (var i = 0; i < P.length && out.length < 500; i++) { var p = P[i]; var hay = (p.name + ' ' + (p.brand || '') + ' ' + p.id).toLowerCase(); if (hay.indexOf(needle) >= 0) out.push(p); }
      return out;
    }
    function render(q) {
      curQ = (q || '').trim();
      if (!resultsEl) return;
      var html = '';
      if (!curQ) html = '';
      else if (!CAT.ready()) html = '<div class="ss-empty">Laddar sortimentet…</div>';
      else {
        var all = matches(curQ);
        if (!all.length) html = '<div class="ss-empty">Inga träffar för "' + esc(curQ) + '".</div>';
        else {
          var rows = all.slice(0, 8).map(function (p) {
            var c0 = p.colors && p.colors[0]; var img = p.image || (c0 && c0.face) || ''; var isPhoto = !!p.imagePhoto;
            return '<button class="ss-row" data-search-open data-id="' + esc(p.id) + '">' +
              '<span class="ss-thumb"><img class="' + (isPhoto ? 'photo' : '') + '" src="' + esc(img) + '" alt=""></span>' +
              '<span class="ss-meta"><span class="ss-brand">' + esc(p.brand || '') + '</span><span class="ss-name">' + esc(p.name) + '</span><span class="ss-price">' + esc(CAT.priceLabel(p)) + '</span></span>' +
              '</button>';
          }).join('');
          html = '<div class="ss-list">' + rows + '<button class="ss-all" data-search-all>Visa alla <span class="g">' + all.length + '</span> träffar i sortimentet →</button></div>';
        }
      }
      resultsEl.innerHTML = '<div class="ss-inner">' + html + '</div>';
      resultsEl.classList.toggle('has', !!curQ);
    }
    function showAll() { var q = curQ; close(); CAT.search(q); goto('catalog'); }
    function openProduct(id) { close(); CAT.openProduct(id); goto('catalog'); }
    function ensure() {
      if (bound) return;
      header = document.querySelector('.site-header');
      input = document.getElementById('ssInput');
      resultsEl = document.getElementById('ssResults');
      var hs = document.getElementById('hdrSearch');
      if (!header || !input || !resultsEl || !hs) return;
      bound = true;
      var _ssDeb; input.addEventListener('input', function () { clearTimeout(_ssDeb); _ssDeb = setTimeout(function () { render(input.value); }, 140); });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); showAll(); } else if (e.key === 'Escape') { close(); } });
      hs.addEventListener('click', function (e) {
        if (e.target.closest('[data-search-close]')) { e.preventDefault(); close(); return; }
        var o = e.target.closest('[data-search-open]'); if (o) { e.preventDefault(); openProduct(o.getAttribute('data-id')); return; }
        if (e.target.closest('[data-search-all]')) { e.preventDefault(); showAll(); return; }
      });
      // Klick utanför headern stänger söket.
      document.addEventListener('click', function (e) {
        if (!header.classList.contains('searching')) return;
        if (e.target.closest('.site-header') || e.target.closest('[data-search]')) return;
        close();
      });
    }
    function open() {
      ensure(); if (!header) return;
      // Datan hämtas när söket öppnas; när den landat ritas aktuell fråga om.
      loadKatalogData().then(function () { if (header.classList.contains('searching')) render(input.value); });
      header.classList.add('searching'); input.value = curQ; render(curQ); setTimeout(function () { input.focus(); }, 30);
    }
    function close() { if (header) header.classList.remove('searching'); if (resultsEl) resultsEl.classList.remove('has'); }
    return { open: open, close: close };
  })();

  /* ============ Init ============ */
  function init() {
    buildBrandMarquee();
    buildMetoder();
    heroRipple();

    document.addEventListener('click', function (e) {
      // Metod-modal: stäng på bakgrund/kryss, öppna på kort
      var modalHost = document.getElementById('metodModal');
      if (modalHost && modalHost.style.display === 'flex') {
        if (e.target === modalHost || e.target.closest('.metod-modal-panel .close')) { e.preventDefault(); closeMetodModal(); return; }
        if (e.target.closest('.metod-modal-panel')) return; // klick inuti panelen
      }
      var metod = e.target.closest('[data-metod]');
      if (metod) { e.preventDefault(); openMetodModal(+metod.dataset.metod); return; }
      if (e.target.closest('[data-search]')) { e.preventDefault(); SEARCH.open(); return; }
      var catSub = e.target.closest('[data-cat-sub]');
      if (catSub) { e.preventDefault(); CAT.openSub(catSub.getAttribute('data-cat-sub')); goto('catalog'); return; }
      var catFam = e.target.closest('[data-cat-fam]');
      if (catFam) { e.preventDefault(); CAT.openFamily(catFam.getAttribute('data-cat-fam')); goto('catalog'); return; }
      var nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); if (nav.dataset.nav === 'catalog') CAT.reset(); goto(nav.dataset.nav); return; }
      if (e.target.closest('[data-gohome]')) { e.preventDefault(); goto('home'); return; }
      if (e.target.closest('.burger')) { e.preventDefault(); openMobileNav(); return; }
      if (e.target.closest('#mobileNavClose')) { e.preventDefault(); closeMobileNav(); return; }
    });
    // Escape stänger metod-modalen + söket
    window.addEventListener('keydown', function (e) { if (e.key === 'Escape') { closeMetodModal(); SEARCH.close(); } });
    // Ansökan: rensa fältfel så fort användaren börjar rätta
    document.addEventListener('input', function (e) {
      var inp = e.target;
      if (inp && inp.classList && inp.classList.contains('field-invalid')) {
        var lab = inp.closest('label'); if (lab) setFieldError(lab, inp, '');
      }
    });
    // Ansökan → tackvy; Logga in → riktig verifiering mot PRNTR (Supabase auth).
    // (admin-routing sker via äkta user_roles-query efter login, se nedan)
    document.addEventListener('submit', function (e) {
      if (e.target.closest('[data-ansok-form]')) {
        e.preventDefault();
        var af = e.target.closest('[data-ansok-form]');
        if (!validateAnsokForm(af)) return;
        var f = document.getElementById('ansokForm'), t = document.getElementById('ansokThanks');
        if (f) f.style.display = 'none'; if (t) t.style.display = 'block'; window.scrollTo(0, 0);
      } else if (e.target.closest('[data-login-form]')) {
        e.preventDefault();
        var form = e.target.closest('[data-login-form]');
        var email = ((form.querySelector('input[type="email"]') || {}).value || '').trim().toLowerCase();
        var pass = (form.querySelector('input[type="password"]') || {}).value || '';
        var btn = form.querySelector('button[type="submit"]');
        var err = form.querySelector('[data-login-error]');
        if (!err) {
          err = document.createElement('p');
          err.setAttribute('data-login-error', '');
          err.style.cssText = 'color:#8a1f2d;font-size:13px;margin:0;';
          if (btn) form.insertBefore(err, btn); else form.appendChild(err);
        }
        err.textContent = '';
        if (btn) { btn.disabled = true; btn.dataset.lbl = btn.textContent; btn.textContent = 'Loggar in…'; }
        fetch(PRNTR_SUPABASE + '/auth/v1/token?grant_type=password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: PRNTR_ANON },
          body: JSON.stringify({ email: email, password: pass })
        }).then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); })
          .then(function (r) {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset.lbl; }
            if (r.ok && r.d && r.d.user) {
              // Äkta roll ur user_roles (RLS: användaren läser sin egen roll) —
              // email-agnostiskt, ingen hårdkodad admin-lista. Admin → printrstudio
              // (huset bor där); kund → sajtportalen (interim-B). Fail-safe: kund.
              var uid = r.d.user.id, token = r.d.access_token;
              var routeKund = function () { KONTO.login('kund', email); };
              if (!token) { routeKund(); return; }
              fetch(PRNTR_SUPABASE + '/rest/v1/user_roles?select=role&user_id=eq.' + encodeURIComponent(uid), {
                headers: { apikey: PRNTR_ANON, Authorization: 'Bearer ' + token }
              })
                .then(function (rr) { return rr.ok ? rr.json() : []; })
                .then(function (roles) {
                  if (Array.isArray(roles) && roles.some(function (x) { return x.role === 'admin'; })) {
                    window.location.href = PRNTR_STUDIO + '/logga-in';
                  } else { routeKund(); }
                })
                .catch(routeKund);
            } else {
              var code = (r.d && (r.d.error_code || r.d.error)) || '';
              err.textContent = code === 'invalid_credentials' || code === 'invalid_grant'
                ? 'Fel e-post eller lösenord.'
                : code === 'email_not_confirmed'
                  ? 'Kontot är inte bekräftat ännu — kolla din mejl.'
                  : 'Inloggningen misslyckades. Försök igen.';
            }
          })
          .catch(function () {
            if (btn) { btn.disabled = false; btn.textContent = btn.dataset.lbl; }
            err.textContent = 'Kunde inte nå inloggningstjänsten. Försök igen.';
          });
      }
    });

    KONTO.init();
    // (Handshaket borttaget helt — interim-B: sajten autentiserar kund själv.)
    // Initial laddning täcks av watchPageMedia via goto() nedan — window.load
    // väntade även på startsidans videor (4 MB) och höll strecket öppet långt
    // efter att sidan kändes klar (QA 2026-07-21).
    var initial = location.hash.slice(1);
    goto(PAGES.indexOf(initial) !== -1 ? initial : 'home', { keepScroll: true });
    window.addEventListener('hashchange', function () { goto(location.hash.slice(1) || 'home'); });

    // Reveal-loopar + scroll
    onScrollHeader();
    initTicker();
    window.addEventListener('scroll', function () { onScrollHeader(); moReveal(); mqVel += (window.scrollY - mqLast); mqLast = window.scrollY; CAT.closeMenu(); }, { passive: true });
    var _tkRz; window.addEventListener('resize', function () { moReveal(); clearTimeout(_tkRz); _tkRz = setTimeout(initTicker, 200); }, { passive: true });
    setInterval(moReveal, 220);
    // Säkerhetsnät: avslöja bara det som nått viewporten (aldrig blank sektion) —
    // under fold förblir dolt tills man scrollar dit (annars ingen scroll-reveal).
    setInterval(function () {
      var vh = window.innerHeight || document.documentElement.clientHeight || 800;
      // Avslöja allt vid eller ovanför scrollläget (r.top < vh); bara det under fold förblir dolt.
      document.querySelectorAll('.page.active [data-mo-img]:not([data-mo-in]), .page.active [data-mo-up]:not([data-mo-in])').forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width || r.height) && r.top < vh) el.setAttribute('data-mo-in', ''); });
      document.querySelectorAll('.page.active .ed-slide:not(.ed-in)').forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width || r.height) && r.top < vh * 0.55) el.classList.add('ed-in'); });
      document.querySelectorAll('.page.active .reveal:not(.in)').forEach(function (el) { var r = el.getBoundingClientRect(); if ((r.width || r.height) && r.top < vh) el.classList.add('in'); });
    }, 500);

    requestAnimationFrame(mqTick);

    // gestbunden video-start (autoplay-policy)
    ['pointerdown', 'touchstart', 'keydown', 'wheel', 'scroll'].forEach(function (ev) { window.addEventListener(ev, setRates, { passive: true, once: false }); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

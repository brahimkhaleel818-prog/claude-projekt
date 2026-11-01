// Eveom · CrispCheckout-Bestellübersicht wie im Shopify-Checkout
// - €0.00-Artikel (E-Book, Gratis Verzending, Pillendoos) → „GRATIS“ / „FREE“
// - Astaxanthin-Zeile: durchgestrichener Originalpreis + Etikett „2 + 1 GRATIS (−€49.80)“
// - unter „Gesamt“: „GESAMTERSPARNIS €49.80“, am Handy oben durchgestrichener Gesamtpreis
// Wird NICHT direkt eingebunden: build-garantie.py packt diesen Code in das onload-Attribut
// des Garantie-Blocks (eveom-garantie.html), weil CrispCheckout <script> nicht ausführt.
(function () {
  if (window.__eveomSum) return;
  window.__eveomSum = 1;

  var EINZELPREIS = 39.90; // Normalpreis einer Dose in EUR
  var PRODUKT = /astaxanth/i;
  var T = {
    de: { free: 'GRATIS', save: 'GESAMTERSPARNIS', b3: '2 + 1 GRATIS', b5: '3 + 2 GRATIS' },
    nl: { free: 'GRATIS', save: 'TOTALE BESPARING', b3: 'BESTEL 2 + 1 GRATIS', b5: 'BESTEL 3 + 2 GRATIS' },
    en: { free: 'FREE', save: 'TOTAL SAVINGS', b3: 'BUY 2 + GET 1 FREE', b5: 'BUY 3 + GET 2 FREE' },
    fr: { free: 'GRATUIT', save: 'ÉCONOMIES TOTALES', b3: '2 ACHETÉS + 1 OFFERT', b5: '3 ACHETÉS + 2 OFFERTS' }
  };
  var lang = 'en';
  var liste = navigator.languages;
  if (!liste || !liste.length) liste = [navigator.language || ''];
  for (var i = 0; i < liste.length; i++) {
    var code = String(liste[i] || '').slice(0, 2).toLowerCase();
    if (T[code]) { lang = code; break; }
  }
  var t = T[lang];
  var TAG = '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10.6 2.5H16a1.5 1.5 0 0 1 1.5 1.5v5.4a1.5 1.5 0 0 1-.44 1.06l-6.6 6.6a1.5 1.5 0 0 1-2.12 0L3 11.7a1.5 1.5 0 0 1 0-2.12l6.6-6.6a1.5 1.5 0 0 1 1-.48Z"/>' +
    '<circle cx="13.6" cy="6.4" r="1.2"/></svg>';

  function zahl(s) {
    var n = String(s).replace(/[^0-9.,]/g, '');
    if (/,\d{2}$/.test(n)) n = n.replace(/\./g, '').replace(',', '.');
    else n = n.replace(/,/g, '');
    return parseFloat(n);
  }
  function euro(n) { return '€' + n.toFixed(2); }
  function neu(tag, cls, html) {
    var el = document.createElement(tag);
    el.className = 'ev-x ' + cls;
    el.innerHTML = html;
    return el;
  }

  function anwenden() {
    var alt = document.querySelectorAll('.ev-x');
    for (var a = 0; a < alt.length; a++) alt[a].remove();
    var versteckt = document.querySelectorAll('[data-ev-hide]');
    for (var b = 0; b < versteckt.length; b++) versteckt[b].removeAttribute('data-ev-hide');

    var listen = document.querySelectorAll('section ul');
    for (var u = 0; u < listen.length; u++) {
      var ul = listen[u];
      var zeilen = ul.querySelectorAll(':scope > li');
      var menge = 0, ersparnis = 0, daten = [];
      for (var z = 0; z < zeilen.length; z++) {
        var li = zeilen[z];
        var preisBox = li.querySelector('span.flex-col');
        var preis = preisBox && preisBox.querySelector('span');
        var titel = li.querySelector('.min-w-0 p');
        var anzahl = li.querySelector('.relative > span');
        if (!preis || !titel) continue;
        var d = { li: li, box: preisBox, preis: preis, titel: titel, wert: zahl(preis.textContent),
          eur: preis.textContent.indexOf('€') > -1, n: anzahl ? parseInt(anzahl.textContent, 10) || 1 : 1 };
        d.produkt = PRODUKT.test(titel.textContent);
        if (d.produkt) menge += d.n;
        daten.push(d);
      }
      if (!daten.length) continue;
      var stufe = menge >= 5 ? t.b5 : menge >= 3 ? t.b3 : '';

      for (var k = 0; k < daten.length; k++) {
        var e = daten[k];
        if (e.wert === 0) {
          e.preis.setAttribute('data-ev-hide', '');
          e.box.appendChild(neu('span', 'ev-free ' + e.preis.className, t.free));
        } else if (e.produkt && e.eur) {
          var normal = Math.round(e.n * EINZELPREIS * 100) / 100;
          var rabatt = Math.round((normal - e.wert) * 100) / 100;
          if (rabatt > 0.009) {
            ersparnis += rabatt;
            e.box.insertBefore(neu('span', 'ev-strike', euro(normal)), e.preis);
            e.titel.parentNode.appendChild(neu('p', 'ev-tag', TAG + '<span>' + (stufe ? stufe + ' ' : '') + '(−' + euro(rabatt) + ')</span>'));
          }
        }
      }

      if (ersparnis > 0.009) {
        var bereich = ul.parentNode;
        var gesamt = bereich.querySelector('.pt-2');
        if (gesamt) gesamt.parentNode.appendChild(neu('div', 'ev-save', TAG + '<span>' + t.save + ' ' + euro(ersparnis) + '</span>'));
        var knopf = ul.closest('section') && ul.closest('section').querySelector('button[aria-expanded]');
        var kopfPreis = knopf && knopf.lastElementChild;
        if (kopfPreis && kopfPreis.textContent.indexOf('€') > -1) {
          kopfPreis.insertBefore(neu('span', 'ev-strike ev-strike-kopf', euro(zahl(kopfPreis.textContent) + ersparnis)), kopfPreis.firstChild);
        }
      }
    }
  }

  var beschaeftigt = false, geplant = false;
  var beobachter = new MutationObserver(function () {
    if (beschaeftigt || geplant) return;
    geplant = true;
    requestAnimationFrame(lauf);
  });
  function lauf() {
    geplant = false;
    beschaeftigt = true;
    try { anwenden(); } catch (err) {}
    beobachter.takeRecords();
    beschaeftigt = false;
  }
  beobachter.observe(document.body, { childList: true, subtree: true, characterData: true });
  lauf();
})();

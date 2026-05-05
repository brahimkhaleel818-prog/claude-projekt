/* ═══════════════════════════════════════════════════
   GAMZEM COIFFEUR — script.js
   ═══════════════════════════════════════════════════ */

const EJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';
const EJS_SERVICE_ID  = 'YOUR_SERVICE_ID';
const EJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const SHOP_EMAIL      = 'info@gamzem-coiffeur.de'; // ← echte E-Mail eintragen

try { emailjs.init(EJS_PUBLIC_KEY); } catch(e) {}

/* ── Cookie Banner ──────────────────────────────── */
(function initCookieBanner() {
  const banner  = document.getElementById('cookieBanner');
  const accept  = document.getElementById('cookieAccept');
  const decline = document.getElementById('cookieDecline');
  if (!banner) return;
  if (localStorage.getItem('cookieConsent')) { banner.style.display = 'none'; return; }
  function dismiss(choice) {
    localStorage.setItem('cookieConsent', choice);
    banner.classList.add('cookie-hidden');
    setTimeout(() => { banner.style.display = 'none'; }, 450);
  }
  accept.addEventListener('click',  () => dismiss('accepted'));
  decline.addEventListener('click', () => dismiss('declined'));
})();

/* ── Navbar scroll ──────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () =>
  navbar.classList.toggle('scrolled', window.scrollY > 60), { passive: true });

/* ── Mobile menu ────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.innerHTML = open ? '<i class="fa-solid fa-xmark"></i>' : '☰';
});
document.querySelectorAll('.nav-links a').forEach(a =>
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.innerHTML = '☰';
  })
);

/* ── Typewriter ─────────────────────────────────── */
const phrases = [
  'Balayage & Highlights auf höchstem Niveau.',
  'Ihr Premium-Friseursalon in Mönchengladbach.',
  '4,9 Sterne – 432 begeisterte Bewertungen.',
  'Schönheit mit Leidenschaft & Fachkompetenz.',
  'Jetzt Ihren Wunschtermin online buchen.',
];
let pi = 0, ci = 0, del = false;
const tw = document.getElementById('typewriter');
if (tw) {
  (function loop() {
    const phrase = phrases[pi];
    tw.textContent = del ? phrase.slice(0, ci--) : phrase.slice(0, ci++);
    let d = del ? 36 : 60;
    if (!del && ci > phrase.length) { d = 2500; del = true; }
    if (del && ci < 0) { ci = 0; del = false; pi = (pi + 1) % phrases.length; d = 380; }
    setTimeout(loop, d);
  })();
}

/* ── Rose petals ────────────────────────────────── */
const pContainer = document.getElementById('petals');
if (pContainer) {
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('div');
    p.className = 'petal';
    const size = 4 + Math.random() * 8;
    p.style.cssText = [
      `left:${Math.random()*100}%`,
      `animation-delay:${(Math.random()*12).toFixed(1)}s`,
      `animation-duration:${(10 + Math.random()*8).toFixed(1)}s`,
      `width:${size}px`,
      `height:${size * 1.4}px`,
      `opacity:${(0.3 + Math.random() * 0.4).toFixed(2)}`
    ].join(';');
    pContainer.appendChild(p);
  }
}

/* ── Scroll reveal ──────────────────────────────── */
const revealEls = document.querySelectorAll(
  '.svc-tile, .rv, .af-item, .cc, .ht-row, .about-rating-badge, .gallery-img'
);
revealEls.forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 6) * 0.07}s`;
});
(() => {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
    });
  }, { threshold: 0.08 });
  revealEls.forEach(el => io.observe(el));
})();

/* ═══════════════════════════════════════════════════
   BOOKING CALENDAR
   ═══════════════════════════════════════════════════ */

const SLOT_INTERVAL = 30; // minutes

// Öffnungszeiten: 0=So, 1=Mo, 2=Di … 6=Sa
const HOURS = {
  0: null,
  1: { start: [11,30], end: [16,0] },  // Montag
  2: { start: [10,0],  end: [18,0] },  // Dienstag
  3: { start: [10,0],  end: [18,0] },  // Mittwoch
  4: { start: [10,0],  end: [18,0] },  // Donnerstag
  5: { start: [10,0],  end: [18,0] },  // Freitag
  6: { start: [9,0],   end: [14,0] },  // Samstag
};

const STORAGE_KEY = 'gamzem_booked_slots';
function getBooked() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
}
function saveBooked(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {}
}

let calYear, calMonth;
let selectedDate = null;
let selectedTime = null;

function isoDate(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function renderCalendar() {
  const title = document.getElementById('calTitle');
  const grid  = document.getElementById('calGrid');
  if (!title || !grid) return;

  const now   = new Date();
  const today = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
  const months = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  title.textContent = `${months[calMonth]} ${calYear}`;
  grid.innerHTML = '';

  const first = new Date(calYear, calMonth, 1);
  let startDow = first.getDay();
  startDow = startDow === 0 ? 6 : startDow - 1;

  for (let i = 0; i < startDow; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day cal-day-empty';
    grid.appendChild(e);
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const btn    = document.createElement('button');
    const iso    = isoDate(calYear, calMonth, d);
    const dow    = new Date(calYear, calMonth, d).getDay();
    const past   = iso < today;
    const closed = !HOURS[dow];

    btn.textContent = d;
    btn.className = 'cal-day';
    if (iso === today) btn.classList.add('cal-day-today');
    if (iso === selectedDate) btn.classList.add('cal-day-selected');
    if (past || closed) {
      btn.classList.add('cal-day-disabled');
      btn.disabled = true;
      btn.title = closed ? 'Geschlossen' : 'Vergangen';
    }
    btn.addEventListener('click', () => selectDate(iso, dow));
    grid.appendChild(btn);
  }
}

function selectDate(iso, dow) {
  selectedDate = iso;
  selectedTime = null;
  updateSummary();
  renderCalendar();
  renderSlots(dow, iso);
}

function renderSlots(dow, iso) {
  const grid  = document.getElementById('slotsGrid');
  const label = document.getElementById('slotsDate');
  if (!grid || !label) return;

  const dayNames = ['So','Mo','Di','Mi','Do','Fr','Sa'];
  const monthsS  = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const dt = new Date(iso);
  label.textContent = `${dayNames[dt.getDay()]}, ${dt.getDate()}. ${monthsS[dt.getMonth()]}`;

  const h = HOURS[dow];
  grid.innerHTML = '';

  if (!h) {
    grid.innerHTML = '<p class="slots-placeholder"><i class="fa-regular fa-calendar-xmark"></i><br>Heute geschlossen.</p>';
    return;
  }

  const booked = getBooked();
  const [sh, sm] = h.start;
  const [eh, em] = h.end;
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;

  while (current < endMin) {
    const hh  = String(Math.floor(current / 60)).padStart(2,'0');
    const mm  = String(current % 60).padStart(2,'0');
    const key = `${iso}_${hh}:${mm}`;

    const btn = document.createElement('button');
    btn.textContent = `${hh}:${mm}`;
    btn.className = 'slot-btn';

    if (booked[key]) {
      btn.classList.add('slot-booked');
      btn.disabled = true;
      btn.title = 'Bereits gebucht';
    } else {
      btn.addEventListener('click', () => selectSlot(hh, mm, btn));
    }
    grid.appendChild(btn);
    current += SLOT_INTERVAL;
  }
}

function selectSlot(hh, mm, btn) {
  selectedTime = `${hh}:${mm}`;
  document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('slot-selected'));
  btn.classList.add('slot-selected');
  updateSummary();
}

function updateSummary() {
  const dateEl = document.getElementById('bsDate');
  const timeEl = document.getElementById('bsTime');
  if (dateEl) dateEl.textContent = selectedDate
    ? new Date(selectedDate).toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })
    : '–';
  if (timeEl) timeEl.textContent = selectedTime ? `${selectedTime} Uhr` : '–';
}

document.getElementById('calPrev')?.addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
});
document.getElementById('calNext')?.addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
});

(function initCal() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
})();

/* ── Booking Form ───────────────────────────────── */
document.getElementById('bookingForm')?.addEventListener('submit', async function(e) {
  e.preventDefault();

  const okEl  = document.getElementById('bookingOk');
  const errEl = document.getElementById('bookingErr');
  const btn   = document.getElementById('bookSubmitBtn');
  const txt   = document.getElementById('bookBtnText');
  const spin  = document.getElementById('bookBtnSpinner');
  [okEl, errEl].forEach(el => el.classList.add('hidden'));

  const name    = document.getElementById('bfName')?.value.trim();
  const phone   = document.getElementById('bfPhone')?.value.trim();
  const service = document.getElementById('bfService')?.value;
  const note    = document.getElementById('bfNote')?.value.trim();

  if (!name || !phone || !service || !selectedDate || !selectedTime) {
    errEl.classList.remove('hidden'); return;
  }

  btn.disabled = true;
  txt.classList.add('hidden');
  spin.classList.remove('hidden');

  const dateFormatted = new Date(selectedDate).toLocaleDateString('de-DE', {
    weekday:'long', day:'numeric', month:'long', year:'numeric'
  });

  const templateParams = {
    to_email:       SHOP_EMAIL,
    customer_name:  name,
    customer_phone: phone,
    service,
    date:           dateFormatted,
    time:           selectedTime + ' Uhr',
    message:        note || '—',
  };

  let success = false;

  if (EJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    try {
      await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, templateParams);
      success = true;
    } catch(err) { console.warn('EmailJS:', err); }
  } else {
    const subject = encodeURIComponent(`Terminanfrage: ${service} – ${dateFormatted} ${selectedTime}`);
    const body    = encodeURIComponent(
      `Name: ${name}\nTelefon: ${phone}\nService: ${service}\nDatum: ${dateFormatted}\nUhrzeit: ${selectedTime} Uhr\nNachricht: ${note || '—'}`
    );
    window.location.href = `mailto:${SHOP_EMAIL}?subject=${subject}&body=${body}`;
    success = true;
  }

  if (success) {
    const booked = getBooked();
    booked[`${selectedDate}_${selectedTime}`] = { name, service, ts: Date.now() };
    saveBooked(booked);

    const dow = new Date(selectedDate).getDay();
    renderSlots(dow, selectedDate);

    this.reset();
    selectedTime = null;
    updateSummary();

    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 9000);
  }

  btn.disabled = false;
  txt.classList.remove('hidden');
  spin.classList.add('hidden');
});

/* ═══════════════════════════════════════════════════
   MALEK BARBERSHOP — script.js
   - Navbar scroll
   - Mobile menu
   - Hero typewriter
   - Gold particles
   - Scroll reveal
   - Interactive booking calendar
   - EmailJS appointment emails
   - Booked slot persistence (localStorage)
   ═══════════════════════════════════════════════════ */

/* ── EmailJS Setup ──────────────────────────────────
   To activate real email sending:
   1. Go to https://www.emailjs.com and create a free account
   2. Add your email service (Gmail etc.)
   3. Create a template with these variables:
      {{customer_name}}, {{customer_phone}}, {{service}},
      {{date}}, {{time}}, {{message}}
   4. Replace the three placeholder strings below:
   ─────────────────────────────────────────────────── */
const EJS_PUBLIC_KEY  = 'YOUR_PUBLIC_KEY';   // ← ersetzen
const EJS_SERVICE_ID  = 'YOUR_SERVICE_ID';   // ← ersetzen
const EJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';  // ← ersetzen
const SHOP_EMAIL      = 'malekhanan99@wixsite.com'; // ← Shop-Email

try { emailjs.init(EJS_PUBLIC_KEY); } catch(e) {}

/* ── Navbar ─────────────────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () =>
  navbar.classList.toggle('scrolled', window.scrollY > 60), { passive: true });

/* ── Mobile menu ────────────────────────────────── */
const hamburger = document.getElementById('hamburger');
const navLinks  = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.textContent = open ? '✕' : '☰';
});
document.querySelectorAll('.nav-links a').forEach(a =>
  a.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.textContent = '☰';
  })
);

/* ── Typewriter ─────────────────────────────────── */
const phrases = [
  'Erstklassige Haarschnitte in Willich.',
  'Bartpflege auf höchstem Niveau.',
  'Oft auch ohne Termin direkt dran.',
  '5,0 Sterne – 183 Google-Bewertungen.',
  'Luxuriöse Atmosphäre & Getränke inklusive.',
];
let pi = 0, ci = 0, del = false;
const tw = document.getElementById('typewriter');
if (tw) {
  (function loop() {
    const phrase = phrases[pi];
    tw.textContent = del ? phrase.slice(0, ci--) : phrase.slice(0, ci++);
    let d = del ? 38 : 62;
    if (!del && ci > phrase.length) { d = 2400; del = true; }
    if (del && ci < 0) { ci = 0; del = false; pi = (pi + 1) % phrases.length; d = 350; }
    setTimeout(loop, d);
  })();
}

/* ── Gold particles ─────────────────────────────── */
const pContainer = document.getElementById('particles');
if (pContainer) {
  for (let i = 0; i < 32; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `left:${Math.random()*100}%;animation-delay:${(Math.random()*9).toFixed(1)}s;animation-duration:${(7+Math.random()*6).toFixed(1)}s;width:${2+Math.random()*3}px;height:${2+Math.random()*3}px`;
    pContainer.appendChild(p);
  }
}

/* ── Scroll reveal ──────────────────────────────── */
const revealEls = document.querySelectorAll(
  '.svc-tile, .rv, .af, .cc, .ht-row, .about-rating-badge'
);
revealEls.forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 5) * 0.08}s`;
});
new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); }
  });
}, { threshold: 0.1 }).observe = (() => {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  revealEls.forEach(el => io.observe(el));
  return io.observe.bind(io);
})();

/* ── Rating bar animation ───────────────────────── */
const rbFills = document.querySelectorAll('.rb-fill');
new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const w = e.target.dataset.w || e.target.style.width;
      e.target.dataset.w = w;
      e.target.style.width = '0';
      requestAnimationFrame(() => {
        e.target.style.transition = 'width 1.3s ease 0.2s';
        e.target.style.width = w;
      });
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 }).observe = (() => {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const w = e.target.dataset.w || e.target.getAttribute('data-w');
        e.target.style.width = '0';
        setTimeout(() => { e.target.style.transition = 'width 1.3s ease'; e.target.style.width = w; }, 200);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  rbFills.forEach(el => io.observe(el));
  return io.observe.bind(io);
})();

/* ═══════════════════════════════════════════════════
   BOOKING CALENDAR
   ═══════════════════════════════════════════════════ */

const SLOT_INTERVAL = 30; // minutes

// Opening hours per weekday (0=Sun … 6=Sat)
const HOURS = {
  0: null,                        // Sunday: closed
  1: { start: [9,0],  end: [18,30] },
  2: { start: [9,0],  end: [18,30] },
  3: { start: [9,0],  end: [18,30] },
  4: { start: [9,0],  end: [18,30] },
  5: { start: [9,0],  end: [18,30] },
  6: { start: [8,30], end: [16,0]  },
};

// Booked slots stored as { "YYYY-MM-DD_HH:MM": true }
const STORAGE_KEY = 'malek_booked_slots';
function getBooked() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}
function saveBooked(obj) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(obj)); } catch {}
}

let calYear, calMonth;
let selectedDate = null; // "YYYY-MM-DD"
let selectedTime = null; // "HH:MM"

function isoDate(y, m, d) {
  return `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}

function renderCalendar() {
  const title   = document.getElementById('calTitle');
  const grid    = document.getElementById('calGrid');
  if (!title || !grid) return;

  const now     = new Date();
  const today   = isoDate(now.getFullYear(), now.getMonth(), now.getDate());
  const months  = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];

  title.textContent = `${months[calMonth]} ${calYear}`;
  grid.innerHTML = '';

  const first = new Date(calYear, calMonth, 1);
  // Monday-first offset (0=Mon … 6=Sun)
  let startDow = first.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1;

  // Empty cells
  for (let i = 0; i < startDow; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day cal-day-empty';
    grid.appendChild(empty);
  }

  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const btn  = document.createElement('button');
    const iso  = isoDate(calYear, calMonth, d);
    const dow  = new Date(calYear, calMonth, d).getDay();
    const past = iso < today;
    const closed = !HOURS[dow];
    btn.textContent = d;
    btn.className = 'cal-day';
    if (iso === today) btn.classList.add('cal-day-today');
    if (iso === selectedDate) btn.classList.add('cal-day-selected');
    if (past || closed) { btn.classList.add('cal-day-disabled'); btn.disabled = true; btn.title = closed ? 'Geschlossen' : 'Vergangen'; }
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
  const months   = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const dt       = new Date(iso);
  label.textContent = `${dayNames[dt.getDay()]}, ${dt.getDate()}. ${months[dt.getMonth()]}`;

  const h = HOURS[dow];
  grid.innerHTML = '';

  if (!h) {
    grid.innerHTML = '<p class="slots-placeholder">Geschlossen</p>';
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
    btn.className   = 'slot-btn';

    if (booked[key]) {
      btn.classList.add('slot-booked');
      btn.disabled    = true;
      btn.title       = 'Bereits gebucht';
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
    ? new Date(selectedDate).toLocaleDateString('de-DE', {weekday:'long', day:'numeric', month:'long'})
    : 'Kein Datum gewählt';
  if (timeEl) timeEl.textContent = selectedTime ? `${selectedTime} Uhr` : 'Keine Zeit gewählt';
}

// Calendar navigation
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

// Init calendar to current month
(function initCal() {
  const now = new Date();
  calYear  = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
})();

/* ═══════════════════════════════════════════════════
   BOOKING FORM + EMAIL
   ═══════════════════════════════════════════════════ */
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
    errEl.classList.remove('hidden');
    return;
  }

  // Show spinner
  btn.disabled = true;
  txt.classList.add('hidden');
  spin.classList.remove('hidden');

  const dateFormatted = new Date(selectedDate).toLocaleDateString('de-DE', {weekday:'long', day:'numeric', month:'long', year:'numeric'});

  const templateParams = {
    to_email:       SHOP_EMAIL,
    customer_name:  name,
    customer_phone: phone,
    service:        service,
    date:           dateFormatted,
    time:           selectedTime + ' Uhr',
    message:        note || '—',
  };

  let success = false;

  // Try EmailJS
  if (EJS_PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    try {
      await emailjs.send(EJS_SERVICE_ID, EJS_TEMPLATE_ID, templateParams);
      success = true;
    } catch(err) {
      console.warn('EmailJS error:', err);
    }
  } else {
    // Fallback: open mail client
    const subject = encodeURIComponent(`Terminanfrage: ${service} – ${dateFormatted} ${selectedTime}`);
    const body    = encodeURIComponent(`Name: ${name}\nTelefon: ${phone}\nService: ${service}\nDatum: ${dateFormatted}\nUhrzeit: ${selectedTime} Uhr\nNachricht: ${note || '—'}`);
    window.location.href = `mailto:${SHOP_EMAIL}?subject=${subject}&body=${body}`;
    success = true;
  }

  // Mark slot as booked in localStorage
  if (success) {
    const booked = getBooked();
    booked[`${selectedDate}_${selectedTime}`] = { name, service, ts: Date.now() };
    saveBooked(booked);

    // Re-render slots to show as booked
    const dow = new Date(selectedDate).getDay();
    renderSlots(dow, selectedDate);

    // Reset form
    this.reset();
    selectedTime = null;
    updateSummary();

    okEl.classList.remove('hidden');
    setTimeout(() => okEl.classList.add('hidden'), 8000);
  }

  btn.disabled = false;
  txt.classList.remove('hidden');
  spin.classList.add('hidden');
});

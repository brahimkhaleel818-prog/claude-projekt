// Navbar scroll
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => navbar.classList.toggle('scrolled', window.scrollY > 60), { passive: true });

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');
hamburger.addEventListener('click', () => {
  const open = navLinks.classList.toggle('open');
  hamburger.textContent = open ? '✕' : '☰';
});
document.querySelectorAll('.nav-links a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  hamburger.textContent = '☰';
}));

// Typewriter
const phrases = [
  'Erstklassige Haarschnitte in Willich.',
  'Bartpflege auf höchstem Niveau.',
  'Oft auch ohne Termin direkt dran.',
  '5,0 Sterne – über 183 Bewertungen.',
  'Luxuriöse Atmosphäre & Getränke inklusive.',
];
let pi = 0, ci = 0, deleting = false;
const tw = document.getElementById('typewriter');
function typeLoop() {
  const phrase = phrases[pi];
  tw.textContent = deleting ? phrase.slice(0, ci--) : phrase.slice(0, ci++);
  let delay = deleting ? 40 : 65;
  if (!deleting && ci > phrase.length) { delay = 2200; deleting = true; }
  if (deleting && ci < 0)  { ci = 0; deleting = false; pi = (pi + 1) % phrases.length; delay = 400; }
  setTimeout(typeLoop, delay);
}
typeLoop();

// Gold particles in hero
const container = document.getElementById('particles');
if (container) {
  for (let i = 0; i < 30; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = Math.random() * 8 + 's';
    p.style.animationDuration = (6 + Math.random() * 6) + 's';
    p.style.width = p.style.height = (2 + Math.random() * 3) + 'px';
    container.appendChild(p);
  }
}

// Scroll reveal
const revealStyle = document.createElement('style');
revealStyle.textContent = `
  .rv { opacity:0; transform:translateY(36px); transition:opacity 0.75s ease, transform 0.75s ease; }
  .rv.in { opacity:1; transform:translateY(0); }
`;
document.head.appendChild(revealStyle);

const targets = document.querySelectorAll(
  '.svc-card, .rev-card, .g-item, .tool-icon-item, .pillar, .c-card, .h-row, .about-gold-badge'
);
targets.forEach((el, i) => {
  el.classList.add('rv');
  el.style.transitionDelay = (i % 5) * 0.09 + 's';
});

new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); }
  });
}, { threshold: 0.1 }).observe = (() => {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } });
  }, { threshold: 0.1 });
  targets.forEach(el => io.observe(el));
  return io.observe.bind(io);
})();

// Rating bars animate
const bars = document.querySelectorAll('.r-fill');
new IntersectionObserver((entries, obs) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const w = e.target.style.width;
      e.target.style.width = '0';
      setTimeout(() => { e.target.style.transition = 'width 1.2s ease'; e.target.style.width = w; }, 100);
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 }).observe = (() => {
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const w = e.target.getAttribute('data-w') || e.target.style.width;
        e.target.setAttribute('data-w', w);
        e.target.style.width = '0';
        setTimeout(() => { e.target.style.transition = 'width 1.2s ease'; e.target.style.width = w; }, 100);
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.5 });
  bars.forEach(b => io.observe(b));
  return io.observe.bind(io);
})();

// Form submit
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const ok = document.getElementById('formSuccess');
  ok.style.display = 'block';
  e.target.reset();
  setTimeout(() => { ok.style.display = 'none'; }, 6000);
});

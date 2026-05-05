// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.querySelector('.nav-links');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Smooth navbar background on scroll
const navbar = document.querySelector('.navbar');
window.addEventListener('scroll', () => {
  navbar.style.background = window.scrollY > 50
    ? 'rgba(15, 15, 26, 0.97)'
    : 'rgba(15, 15, 26, 0.85)';
});

// Counter animation
function animateCounter(el) {
  const target = parseInt(el.dataset.target, 10);
  const duration = 1800;
  const step = target / (duration / 16);
  let current = 0;

  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      el.textContent = target;
      clearInterval(timer);
    } else {
      el.textContent = Math.floor(current);
    }
  }, 16);
}

const counters = document.querySelectorAll('.counter');
const counterObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.animated) {
      entry.target.dataset.animated = 'true';
      animateCounter(entry.target);
    }
  });
}, { threshold: 0.5 });

counters.forEach(c => counterObserver.observe(c));

// Scroll-in animation for cards
const observeElements = document.querySelectorAll('.feature-card, .stat-box, .floating-card');

const styleEl = document.createElement('style');
styleEl.textContent = `
  .fade-hidden { opacity: 0; transform: translateY(30px); transition: opacity 0.6s ease, transform 0.6s ease; }
  .fade-visible { opacity: 1; transform: translateY(0); }
`;
document.head.appendChild(styleEl);

observeElements.forEach((el, i) => {
  el.classList.add('fade-hidden');
  el.style.transitionDelay = `${(i % 3) * 0.12}s`;
});

const fadeObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-visible');
      fadeObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.15 });

observeElements.forEach(el => fadeObserver.observe(el));

// Contact form
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const success = document.getElementById('formSuccess');
  success.style.display = 'block';
  e.target.reset();
  setTimeout(() => { success.style.display = 'none'; }, 5000);
});

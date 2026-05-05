// Navbar scroll effect
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 50);
});

// Mobile menu
const hamburger = document.getElementById('hamburger');
const navLinks = document.getElementById('navLinks');

hamburger.addEventListener('click', () => {
  navLinks.classList.toggle('open');
  hamburger.textContent = navLinks.classList.contains('open') ? '✕' : '☰';
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    hamburger.textContent = '☰';
  });
});

// Scroll-in animation
const style = document.createElement('style');
style.textContent = `
  .reveal { opacity: 0; transform: translateY(40px); transition: opacity 0.7s ease, transform 0.7s ease; }
  .reveal.visible { opacity: 1; transform: translateY(0); }
`;
document.head.appendChild(style);

const revealEls = document.querySelectorAll(
  '.service-card, .info-card, .hours-box, .gallery-item, .about-features li, .stat'
);

revealEls.forEach((el, i) => {
  el.classList.add('reveal');
  el.style.transitionDelay = `${(i % 4) * 0.1}s`;
});

const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

revealEls.forEach(el => observer.observe(el));

// Contact form
document.getElementById('contactForm').addEventListener('submit', e => {
  e.preventDefault();
  const msg = document.getElementById('formSuccess');
  msg.style.display = 'block';
  e.target.reset();
  setTimeout(() => { msg.style.display = 'none'; }, 6000);
});

import '@fontsource-variable/cormorant-garamond/wght.css';
import '@fontsource-variable/cormorant-garamond/wght-italic.css';
import '@fontsource-variable/instrument-sans/wght.css';
import '@fontsource/tiro-devanagari-hindi/devanagari-400.css';
import '../styles/work.css';

// Reveal sections gently as they scroll in. Content is already in the HTML.
const io = 'IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches
  ? new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { e.target.classList.add('seen'); io?.unobserve(e.target); }
    }, { rootMargin: '0px 0px -8% 0px' })
  : null;
document.documentElement.classList.add('js');
document.querySelectorAll('.project, .row, .glance > div, .skills > div').forEach((el) => {
  if (io) io.observe(el); else el.classList.add('seen');
});

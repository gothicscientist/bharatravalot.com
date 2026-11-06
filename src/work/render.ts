// Renders the quick view to static HTML at build time, so it is instant, indexable and works
// without JavaScript. Pure string functions: no DOM.
import { entries, person, skills, type Entry } from '../content';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

const ext = (href: string) => (href.startsWith('http') ? ' target="_blank" rel="noopener"' : '');

function meta(e: Entry) {
  const parts = [e.role, e.when, e.where].filter((x): x is string => !!x).map(esc);
  return parts.length ? `<p class="meta">${parts.join('<span class="sep" aria-hidden="true"></span>')}</p>` : '';
}

function links(e: Entry) {
  if (!e.links?.length) return '';
  return `<p class="links">${e.links.map((l) => `<a href="${l.href}"${ext(l.href)}>${esc(l.label)}<span aria-hidden="true">↗</span></a>`).join('')}</p>`;
}

function facts(e: Entry) {
  return e.facts?.length ? `<ul class="facts">${e.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : '';
}

function body(e: Entry) {
  return e.body?.length ? e.body.map((p) => `<p class="body">${esc(p)}</p>`).join('') : '';
}

function stack(e: Entry) {
  return e.stack?.length ? `<p class="stack">${e.stack.map(esc).join(', ')}</p>` : '';
}

function project(e: Entry, i: number) {
  const shot = e.shots?.[0];
  const media = shot
    ? `<figure class="shot"><img src="${shot.src}" alt="${esc(shot.alt)}" width="${shot.w}" height="${shot.h}" loading="${i < 2 ? 'eager' : 'lazy'}" decoding="async"></figure>`
    : `<figure class="shot shot-empty" aria-hidden="true"><span>${esc(e.title)}</span></figure>`;
  return `<article class="project${i % 2 ? ' flip' : ''}" id="${e.id}">
    ${media}
    <div class="text">
      <h3>${esc(e.title)}</h3>
      ${meta(e)}
      <p class="line">${esc(e.line)}</p>
      ${body(e)}
      ${facts(e)}
      ${stack(e)}
      ${links(e)}
    </div>
  </article>`;
}

function row(e: Entry) {
  return `<article class="row" id="${e.id}">
    <div class="row-head"><h3>${esc(e.title)}</h3>${meta(e)}</div>
    <div class="row-body"><p class="line">${esc(e.line)}</p>${facts(e)}${stack(e)}${links(e)}</div>
  </article>`;
}

export function renderWork() {
  const radiant = entries.radiant;
  const projects = ['thock', 'pilego', 'strata', 'speed', 'rally'].map((k) => entries[k]);
  const edu = entries.education;
  const glance: [string, string][] = [
    ['$20,000+', 'revenue at Radiant Tech, from 300+ clients'],
    ['30M+', 'combined visits across 15+ client projects'],
    ['8,195', 'build-ready keyboard parts in Thock, from 24 stores'],
    ['Top 30', 'of 13,000 students at the Blue Ocean competition'],
  ];
  return `
<header class="top">
  <a class="mark" href="/"><em>Bharat Ravalot</em></a>
  <a class="journey" href="/">Enter the labyrinth<span aria-hidden="true">→</span></a>
</header>

<main>
  <section class="intro">
    <div class="intro-text">
      <h1>${esc(person.name)}</h1>
      <p class="lede">${esc(person.tagline)}</p>
      <p class="lede-2">${esc(entries.about.line)} ${esc(entries.about.body![1])}</p>
    </div>
    <ul class="contact" aria-label="Contact">
      <li><a href="mailto:${person.email}">${esc(person.email)}</a></li>
      <li><a href="${person.phoneHref}">${esc(person.phone)}</a></li>
      <li><a href="${person.linkedin}" target="_blank" rel="noopener">LinkedIn</a></li>
      <li><a href="${person.github}" target="_blank" rel="noopener">GitHub</a></li>
      <li class="where">${esc(person.location)}</li>
    </ul>
  </section>

  <figure class="hero">
    <a href="/" aria-label="Enter the labyrinth">
      <picture>
        <source media="(max-width: 700px)" srcset="/media/still-m.webp">
        <img src="/media/still.webp" alt="A voxel palace courtyard at dusk, at the end of a labyrinth cut into the desert, lit by torches and a long pool" width="2400" height="1029">
      </picture>
    </a>
    <figcaption>This site is also a hidden labyrinth under the desert, with a chamber for each part of my work. <a href="/">Explore it</a> when you have five minutes.</figcaption>
  </figure>

  <section class="glance" aria-label="At a glance">
    ${glance.map(([n, t]) => `<div><strong>${esc(n)}</strong><span>${esc(t)}</span></div>`).join('')}
  </section>

  <section class="block" aria-labelledby="h-exp">
    <h2 id="h-exp">Experience</h2>
    ${row(radiant)}
    ${row(entries.marwari)}
  </section>

  <section class="block" aria-labelledby="h-proj">
    <h2 id="h-proj">Things I have built</h2>
    ${projects.map(project).join('')}
  </section>

  <section class="block" aria-labelledby="h-lead">
    <h2 id="h-lead">Competitions and leadership</h2>
    ${row(entries.agora)}
    ${row(entries.fbla)}
  </section>

  <section class="block" aria-labelledby="h-edu">
    <h2 id="h-edu">Education</h2>
    ${row(edu)}
    <div class="skills">
      ${skills.map((s) => `<div><h3>${esc(s.label)}</h3><p>${s.items.map(esc).join(', ')}</p></div>`).join('')}
      <div><h3>Outside work</h3><p>${person.interests.map((x, i) => (i ? x : x[0].toUpperCase() + x.slice(1))).map(esc).join(', ')}</p></div>
    </div>
  </section>

  <section class="block closing" aria-labelledby="h-contact">
    <h2 id="h-contact">${esc(entries.contact.title)}</h2>
    <p class="line">${esc(entries.contact.line)}</p>
    <p class="links big">${entries.contact.links!.map((l) => `<a href="${l.href}"${ext(l.href)}>${esc(l.label)}</a>`).join('')}</p>
  </section>
</main>

<footer class="foot">
  <p>Every chamber, torch and sound in the labyrinth is built by code, live in your browser.</p>
  <p><a href="/">Enter the labyrinth</a></p>
</footer>`;
}

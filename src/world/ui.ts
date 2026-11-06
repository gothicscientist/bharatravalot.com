import { entries, person, stations, skills, type Entry } from '../content';
import { STATION_T } from './layout';
import { SUNRISE, SUNSET } from './palette';

interface Handlers {
  travel: (i: number) => void;
  sound: (on: boolean) => void;
  pause: (p: boolean) => void;
}

const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector(sel) as T;

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

export function entryHTML(e: Entry, long = false) {
  const meta = [e.role, e.when].filter((x): x is string => !!x).map(esc).join('<span class="sep"></span>');
  let h = `<h2 class="t-title">${esc(e.title)}</h2>`;
  if (meta) h += `<p class="t-meta">${meta}</p>`;
  h += `<p class="t-line">${esc(e.line)}</p>`;
  if (long) {
    if (e.body) h += e.body.map((p) => `<p class="t-body">${esc(p)}</p>`).join('');
    if (e.facts) h += `<ul class="t-facts">${e.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`;
    if (e.stack) h += `<p class="t-stack">${e.stack.map(esc).join(', ')}</p>`;
  }
  return h;
}

/** Position on the sun's path for a time of day. Above the line from sunrise to sunset. */
function arcPoint(t: number, w: number, h: number) {
  const u = (t - SUNRISE) / (SUNSET - SUNRISE);
  const th = Math.PI * (1 - u);
  const R = w * 0.44;
  return { x: w / 2 + Math.cos(th) * R, y: h - 14 - Math.sin(th) * (h - 26) };
}

export class UI {
  introOpen = true;
  modalOpen = false;
  activeEntry: Entry | null = null;
  private stationIdx = -1;
  private hinted = false;
  private soundOn = false;
  private onReady: (() => void) | null = null;
  private card = $('#card');
  private place = $('#place');
  private sunDot!: SVGCircleElement;
  private night = false;

  constructor(private h: Handlers) {
    this.buildIntro();
    this.buildHud();
    this.buildModal();
  }

  ready(fn: () => void) {
    this.onReady = fn;
  }

  private buildIntro() {
    const intro = $('#intro');
    intro.querySelector('[data-enter]')?.addEventListener('click', () => this.enter(true));
    intro.querySelector('[data-quiet]')?.addEventListener('click', () => this.enter(false));
    requestAnimationFrame(() => intro.classList.add('in'));
  }

  skipIntro() {
    this.introOpen = false;
    $('#intro')?.remove();
    document.body.classList.add('entered');
  }

  private enter(sound: boolean) {
    const intro = $('#intro');
    intro.classList.add('out');
    this.introOpen = false;
    this.soundOn = sound;
    this.onReady?.();
    this.h.sound(sound);
    this.updateSoundBtn();
    document.body.classList.add('entered');
    setTimeout(() => intro.remove(), 1600);
    this.setStation(this.stationIdx, true);
  }

  private buildHud() {
    const btn = $('#sound');
    btn.addEventListener('click', () => {
      this.soundOn = !this.soundOn;
      this.h.sound(this.soundOn);
      this.updateSoundBtn();
    });
    // sun path
    const svg = $('#sunpath svg') as unknown as SVGSVGElement;
    const W = 520, H = 96;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    let path = '';
    for (let k = 0; k <= 60; k++) {
      const t = k / 60;
      const p = arcPoint(t, W, H);
      path += `${k ? 'L' : 'M'}${p.x.toFixed(1)},${Math.min(H - 2, p.y).toFixed(1)}`;
    }
    const ns = 'http://www.w3.org/2000/svg';
    const pathEl = document.createElementNS(ns, 'path');
    pathEl.setAttribute('d', path);
    pathEl.setAttribute('class', 'arc');
    svg.appendChild(pathEl);
    const line = document.createElementNS(ns, 'line');
    line.setAttribute('x1', '8');
    line.setAttribute('x2', String(W - 8));
    line.setAttribute('y1', String(H - 14));
    line.setAttribute('y2', String(H - 14));
    line.setAttribute('class', 'horizon');
    svg.appendChild(line);
    stations.forEach((s, i) => {
      const p = arcPoint(STATION_T[i], W, H);
      const g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'stop');
      g.setAttribute('tabindex', '0');
      g.setAttribute('role', 'button');
      const label = entries[s.entry]?.title ?? 'Before dawn';
      g.setAttribute('aria-label', `Travel to ${s.place}: ${label}`);
      const hit = document.createElementNS(ns, 'circle');
      hit.setAttribute('cx', String(p.x));
      hit.setAttribute('cy', String(Math.min(H - 4, p.y)));
      hit.setAttribute('r', '12');
      hit.setAttribute('class', 'hit');
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(p.x));
      dot.setAttribute('cy', String(Math.min(H - 4, p.y)));
      dot.setAttribute('r', '3');
      dot.setAttribute('class', 'dot');
      const title = document.createElementNS(ns, 'title');
      title.textContent = `${s.place}, ${label}`;
      g.append(title, hit, dot);
      const go = () => this.h.travel(i);
      g.addEventListener('click', go);
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') go();
      });
      svg.appendChild(g);
    });
    this.sunDot = document.createElementNS(ns, 'circle');
    this.sunDot.setAttribute('r', '6');
    this.sunDot.setAttribute('class', 'sun');
    svg.appendChild(this.sunDot);
  }

  private updateSoundBtn() {
    const btn = $('#sound');
    btn.setAttribute('aria-pressed', String(this.soundOn));
    btn.querySelector('span')!.textContent = this.soundOn ? 'Sound on' : 'Sound off';
  }

  private buildModal() {
    const modal = $('#chapter');
    modal.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).matches('#chapter, [data-close]')) this.closeModal();
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.modalOpen) this.closeModal();
    });
  }

  openActive() {
    if (!this.activeEntry) return;
    const e = this.activeEntry;
    const modal = $('#chapter');
    const body = $('.chapter-body', modal);
    let h = `<p class="t-place">${esc(stations[this.stationIdx]?.place ?? '')}</p>` + entryHTML(e, true);
    if (e.id === 'education') {
      h += `<div class="t-skills">${skills.map((s) => `<p><strong>${esc(s.label)}</strong> ${s.items.map(esc).join(', ')}</p>`).join('')}</div>`;
    }
    if (e.links?.length) h += `<p class="t-links">${e.links.map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>`;
    if (e.shots?.length) {
      h += `<div class="t-shots">${e.shots.map((s) => `<figure><img src="${s.src}" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"><figcaption>${esc(s.alt)}</figcaption></figure>`).join('')}</div>`;
    }
    body.innerHTML = h;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    this.modalOpen = true;
    this.h.pause(true);
    ($('[data-close]', modal) as HTMLButtonElement).focus();
  }

  closeModal() {
    const modal = $('#chapter');
    modal.classList.remove('open');
    this.modalOpen = false;
    this.h.pause(false);
    setTimeout(() => {
      if (!this.modalOpen) modal.hidden = true;
    }, 500);
  }

  hintDone() {
    if (this.hinted) return;
    this.hinted = true;
    document.body.classList.add('hinted');
  }

  setProgress(t: number, _p: number) {
    const W = 520, H = 96;
    const p = arcPoint(t, W, H);
    this.sunDot.setAttribute('cx', p.x.toFixed(1));
    this.sunDot.setAttribute('cy', Math.min(H - 4, p.y).toFixed(1));
    const night = t < 0.07 || t > 0.84;
    if (night !== this.night) {
      this.night = night;
      document.body.classList.toggle('night', night);
    }
  }

  setStation(i: number, force = false) {
    if (i === this.stationIdx && !force) return;
    this.stationIdx = i;
    if (this.introOpen) return;
    const card = this.card;
    card.classList.remove('show');
    const s = stations[i];
    this.place.classList.remove('show');
    clearTimeout((this as unknown as { _t: number })._t);
    (this as unknown as { _t: number })._t = window.setTimeout(() => {
      if (!s) {
        this.activeEntry = null;
        return;
      }
      this.place.innerHTML = `<span class="pl-local" lang="hi">${s.placeLocal}</span><span class="pl-en">${esc(s.place)}</span><span class="pl-time">${esc(s.time)}</span>`;
      this.place.classList.add('show');
      if (s.entry === 'intro') {
        this.activeEntry = null;
        card.innerHTML = `<p class="t-kicker" lang="hi">पधारो म्हारे देस</p><h1 class="t-hero">${esc(person.name)}</h1><p class="t-line">${esc(person.tagline)}</p><p class="t-hint"><span class="k">scroll</span> or <span class="k">←</span><span class="k">→</span> to walk west, <span class="k">space</span> to jump</p><p class="t-hint t-hint-touch">Swipe to walk west, tap to jump</p>`;
        card.dataset.kind = 'intro';
      } else {
        const e = entries[s.entry];
        this.activeEntry = e;
        let h = entryHTML(e, false);
        if (e.kind === 'contact') {
          h += `<p class="t-links t-contact">${e.links!.map((l) => `<a href="${l.href}" ${l.href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''}>${esc(l.label)}</a>`).join('')}</p><p class="t-small">Or read everything at once in the <a href="/work/">quick view</a>.</p>`;
        } else {
          h += `<p class="t-actions"><button class="read" type="button">Read more</button>${(e.links ?? []).slice(0, 1).map((l) => `<a href="${l.href}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</p>`;
        }
        card.innerHTML = h;
        card.dataset.kind = e.kind;
        card.querySelector('.read')?.addEventListener('click', () => this.openActive());
      }
      card.classList.add('show');
    }, force ? 50 : 420);
  }
}

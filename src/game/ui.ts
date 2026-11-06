// Everything drawn over the world: the intro, the place name, the card at each relic, the full
// entry, the map of chambers and the touch controls.
import { entries, person, skills, type Entry } from '../content';

const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector(s) as T;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

interface Handlers {
  rooms: { id: string; name: string }[];
  onEnter: (sound: boolean) => void;
  onSound: (on: boolean) => void;
  onTravel: (id: string) => void;
  onJump: () => void;
  pause: (p: boolean) => void;
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

const ext = (href: string) => (href.startsWith('http') ? ' target="_blank" rel="noopener"' : '');

export class UI {
  introOpen = true;
  modalOpen = false;
  private active: { id: string; room: string } | null = null;
  private soundOn = false;
  private hinted = false;
  private placeName = '';
  private visited = new Set<string>();

  constructor(private h: Handlers) {
    // intro
    const intro = $('#intro');
    intro.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) =>
      b.addEventListener('click', () => {
        const withSound = b.dataset.enter === 'sound';
        this.soundOn = withSound;
        this.syncSound();
        h.onEnter(withSound);
        this.closeIntro();
      }),
    );
    // hud
    $('#sound').addEventListener('click', () => { this.soundOn = !this.soundOn; this.syncSound(); h.onSound(this.soundOn); });
    $('#mapbtn').addEventListener('click', () => this.toggleMap());
    // map list
    const list = $('#map ol');
    list.innerHTML = h.rooms.map((r, i) => `<li><button type="button" data-room="${r.id}"><span class="n">${i + 1}</span>${esc(r.name)}</button></li>`).join('');
    list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      this.toggleMap(false);
      h.onTravel(b.dataset.room!);
    });
    $('#map').addEventListener('click', (e) => { if (e.target === $('#map') || (e.target as HTMLElement).matches('[data-close-map]')) this.toggleMap(false); });
    // card and modal
    $('#card').addEventListener('click', (e) => { if ((e.target as HTMLElement).closest('[data-read]')) this.openActive(); });
    $('#chapter').addEventListener('click', (e) => { if ((e.target as HTMLElement).matches('#chapter, [data-close]')) this.closeModal(); });
    addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { if (this.modalOpen) this.closeModal(); else this.toggleMap(false); }
    });
    $('#jump').addEventListener('pointerdown', (e) => { e.preventDefault(); h.onJump(); });
  }

  private syncSound() {
    const b = $('#sound');
    b.setAttribute('aria-pressed', String(this.soundOn));
    $('span', b).textContent = this.soundOn ? 'Sound on' : 'Sound off';
  }

  private closeIntro() {
    this.introOpen = false;
    document.body.classList.add('entered');
    $('#intro').classList.add('gone');
    setTimeout(() => ($('#intro').hidden = true), 1200);
  }
  skipIntro() { this.closeIntro(); }

  setPlace(name: string) {
    if (name === this.placeName) return;
    this.placeName = name;
    const p = $('#place');
    p.classList.remove('show');
    if (!name) return;
    setTimeout(() => { p.textContent = name; p.classList.add('show'); }, 250);
  }

  showEntry(id: string, room: string) {
    this.active = { id, room };
    this.visited.add(room);
    this.markVisited();
    const card = $('#card');
    let html = '';
    if (id === 'intro') {
      html = `<h1 class="t-hero">${esc(person.name)}</h1><p class="t-line">${esc(person.tagline)}</p>
        <p class="t-small">A labyrinth lies under these dunes. Each chamber holds part of my work, and the way ends in a palace courtyard.</p>`;
    } else {
      const e = entries[id];
      if (!e) return;
      html = entryHTML(e);
      if (id === 'contact') {
        html += `<p class="t-contact">${e.links!.map((l) => `<a href="${l.href}"${ext(l.href)}>${esc(l.label)}</a>`).join('')}</p>`;
      } else {
        const links = (e.links ?? []).slice(0, 2).map((l) => `<a href="${l.href}"${ext(l.href)}>${esc(l.label)}</a>`).join('');
        html += `<p class="t-actions"><button type="button" class="read" data-read>Read more</button>${links}</p>`;
      }
    }
    card.innerHTML = `<p class="t-room">${esc(room)}</p>` + html;
    card.classList.remove('show');
    void card.offsetWidth;
    card.classList.add('show');
  }

  hideEntry() {
    this.active = null;
    $('#card').classList.remove('show');
  }

  openActive() {
    if (!this.active || this.active.id === 'intro') return;
    const e = entries[this.active.id];
    if (!e) return;
    let h = `<p class="t-room">${esc(this.active.room)}</p>` + entryHTML(e, true);
    if (e.id === 'education') h += `<div class="t-skills">${skills.map((s) => `<p><strong>${esc(s.label)}</strong> ${s.items.map(esc).join(', ')}</p>`).join('')}</div>`;
    if (e.links?.length) h += `<p class="t-links">${e.links.map((l) => `<a href="${l.href}"${ext(l.href)}>${esc(l.label)}</a>`).join('')}</p>`;
    if (e.shots?.length) h += `<div class="t-shots">${e.shots.map((s) => `<figure><img src="${s.src}" alt="${esc(s.alt)}" width="${s.w}" height="${s.h}" loading="lazy" decoding="async"><figcaption>${esc(s.alt)}</figcaption></figure>`).join('')}</div>`;
    const modal = $('#chapter');
    $('.chapter-body', modal).innerHTML = h;
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('open'));
    this.modalOpen = true;
    this.h.pause(true);
    $<HTMLButtonElement>('[data-close]', modal).focus();
  }

  closeModal() {
    const modal = $('#chapter');
    modal.classList.remove('open');
    this.modalOpen = false;
    this.h.pause(false);
    setTimeout(() => { if (!this.modalOpen) modal.hidden = true; }, 450);
  }

  toggleMap(force?: boolean) {
    const m = $('#map');
    const open = force ?? m.hidden;
    if (open) { m.hidden = false; requestAnimationFrame(() => m.classList.add('open')); }
    else { m.classList.remove('open'); setTimeout(() => { if (!m.classList.contains('open')) m.hidden = true; }, 300); }
    $('#mapbtn').setAttribute('aria-expanded', String(open));
  }

  private markVisited() {
    const names = new Set(this.visited);
    document.querySelectorAll<HTMLButtonElement>('#map [data-room]').forEach((b) => b.classList.toggle('seen', names.has(b.textContent!.replace(/^\d+/, ''))));
  }

  joystick(x: number, y: number, dx: number, dy: number, on: boolean) {
    const j = $('#joy');
    j.classList.toggle('on', on);
    if (!on) return;
    j.style.transform = `translate(${x - 50}px, ${y - 50}px)`;
    $('i', j).style.transform = `translate(${dx}px, ${dy}px)`;
  }

  marker(on: boolean) { document.body.classList.toggle('moving', on); }

  hintDone() {
    if (this.hinted) return;
    this.hinted = true;
    setTimeout(() => document.body.classList.add('hinted'), 2500);
  }
}

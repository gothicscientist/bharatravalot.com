// Single source of truth for everything the world and the quick view say.
// Every fact here comes from Bharat's resume (Nov 2026) or his public repositories.
// Do not add numbers that are not in those sources.

export interface Link {
  label: string;
  href: string;
}

export interface Shot {
  src: string;
  alt: string;
  w: number;
  h: number;
}

export interface Entry {
  id: string;
  kind: 'project' | 'experience' | 'leadership' | 'education' | 'about' | 'contact' | 'intro';
  title: string;
  role?: string;
  when?: string;
  where?: string;
  /** One sentence, plain. */
  line: string;
  /** Short paragraphs for the long view. */
  body?: string[];
  /** Concrete outcomes, each one sentence. */
  facts?: string[];
  stack?: string[];
  links?: Link[];
  shots?: Shot[];
}

export const person = {
  name: 'Bharat Ravalot',
  legalName: 'Bharat Bhati',
  clan: 'Ravalot',
  home: 'Jaisalmer',
  devanagari: 'भरत',
  tagline: 'Economics and Data Science at UC Berkeley. I build products, studios and the occasional world.',
  email: 'bharatbhati@berkeley.edu',
  phone: '770-310-8059',
  phoneHref: 'tel:+17703108059',
  linkedin: 'https://linkedin.com/in/bharat-bhati',
  github: 'https://github.com/gothicscientist',
  location: 'Berkeley, California',
  interests: ['mechanical keyboards', 'grand strategy games', 'hiking', 'thrifting'],
};

export const entries: Record<string, Entry> = {
  about: {
    id: 'about',
    kind: 'about',
    title: 'Bharat Ravalot',
    role: 'Student, founder, builder',
    where: 'UC Berkeley',
    line: 'A first-year at Berkeley studying Economics and Data Science, drawn to product management and startups.',
    body: [
      'I started by building worlds in Roblox, turned that into a studio with paying clients, and kept going: a keyboard finder, a closet for clothes resellers, a population genetics lab, a timing assist for a table-tennis game.',
      'Most of what I make starts as something I care about. I love mechanical keyboards, so I made Thock. I thrift, so I made pileGo. My family speaks Marwari, so I spent two years helping preserve it.',
    ],
  },

  radiant: {
    id: 'radiant',
    kind: 'experience',
    title: 'Radiant Tech',
    role: 'Founder, Roblox development studio',
    when: 'Jun 2024 to present',
    line: 'A studio that sells custom game environments and ready-made digital assets to Roblox creators and game studios.',
    facts: [
      'Made $20,000+ in revenue from 300+ clients and game studios, running sales and marketing myself.',
      'Managed a team of 8 developers and artists to ship 15+ client projects with 30M+ combined visits.',
      'Turned client asks into clear scopes, milestones and reviews through launch.',
      'Grew a 2,000+ member creator community and used its feedback to decide what to build and release next.',
    ],
    stack: ['Roblox Studio', 'Blender', 'Luau'],
  },

  pilego: {
    id: 'pilego',
    kind: 'project',
    title: 'pileGo!',
    role: 'Designer and engineer',
    when: '2026',
    line: 'A free, open-source closet for people who resell clothes: photograph a piece, let the AI write the listing, and send it to six marketplaces at once.',
    body: [
      'Reselling means retyping the same jacket into eBay, Vinted, Depop, Poshmark, Mercari and Grailed, then remembering to take it down everywhere when it sells. pileGo keeps one record per piece and does the rest.',
      'Only eBay has a public seller API, so pileGo is honest about reach: every marketplace is labelled Automatic, One click, Auto-post, Assisted or Listing kit, and a browser extension does the work in the seller\'s own logged-in tab.',
    ],
    facts: [
      'AI scan of up to 12 photos reads brand, size, colours, materials, condition and flaws, writes the description and suggests a price.',
      'Cross-lists to eBay, Vinted, Depop, Poshmark, Mercari and Grailed, each within that site\'s limits.',
      'When a piece sells anywhere, removal from every other marketplace is queued.',
      'Pricing blends the AI estimate, comparable eBay listings and your own past sales, and says why.',
      'Runs on free tiers: Supabase, Google Gemini and Cloudflare Pages. AGPL-3.0.',
    ],
    stack: ['TypeScript', 'React', 'Supabase', 'Deno edge functions', 'Gemini', 'Chrome extension'],
    links: [
      { label: 'pilego.app', href: 'https://pilego.app' },
      { label: 'Source', href: 'https://github.com/gothicscientist/pileGo-' },
    ],
    shots: [
      { src: '/media/pilego-pile.webp', alt: 'The pile: unsold pieces scattered on a paper floor with kraft price tags', w: 1360, h: 900 },
      { src: '/media/pilego-crosslist.webp', alt: 'The cross-list sheet with a preview for each marketplace', w: 1360, h: 900 },
      { src: '/media/pilego-insights.webp', alt: 'Insights: profit receipt and sales charts', w: 1360, h: 900 },
    ],
  },

  thock: {
    id: 'thock',
    kind: 'project',
    title: 'Thock',
    role: 'Designer and engineer',
    when: '2026',
    line: 'A parts picker for custom mechanical keyboards: answer eight questions and get complete builds made from real store parts.',
    body: [
      'Custom keyboards spread cases, PCBs, plates, switches and keycaps across dozens of retailers. Thock turns how you want a board to feel and sound into ranked builds, then lets you swap any part while it checks compatibility.',
      'It is a static site with no backend. A daily pipeline crawls public store feeds, rejects incomplete crawls, and ships a small boot snapshot ranked by the same code the browser uses, so the first screen is instant.',
    ],
    facts: [
      '8,195 build-ready parts from 24 stores, refreshed every day.',
      'Checks switch family, PCB and plate fit, keycap layout, stabilizers and hot-swap against solder.',
      'Builds are shared as versioned URLs that encode every part and answer, with no server storage.',
      'Refreshes are blocked if a required source fails or the catalog shrinks by more than 20%.',
    ],
    stack: ['JavaScript', 'Node.js', 'GitHub Actions', 'Playwright', 'sharp'],
    links: [
      { label: 'thock.cc', href: 'https://thock.cc' },
      { label: 'Source', href: 'https://github.com/gothicscientist/thock' },
    ],
    shots: [
      { src: '/media/thock-finder.webp', alt: 'Thock finder: a floating field of keyboards above the first question', w: 1600, h: 1000 },
      { src: '/media/thock-builder.webp', alt: 'Thock builder with parts, prices and compatibility checks', w: 1600, h: 1000 },
    ],
  },

  strata: {
    id: 'strata',
    kind: 'project',
    title: 'Strata',
    role: 'Designer and engineer',
    when: '2026',
    line: 'A research instrument for population genetics: place a genome among ancient and present-day populations, then test which ancestry models the data supports.',
    body: [
      'Strata reads raw DNA from the big consumer services, places it in a curated library of reference populations from the Allen Ancient DNA Resource, and fits mixture models with bootstrap uncertainty.',
      'Formal tests (qpAdm, qpWave, f4) run through ADMIXTOOLS 2 in a containerised R worker. An AI research agent can plan and critique analyses, and a grounding check flags any number it states that no tool returned. The agent never sees genotypes.',
    ],
    facts: [
      'Keeps exploratory fits and formal tests apart everywhere: in result types, reports, the UI and the agent\'s tools.',
      'Research agent with 13 tools over the real engine, retrieval over a methods corpus, and a deterministic grounding check.',
      'Raw DNA is stored only as encrypted panel dosages and is never sent to a language model.',
      'Reproducible reports record input hashes, parameters, software and reference-data versions.',
    ],
    stack: ['Next.js', 'FastAPI', 'NumPy and SciPy', 'R and ADMIXTOOLS 2', 'Supabase', 'Claude and OpenAI'],
    links: [
      { label: 'stratalab.cc', href: 'https://stratalab.cc' },
      { label: 'Source', href: 'https://github.com/gothicscientist/strata' },
    ],
    shots: [
      { src: '/media/strata-landing.webp', alt: 'Strata landing page with a layered column of ancient periods', w: 1280, h: 880 },
      { src: '/media/strata-qpadm.webp', alt: 'A worked qpAdm model in Strata', w: 1280, h: 883 },
    ],
  },

  rally: {
    id: 'rally',
    kind: 'project',
    title: 'Rally Assist',
    role: 'Extension author',
    when: 'Oct 2026',
    line: 'A browser extension for Rally, Aiden Guan\'s phone-as-paddle table-tennis game, that retimes swings to the exact contact instant.',
    body: [
      'Rally turns a phone into a table-tennis paddle. I did not make Rally; I made Rally Assist, a Manifest V3 extension that reads the game\'s own simulation instead of guessing from pixels.',
      'It hooks the game\'s update loop for timing, adds shot presets and placement, and restores every original method the moment it is switched off.',
    ],
    facts: [
      'Perfect timing, auto-return, auto-serve, five shot presets and four placement modes.',
      'Uses the game\'s simulation clock and predicted contact, not a UI poll.',
      'Reversible hooks: disabling restores only the wrappers this instance still owns.',
      'No dependencies, no background worker and no network requests of its own.',
    ],
    stack: ['JavaScript', 'Manifest V3', 'Shadow DOM', 'Playwright'],
    links: [{ label: 'Source', href: 'https://github.com/gothicscientist/rally-assist' }],
    shots: [{ src: '/media/rally-overview.webp', alt: 'The Rally Assist panel on a local test page', w: 1280, h: 860 }],
  },

  speed: {
    id: 'speed',
    kind: 'project',
    title: '+1 Speed Sponge Escape',
    role: 'Creator, free-to-play Roblox game',
    when: 'Aug 2026 to present',
    line: 'A speed simulator and obstacle course for PC and mobile that I designed, coded in Luau and launched.',
    facts: [
      'Peaked at 200+ concurrent players.',
      'Raised tutorial completion from 54% to 70% by tracking where new players quit, then simplifying that step after mobile playtests.',
      'Lifted day-1 retention from 0.28% to 2%+ and average session length from 8 to 22 minutes by rebalancing rewards and progression on player feedback and two-week cohort data.',
    ],
    stack: ['Luau', 'Roblox Studio', 'AnalyticsService'],
  },


  agora: {
    id: 'agora',
    kind: 'project',
    title: 'Agora',
    role: 'Team member, Blue Ocean Student Entrepreneur Competition',
    when: 'Mar 2025',
    line: 'A group-buying concept where car dealers compete on price for pooled first-time buyers. Top 30 of 13,000 students from 163 countries.',
    facts: [
      'Compared prices and costs on 66 popular cars (42.6% average markup) and sized a $122M market.',
      'Designed a capped dynamic fee model.',
      'Proposed a launch plan with a $500 first-purchase offer for the first 1,000 users, positioned against CarMax and Autotrader.',
    ],
  },

  fbla: {
    id: 'fbla',
    kind: 'leadership',
    title: 'Future Business Leaders of America',
    role: 'Community Service President',
    when: 'Sep 2024 to Jan 2026',
    line: 'Led a 20-person committee and three community partnerships.',
    facts: ['State champion, Virtual Business Challenge, and #3 at nationals.'],
  },

  marwari: {
    id: 'marwari',
    kind: 'experience',
    title: 'Keeping Marwari',
    role: 'Linguistics Research Assistant, University of Texas at Austin',
    when: 'Oct 2025 to Jan 2026',
    line: 'Marwari is the language of my family and of the Thar. I have spent two years helping keep it written down and spoken.',
    facts: [
      'Built a cleaned speech dataset from 5+ hours of endangered Marwari audio: ran it through OpenAI Whisper, hand-corrected the transcripts, and compared results against existing Kangri speech models.',
      'Co-wrote a $20,000 Seksharia grant proposal to fund Marwari language-preservation work.',
      'QA-tested an online Marwari course used by 50+ learners before release.',
      'Volunteer Historian at the Marwari Restoration Initiative (Jun 2023 to Jan 2026): built a 300-term digital dictionary.',
    ],
    stack: ['Python', 'OpenAI Whisper'],
  },

  education: {
    id: 'education',
    kind: 'education',
    title: 'UC Berkeley',
    role: 'B.A. Economics and Data Science',
    when: 'Expected May 2029',
    where: 'Berkeley, CA',
    line: 'Studying how markets and data behave, and how to build products on both.',
    facts: [
      'National Merit Scholar (1520/1520 PSAT).',
      'NYT Writing Semifinalist.',
      'Roblox Crown (1K+ MAU).',
      'West Windsor-Plainsboro High School North, 2022 to 2026: GPA 3.86, SAT 1560.',
    ],
  },

  contact: {
    id: 'contact',
    kind: 'contact',
    title: 'Sit by the fire',
    line: 'I am looking for product, strategy and startup roles. Write to me.',
    links: [
      { label: 'bharatbhati@berkeley.edu', href: 'mailto:bharatbhati@berkeley.edu' },
      { label: '770-310-8059', href: 'tel:+17703108059' },
      { label: 'LinkedIn', href: 'https://linkedin.com/in/bharat-bhati' },
      { label: 'GitHub', href: 'https://github.com/gothicscientist' },
    ],
  },
};

export const skills: { label: string; items: string[] }[] = [
  { label: 'Code and tools', items: ['Python', 'SQL', 'TypeScript', 'Luau', 'Roblox Studio', 'Blender', 'Funnel and cohort analysis'] },
  { label: 'AI', items: ['LLM evaluation', 'Prompt engineering', 'Agent workflows', 'OpenAI Agents SDK', 'Claude Code', 'Codex'] },
  { label: 'Product and growth', items: ['User research', 'Product specs', 'Roadmaps', 'Sales and marketing', 'Game design', 'Playtesting'] },
];

/** Stations along the journey, west from dawn to night. `x` is set in the world layout. */
export interface Station {
  id: string;
  entry: string;
  place: string; // English place name shown in the world
  placeLocal: string; // Devanagari
  time: string; // shown in the sun-path HUD
}

export const stations: Station[] = [
  { id: 'dunes', entry: 'intro', place: 'The Thar before dawn', placeLocal: 'थार', time: 'Before dawn' },
  { id: 'fort', entry: 'about', place: 'The golden fort', placeLocal: 'सोनार किलो', time: 'Sunrise' },
  { id: 'workshop', entry: 'radiant', place: 'The stone carvers\' yard', placeLocal: 'कारखानो', time: 'Morning' },
  { id: 'bazaar', entry: 'pilego', place: 'The dyers\' bazaar', placeLocal: 'बजार', time: 'Morning' },
  { id: 'haveli', entry: 'thock', place: 'The merchants\' havelis', placeLocal: 'हवेली', time: 'Late morning' },
  { id: 'stepwell', entry: 'strata', place: 'The stepwell', placeLocal: 'बावड़ी', time: 'Noon' },
  { id: 'archery', entry: 'rally', place: 'The archery ground', placeLocal: 'चांदमारी', time: 'Early afternoon' },
  { id: 'greatdunes', entry: 'speed', place: 'The great dunes', placeLocal: 'धोरा', time: 'Afternoon' },
  { id: 'serai', entry: 'agora', place: 'The caravanserai', placeLocal: 'सराय', time: 'Golden hour' },
  { id: 'chhatris', entry: 'marwari', place: 'The royal cenotaphs', placeLocal: 'छतरियां', time: 'Sunset' },
  { id: 'observatory', entry: 'education', place: 'The observatory', placeLocal: 'जंतर मंतर', time: 'Night' },
  { id: 'camp', entry: 'contact', place: 'The last fire', placeLocal: 'धूणी', time: 'Night' },
];

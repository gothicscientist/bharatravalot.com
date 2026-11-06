# bharatravalot.com

Bharat Ravalot's personal site, in two parts:

- **The journey** (`/`): a 2.5D walk west across the Thar near Jaisalmer, from before dawn to the last fire. Twelve places along the way each hold a piece of the work. Everything you see and hear is generated in the browser: the architecture, the dunes, the light, the traveller and the sound.
- **The quick view** (`/work/`): the same content as an editorial page for people in a hurry. It is prerendered at build time, works without JavaScript, prints cleanly, and is where browsers without WebGL 2 land.

## Run it

```sh
npm ci
npm run dev       # http://localhost:5173
npm run build     # type-checks, then builds to dist/
npm run preview
```

## Where things live

| Path | What it is |
| --- | --- |
| `src/content.ts` | Every fact on the site, and the list of places. Edit words here only. |
| `src/world/layout.ts` | Terrain, layers and what stands at each place |
| `src/world/art/` | Architecture, nature and people, built from lit vector shapes |
| `src/world/palette.ts` | The colour of the day, keyed to how far west you are |
| `src/world/shaders.ts`, `renderer.ts` | WebGL 2 lighting, sky, bloom, light shafts and grading |
| `src/world/traveller.ts` | The traveller's walk, run, jump, sit and cloth |
| `src/world/audio.ts` | Synthesised wind, tanpura, footsteps and fire |
| `src/work/render.ts` | The quick view's HTML, rendered at build time |
| `DESIGN.md` | Art direction and the decisions behind it |

## Deploy

Every push to `main` builds and deploys to GitHub Pages through `.github/workflows/deploy.yml`. The custom domain comes from `public/CNAME`.

## Stills

`?still=<x>` renders a clean frame of the journey at world position `x` with no interface (optional `vh`, `dx`, `dy` adjust the camera). The hero image and `og.jpg` are captured this way.

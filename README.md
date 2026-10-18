# LUMINA · آتلیهٔ مریدین

> کمتر بساز، با تأمل بیشتر.

خانهٔ دیجیتال مستقل — استراتژی، هویت و مهندسی زیر یک سقف.  
تجربه‌های دیجیتال پرچم‌دار به‌صورت نسخه‌های شماره‌دار رزرو می‌شوند؛ دو نسخه در هر فصل.

**Production URL:** [lumina.studio](https://lumina.studio/)  
**Stack:** Vanilla ES modules · Design Tokens · WebGL · Lenis · View Transitions · **zero third-party requests**

---

## Architecture Overview

This is a **zero-build, progressive-enhancement** single-page experience.  
All JavaScript is native ES modules served directly from the origin. No bundler is required for production.

```
index.html                  ← Semantic shell + critical inline boot
assets/
  css/
    fonts.css               ← Self-hosted @font-face + metric-matched local fallbacks
    tokens.css              ← Design system primitives (color, type, space, motion)
    base.css                ← Reset, typography, global layout, reduced-motion
    components.css          ← Buttons, cards, dialogs, forms, chrome
    sections.css            ← Page sections & large-scale compositions
    showcase.css            ← Kinetic manifesto & compare slider
  fonts/                    ← Subsetted woff2 (arabic + latin per family)
  vendor/
    lenis.min.js            ← Smooth scroll, vendored
  js/
    app.js                  ← Orchestration & boot sequence (entry point)
    core.js                 ← DOM helpers, frame loop, scroll, theme, dialogs, utils
    data.js                 ← Content catalog (editions, cases, essays) + art generator
    render.js               ← DOM renderers for editions / work / journal
    reader.js               ← Case / essay / product reader dialogs
    cart.js                 ← Reservation cart + persistence
    form.js                 ← Brief builder & enquiry flow
    palette.js              ← Command palette (⌘K)
    chrome.js               ← Header, progress, studio status, clocks
    fx.js                   ← Motion system (veil, reveals, shader, cursor, specular, counters)
    showcase.js             ← Showcase interactions (manifesto scrub, compare slider)
```

### Zero Third-Party Requests

The page loads from its own origin and nothing else. This was the single largest
performance change in the project's history and it was driven by measurement, not taste:

- **GSAP + ScrollTrigger removed** (115KB across two origins). GSAP animated scroll
  positions the browser now does natively, and ScrollTrigger had **zero** animations
  registered — it was only ever handed `ScrollTrigger.update`. Scroll reveals run on
  compositor-driven view timelines where the browser has them, with an
  IntersectionObserver plus a CSS transition as the fallback — and the observer is
  only set up on the fallback path, so a supported browser pays nothing for it.
  Lenis is pumped by the existing `onFrame`
  loop, so smooth scrolling costs no extra rAF chain and no extra dependency.
- **Lenis vendored** instead of pulled from jsDelivr.
- **Fonts self-hosted** and subsetted. The Google Fonts stylesheet was render-blocking
  and was the slowest resource on the page — in profiling, third-party responses finished
  at 2057ms while every local asset was done by 47ms. It was the entire LCP story.

### Fonts

`fonts.css` declares each family twice: the subsetted webfont, and a metric-matched
local fallback. The fallback overrides were measured, not estimated — rendering the
site's real Persian copy at 200px through both and solving for the values that
reproduce the webfont's line box:

| Family        | `size-adjust` | `ascent-override` | `descent-override` | Line box  | Webfont |
| ------------- | ------------- | ----------------- | ------------------ | --------- | ------- |
| Markazi Text  | 96.1%         | 92.4%             | 39.8%              | 1.2704 em | 1.2700  |
| Vazirmatn     | 100.9%        | 101.5%            | 53.1%              | 1.5598 em | 1.5600  |
| IBM Plex Mono | 109.9%        | 93.3%             | 25%                | 1.2999 em | 1.3000  |

Times New Roman is the Persian fallback deliberately. Tahoma and Segoe UI also carry
Arabic, but they set the same string 23–34% wider, which rewraps every paragraph on
swap; Times New Roman lands within 0.9% and ships on Windows, macOS and most Linux
desktops.

Subsets keep the whole Arabic block (letters, Arabic-Indic and Persian digits,
punctuation) so copy can still be edited freely, and drop the presentation-forms and
unused-script ranges that dominated the originals: **187.5KB → 132KB**.

### Module Graph & Load Strategy

- `app.js` is the single entry. All other modules are preloaded via `<link rel="modulepreload">`.
- Critical path: `core → data → render → reader/cart/form/palette/chrome`.
- The three faces the first screen needs are `<link rel="preload">`; everything else is lazy.
- Cosmetic effects (`fx.*`) are scheduled with `requestIdleCallback` so they never block first paint.
- The hero shader compiles through `KHR_parallel_shader_compile` where the driver
  offers it, so a slow shader build never parks the main thread — the loop polls a
  completion flag instead. The synchronous path remains for drivers that lack it.
- Shared `onFrame` ticker (core.js) drives every animation **and Lenis**. Effects subscribe/unsubscribe; the loop pauses when the tab is hidden.

### The One-Moment Rule

The governing constraint of this design: **each section gets exactly one gesture.** A
section that animates three things at once reads as noise rather than craft, so
when a gesture was cut, it was cut everywhere it appeared.

| Section    | Its one moment                                  |
| ---------- | ----------------------------------------------- |
| Hero       | The shader field behind the specimen            |
| Manifesto  | Kinetic word scrub                              |
| Difference | The compare sweep                               |
| Editions   | Scarcity; the featured card owns the specular   |
| Craft lab  | The tile you touch (accent, type, easing, ⌘K)   |
| Journey    | The device building itself from scroll position |

Everything else is deliberately still: no magnetic buttons, no 3D card tilt, no
particle field, no cursor aura, no per-letter scramble, no hover lift on journal
cards. Hover states change colour and border — not position.

### Type Hierarchy

Display sizes are a rationed resource. The hero owns `--fs-display` and nothing
else may use it; every step below is at least a full notch down, so the eye always
knows where it is.

| Token            | Role                         | 390px | 1440px |
| ---------------- | ---------------------------- | ----- | ------ |
| `--fs-display`   | hero title, and nothing else | 55px  | 120px  |
| `--fs-stat`      | figures and counters         | 36px  | 60px   |
| `--fs-h2`        | every section heading        | 31px  | 51px   |
| `--fs-statement` | manifesto, band, studio      | 24px  | 40px   |
| `--fs-h3`        | card and tile titles         | 19px  | 25px   |

The hero:s heading ratio holds at roughly 2.3 : 1 from tablet up.

### Performance Tiers

Computed once on boot and stored in `document.documentElement.dataset.tier`:

| Tier | Condition                                           | Behaviour                            |
| ---- | --------------------------------------------------- | ------------------------------------ |
| 0    | Desktop, ≥6 cores / ≥8 GB                           | Full shader, high DPR                |
| 1    | Mobile or mid-range                                 | Smaller shader, lower DPR            |
| 2    | Low memory / cores                                  | 3-octave shader, DPR 1               |
| 3    | `prefers-reduced-motion` / Save-Data / very low end | All motion & canvas effects disabled |

### Design System

- **Tokens-first**: every colour, space, radius, duration and easing lives in `tokens.css`.
- Accent system: `gold | platinum | rose | emerald | sapphire` (data-attribute driven).
- Theme: `auto | light | dark` with View Transition circle reveal.
- Typography: Markazi Text (display) + Vazirmatn (UI) + IBM Plex Mono, self-hosted.
- Colour space: OKLCH throughout; WebGL shaders convert OKLCH → sRGB only when the palette changes.
- Two section rhythms: `--section-y` for content, `--section-y-lg` for the two
  sections that stop to say one thing (manifesto, band).
- Five layers, declared once: `tokens → base → components → sections → showcase`.
  Showcase shares the `sections` layer because it extends the page rather than
  standing apart from it.

### Persian Typography

Refinements specific to the script rather than to the brand:

- **Marks positioned explicitly.** The copy carries real combining marks (fathatan,
  kasra in words like «تأمل»). `mark` and `mkmk` are switched on rather than left to
  the browser's default for Arabic runs, so no engine can stack a mark on the previous
  letter. `calt` gives the contextual Persian forms; `tnum` keeps Persian and Latin
  figures the same width so number columns align.
- **`Vazirmatn` inside the mono stack.** IBM Plex Mono has no Arabic coverage, so
  Persian inside mono labels (eyebrows, indices, plate captions) is shaped by
  Vazirmatn, not by the system monospace.
- **Balanced headings, pretty paragraphs.** Persian measures wide, so an unbalanced
  rag is far more visible than in Latin. Every multi-line title gets `text-wrap:
balance` in one grouped rule; long intros get `pretty`, since balancing a six-line
  paragraph flattens the rag.
- **Leading checked against ink, not guessed.** Vazirmatn carries a 0.537em descender,
  so display leading was measured against the real ink box of a representative Persian
  line at every type role. Nothing clips.
- **Mixed-script runs verified.** The site embeds Latin inside Persian in eighteen
  places (client names, coordinates, `OKLCH`, `Ctrl+K`). Each was checked by measuring
  the visual x-order of the Latin run's first and last glyph; all eighteen render
  left-to-right correctly, so no `unicode-bidi` overrides were added.

### Key Engineering Decisions

1. **One moment per section** — the organising constraint of the whole design system; see above.
2. **No third-party requests** — measured, not assumed; see above.
3. **Single frame loop** — no per-effect `requestAnimationFrame` chains. Lenis runs on it too.
4. **`runWhileOnscreen`** — IntersectionObserver + visibilitychange combined; effects tear themselves down when off-screen.
5. **Delegation-first interactions** — one document-level click handler for all `[data-*]` actions.
6. **Persian-aware utilities** — `faNum`, `norm` (folds Arabic/Persian variants + digits), currency formatter.
7. **View Transitions API** with graceful fallback and “never drop the update” guard.
8. **No dead code** — stylesheets and modules that nothing references are deleted, not parked.
9. **Measure, don't guess** — font fallback metrics, scroll-timeline ranges and type leading were all resolved by rendering and reading values back. Where a "more modern" approach measured worse, the older approach was kept and the finding written down: see the journey section in `showcase.css`.
10. **Accessibility** — skip link, ARIA, focus return on dialog close, reduced-motion respect, high-contrast ready.

### Measured Result

Profiled in Chrome at 1440×900, cold cache, before and after this work:

| Metric                           | Before | After      |
| -------------------------------- | ------ | ---------- |
| First Contentful Paint           | 2552ms | **924ms**  |
| Largest Contentful Paint         | 2552ms | **924ms**  |
| DOMContentLoaded                 | 2830ms | **316ms**  |
| Load                             | 3099ms | **356ms**  |
| Cumulative Layout Shift          | 0.0124 | **0.0024** |
| JS heap                          | 3.3MB  | **2.0MB**  |
| First-party bytes (uncompressed) | 595KB  | **432KB**  |
| Third-party origins              | 3      | **0**      |

CLS fell because the font fallbacks now occupy the same space as the webfonts.
LCP fell because nothing render-blocking comes from another host.

---

## Local Development

```bash
# Optional tooling (recommended)
npm install

# Serve the site (any static server)
npx serve .
# or
python3 -m http.server 8080
```

### Scripts

```bash
npm run lint          # ESLint on assets/js
npm run format        # Prettier write
npm run format:check  # Prettier check (CI)
npm run check         # Syntax + lint + format
```

Production remains **zero-build**. The Node tooling exists purely for developer experience and CI gates.

---

## Browser Support

- Modern evergreen browsers (Chrome / Firefox / Safari / Edge last 2 versions).
- Progressive: without JavaScript the page still presents the manifesto and static structure.
- WebGL2 / View Transitions / Scroll-driven animations degrade gracefully.

---

## Contributing

1. Create a feature branch from `main`.
2. Keep modules small and single-responsibility.
3. Prefer the shared frame loop and `runWhileOnscreen` over new RAF chains.
4. Respect the tier system — never force expensive work on tier ≥ 2.
5. Run `npm run check` before opening a PR.

---

© LUMINA · Meridian Atelier · MMXXVI

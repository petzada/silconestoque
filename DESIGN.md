## Overview

IBM's marketing system is a faithful application of **Carbon Design System** — IBM's open-source enterprise design system. The dominant surface is `{colors.canvas}` pure white with `{colors.surface-1}` light gray for elevation, charcoal `{colors.ink}` (#161616) for text, and IBM Blue `{colors.primary}` (#0f62fe) as the single brand accent.

The defining choice is **flat geometry**: every CTA, every card, every input, every container uses square corners (`{rounded.none}` 0px) with thin 1px borders. There are no rounded pills, no soft shadows, no atmospheric gradients. The system is engineered, not stylized.

**IBM Plex Sans** carries the entire type hierarchy. Display sizes (76 / 60 / 42px) run at weight **300** — IBM's signature light display treatment that makes 76px feel calmer than competing brands' 700-weight display. Body type sits at weight 400 with `letter-spacing: 0.16px` (a Carbon precision detail) and line-height 1.50. The voice reads as careful, technical, and trustworthy.

The system reaches for color rarely — IBM Blue marks links, primary CTAs, and the rare full-bleed CTA banner. Charcoal carries every other surface that isn't white. The result is enterprise gravitas without the enterprise stiffness: rigorous, light-weighted, and intentionally restrained.

**Key Characteristics:**
- **Carbon Design System** — IBM's marketing chrome IS Carbon. Buttons are square, inputs are square-with-bottom-rule, corners stay at 0px.
- **Light-weight display type**: Plex Sans at weight 300 for 42–76px headlines is the brand's typographic signature.
- **One accent color**: `{colors.primary}` IBM Blue carries every link, primary CTA, and CTA banner. There is no second brand color.
- White canvas + light gray (`{colors.surface-1}`) + charcoal (`{colors.ink}`) cover 95% of surfaces.
- Footer inverts to charcoal (`{colors.inverse-canvas}` #161616) — the only dark surface above the page break.
- Card hierarchy is carried by 1px hairlines and surface change, never by drop shadow.
- `letter-spacing: 0.16px` on body is a Carbon precision detail — the small positive tracking is part of the brand voice.
- Page rhythm: utility bar → top nav → hero with light-weight headline → feature card grid → customer logo marquee → enterprise feature row → training section → newsletter / sign-in CTA → dark footer.

## Colors

> Source pages: ibm.com (home), /software/ai-productivity, /consulting, /products/cloud-pak-for-aiops, /products/bare-metal-servers, community.ibm.com.

### Brand & Accent
- **IBM Blue** ({colors.primary}): The single brand accent. Links, primary CTAs, CTA banner backgrounds, focus rings.
- **Blue 60** ({colors.blue-60}): Hovered link state.
- **Blue 80** ({colors.blue-80}): Pressed primary button.
- **Blue Hover** ({colors.blue-hover}): Hover state for primary buttons.

### Surface
- **Canvas** ({colors.canvas}): Default page background.
- **Surface 1** ({colors.surface-1}): Light gray (#f4f4f4) — input fields, alternate-row stripes, subtle section bands.
- **Surface 2** ({colors.surface-2}): Slightly darker gray (#e0e0e0) — disabled fields, hairline-as-fill for separators.
- **Hairline** ({colors.hairline}): 1px borders on cards, inputs, dividers.
- **Hairline Strong** ({colors.hairline-strong}): 1px charcoal underline on focused inputs (Carbon's signature focus treatment).
- **Inverse Canvas** ({colors.inverse-canvas}): Charcoal #161616 — footer surface.
- **Inverse Surface 1** ({colors.inverse-surface-1}): One step lighter than inverse canvas — footer column dividers, hovered footer items.

### Text
- **Ink** ({colors.ink}): All headlines and emphasized body type — charcoal #161616.
- **Ink Muted** ({colors.ink-muted}): Secondary type at #525252 — meta, sub-headlines, footer body.
- **Ink Subtle** ({colors.ink-subtle}): Tertiary type at #8c8c8c — disabled, helper text, captions.
- **Inverse Ink** ({colors.inverse-ink}): White on charcoal — footer headings.
- **Inverse Ink Muted** ({colors.inverse-ink-muted}): Light gray on charcoal — footer body.

### Semantic
- **Success Green** ({colors.semantic-success}): Carbon green-50 — success states.
- **Warning Yellow** ({colors.semantic-warning}): Carbon yellow-30 — warning states.
- **Error Red** ({colors.semantic-error}): Carbon red-60 — error states; danger button background.
- **Info Blue** ({colors.semantic-info}): Identical to primary — informational badges.

## Typography

### Font Family

- **IBM Plex Sans** — IBM's open-source proprietary typeface (free for any use). Geometric, slightly humanist, designed specifically for enterprise UI. Fallback: `Helvetica Neue, Arial, sans-serif`.

The same family carries display, body, and caption — there is no display + body pairing. Hierarchy is carried by **size + weight** rather than by family change. Plex Sans is also free / open-source under the SIL Open Font License — making it the easiest custom face on this list to substitute for in implementation.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 76px | 300 | 1.17 | -0.5px | Largest hero headline |
| `{typography.display-lg}` | 60px | 300 | 1.17 | -0.4px | Section opener headlines |
| `{typography.display-md}` | 42px | 300 | 1.20 | 0 | Sub-section headlines, hero card title |
| `{typography.headline}` | 32px | 400 | 1.25 | 0 | Card collection heading, FAQ category |
| `{typography.card-title}` | 24px | 400 | 1.33 | 0 | Feature card title |
| `{typography.subhead}` | 20px | 400 | 1.40 | 0 | Lead body next to display headlines |
| `{typography.body-lg}` | 18px | 400 | 1.50 | 0 | Hero subhead, lead paragraphs |
| `{typography.body}` | 16px | 400 | 1.50 | 0.16px | Default body |
| `{typography.body-sm}` | 14px | 400 | 1.29 | 0.16px | Card body, footer columns |
| `{typography.body-emphasis}` | 14px | 600 | 1.29 | 0.16px | Selected tab label, emphasized body line |
| `{typography.caption}` | 12px | 400 | 1.33 | 0.32px | Captions, meta, utility bar |
| `{typography.button}` | 14px | 400 | 1.29 | 0.16px | All button labels |
| `{typography.eyebrow}` | 14px | 400 | 1.29 | 0.16px | Section eyebrows (Carbon avoids strong eyebrows; uses sentence case 14px) |

### Principles

- **Light-weight display is the brand voice.** Plex Sans at weight 300 for 76px headlines reads as quietly authoritative — switching to 700 would make it look like every other enterprise site.
- **Carbon's `letter-spacing: 0.16px`** on body sizes is a precision detail. Don't remove it.
- **No mono** on marketing surfaces (Plex Mono exists but lives in product surfaces only).
- **Eyebrow typography uses sentence case 14px** — Carbon resists the all-caps tracked eyebrow common to other enterprise brands.
- **Line-heights tighten on display, relax on body**: 1.17 at display-xl, 1.50 at body — proportional to size.

### Note on Font Substitutes

IBM Plex Sans is **free and open-source** (SIL OFL license) and available on Google Fonts. It is the recommended implementation. The Plex family also includes Plex Mono and Plex Serif if expanded typographic needs arise.

## Layout

### Spacing System

- **Base unit**: 4px (Carbon's signature 4-pixel grid).
- **Tokens (front matter)**: `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- Card interior padding: `{spacing.lg}` 24px on feature cards; `{spacing.xl}` 32px on product cards; `{spacing.xxl}` 48px on hero cards and CTA banners.
- Button padding: 12px vertical · 16px horizontal — Carbon spec.
- Form input padding: 11px vertical · 16px horizontal.

### Grid & Container

- Carbon's 16-column grid at desktop, scaling to 8 / 4 columns at tablet / mobile.
- Max content width sits around 1584px (Carbon's max-grid breakpoint).
- Card grids are 4-up at desktop, 2-up at tablet, 1-up at mobile.
- The customer logo marquee uses fixed-width tiles in a flex row, scrolling horizontally on smaller viewports.

### Whitespace Philosophy

Carbon uses precise alignment to a 4-pixel grid as its whitespace system. Sections separate via thin gray rows (`{colors.surface-1}`) rather than via large vertical gaps. Content is dense by design — IBM's customers expect to see a lot on a page, not a lot of air.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| 0 (flat) | No shadow, no border | Default for body type, hero text, footer body |
| 1 (hairline) | 1px `{colors.hairline}` border on canvas | Feature cards, inputs, list items |
| 2 (surface lift) | `{colors.surface-1}` background on canvas | Alternate-row banners, hovered cards |
| 3 (focus ring) | 2px `{colors.primary}` outline + 1px `{colors.hairline-strong}` underline | Focused input, focused button |

Carbon resists drop shadows on marketing — depth is carried by surface change and 1px hairlines. The exception is product / app surfaces (Carbon documents shadow tokens for elevated panels), but the marketing site barely uses them.

### Decorative Depth

- **Soft blue gradient backdrops** appear behind some hero illustrations — a faint blue-to-white wash that warms the canvas without competing with the headline.
- **No atmospheric depth.** No spotlight cards, no pastel section blocks, no gradient panels.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Default — every button, card, input, container |
| `{rounded.xs}` | 2px | Small badges (rare exception) |
| `{rounded.sm}` | 4px | Avatar circles squared, dropdown menus |
| `{rounded.md}` | 6px | (Used rarely; documented for completeness) |
| `{rounded.lg}` | 8px | (Used rarely; documented for completeness) |
| `{rounded.pill}` | 9999px | Status pills, badges in product UI (rare on marketing) |

The brand commits to flat 0px corners. The other tokens exist for product / mobile surfaces but rarely surface on marketing.

### Photography & Illustration Geometry

- IBM uses photography (people, hardware, sports cars) and abstract illustration (geometric mesh, dotted patterns) interchangeably.
- Image frames are flat — no rounded corners.
- Customer logo tiles sit on `{rounded.none}` 0px tiles with thin 1px borders.

## Components

### Buttons

**`button-primary`** — Blue solid CTA. The default primary across all pages.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.button}`, padding 12px 16px, rounded `{rounded.none}`.
- Pressed state lives in `button-primary-pressed` (background shifts to `{colors.blue-80}`).

**`button-secondary`** — Charcoal solid button — Carbon's "secondary" treatment.
- Background `{colors.ink}`, text `{colors.inverse-ink}`, type `{typography.button}`, padding 12px 16px, rounded `{rounded.none}`.

**`button-tertiary`** — White button with blue 1px border + blue text. Used for tertiary CTAs.
- Background `{colors.canvas}`, text `{colors.primary}`, type `{typography.button}`, rounded `{rounded.none}`, padding 12px 16px. (Border in implementation: 1px `{colors.primary}`.)

**`button-ghost`** — Plain text + chevron, no background until hover.
- Background `{colors.canvas}`, text `{colors.primary}`, type `{typography.button}`, rounded `{rounded.none}`, padding 12px 16px.

**`button-danger`** — Carbon's destructive variant.
- Background `{colors.semantic-error}`, text `{colors.on-primary}`, type `{typography.button}`, rounded `{rounded.none}`, padding 12px 16px.

### Cards & Containers

**`feature-card`** — Default feature highlight tile on the home and product pages.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.none}`, padding 24px. Stroked with 1px `{colors.hairline}`.

**`feature-card-elevated`** — Same shape on `{colors.surface-1}` ground — used for "Recommended" cards in the latest-content carousel.
- Background `{colors.surface-1}`, otherwise identical structure.

**`product-card`** — Larger product showcase tile.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.none}`, padding 32px.

**`hero-card`** — Hero composition card with light-weight title, body, and CTA.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.display-md}`, rounded `{rounded.none}`, padding 48px.

**`cta-banner`** — Full-width blue CTA panel near the bottom of the page.
- Background `{colors.primary}`, text `{colors.on-primary}`, type `{typography.headline}`, rounded `{rounded.none}`, padding 48px.

**`resource-tile`** — Smaller article / case-study tile.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-sm}`, rounded `{rounded.none}`, padding 16px.

**`customer-logo-tile`** — Single tile in the customer marquee on the home page (Ferrari, Pfizer, etc.).
- Background `{colors.canvas}`, text `{colors.ink-muted}`, type `{typography.caption}`, rounded `{rounded.none}`, padding 24px. 1px hairline border.

### Inputs & Forms

**`text-input`** + **`text-input-focused`** + **`text-input-error`** — Carbon's input chrome.
- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.none}`, padding 11px 16px.
- Focus state replaces the bottom 1px hairline with a 2px `{colors.primary}` underline (Carbon's signature focus treatment).
- Error state adds 2px `{colors.semantic-error}` bottom underline.

**`newsletter-input`** — The "Stay connected" newsletter capture on the home page.
- Background `{colors.surface-1}`, text `{colors.ink}`, type `{typography.body}`, rounded `{rounded.none}`, padding 11px 16px. Adjacent submit is `button-primary`.

### Tabs

**`product-tab`** + **`product-tab-selected`** — The horizontal tab strip on product pages and the home "Recommended" carousel.
- Default: `{colors.canvas}` background, `{colors.ink-muted}` text, rounded `{rounded.none}`, padding 16px 20px. Bottom 1px hairline.
- Selected: `{colors.canvas}` background, `{colors.ink}` text, `{typography.body-emphasis}` weight, bottom 2px `{colors.primary}` underline. Same padding / rounding.

### Navigation

**`top-nav`** — Sticky white bar with the IBM logomark left, nav categories center, and search / sign-in icons right.
- Background `{colors.canvas}`, text `{colors.ink}`, type `{typography.body-sm}`, height 48px. 1px bottom hairline.

**`utility-bar`** — Slim gray ribbon above the top nav with location switch, contact, search shortcuts.
- Background `{colors.surface-1}`, text `{colors.ink-muted}`, type `{typography.caption}`, height 32px.

### Footer

**`footer`** — Charcoal footer (`{colors.inverse-canvas}`) with the IBM wordmark left and 5–6 columns of caption-sized links. The only inverted surface above the page break.
- Background `{colors.inverse-canvas}`, text `{colors.inverse-ink-muted}`, type `{typography.body-sm}`, padding 64px 32px.

## Do's and Don'ts

### Do

- Use `{rounded.none}` 0px on every CTA, card, input, and container. The flat-square aesthetic is the brand.
- Pair Plex Sans weight 300 for display sizes (42px+) with weight 400 for body. Resist the urge to bold the headline.
- Reserve `{colors.primary}` IBM Blue for primary CTAs, links, focused-input underlines, and CTA banner. Do not use it as a card background or eyebrow color.
- Apply `letter-spacing: 0.16px` to body sizes. It's a Carbon precision detail and part of the typographic voice.
- Use surface change (`canvas` → `surface-1`) and 1px hairlines for card hierarchy. Skip drop shadows.
- Stick to sentence case for eyebrows and section labels — Carbon resists all-caps tracking.
- Invert to `{colors.inverse-canvas}` only at the footer; the rest of the page stays light.

### Don't

- Don't round corners on buttons, cards, or inputs. Even 4px rounded corners break the Carbon look.
- Don't bold display headlines. Plex Sans at weight 300 is the brand voice; weight 700 makes it look generic.
- Don't add atmospheric depth (gradient backdrops, drop shadows, atmospheric overlays) outside the documented soft-blue hero gradient.
- Don't introduce a second brand color. IBM Blue is the only chromatic accent; status semantics use the documented green / yellow / red.
- Don't replace IBM Plex Sans with Inter or Helvetica without preserving the `letter-spacing: 0.16px` and weight-300 display treatment.
- Don't use pill-shaped buttons. Carbon uses square corners; pills read as a different brand.
- Don't write all-caps tracked eyebrows. Carbon's eyebrows are sentence case at 14px.

## Responsive Behavior

### Breakpoints

| Name | Width | Key Changes |
|---|---|---|
| Max | 1584px | Carbon max grid; gutters expand |
| Desktop-XL | 1312px | Default desktop layout |
| Desktop | 1056px | Card grid 4-up maintained |
| Tablet | 672px | Card grid 4-up → 2-up; nav becomes hamburger |
| Mobile | 320px | Single-column; display-xl scales 76px → ~32px |

### Touch Targets

- Carbon spec: 48px minimum tap target. Buttons and inputs hold 48px on touch viewports.
- Top-nav links grow from 36px to 48px tap height on touch.
- Tab strip rows hold 48px tap height.

### Collapsing Strategy

- **Top nav**: links collapse to a hamburger overlay below 672px. Logomark and search icon stay on the bar.
- **Utility bar**: hides below 672px to reclaim vertical space.
- **Card grid**: 4-up → 2-up at 1056px → 1-up below 672px.
- **Display type**: `{typography.display-xl}` 76px scales toward 42px on mobile while preserving the weight-300 treatment.
- **Footer**: 6-column link grid → 3-column at tablet → 1-column at mobile.

### Image Behavior

- Customer logos in the marquee maintain aspect ratio and may collapse to 2-row scroll below 672px.
- Hero illustrations scale proportionally; below 672px they may stack above the headline rather than sit beside it.

## Iteration Guide

1. Focus on ONE component at a time and reference it by its `components:` token name.
2. Default body to `{typography.body}` at weight 400 with `letter-spacing: 0.16px`. Don't remove the tracking.
3. When introducing a new section, decide whether it sits on `{colors.canvas}` (default) or on `{colors.surface-1}` (alternate band). The two-surface rhythm is the rhythm.
4. Run `npx @google/design.md lint DESIGN.md` after edits.
5. Add new variants as separate component entries (`button-primary-pressed`, `text-input-error`, `text-input-focused`).
6. Treat IBM Blue as scarce: links, primary CTA, CTA banner, focus underline. Anything beyond that is drift.
7. Resist rounded corners. If a designer pushes for 4px rounding, the brand is shifting away from Carbon.

## Known Gaps

- IBM's product surfaces (cloud-pak, watson, datacap) have richer Carbon component usage (data tables, graph cells, breadcrumbs, contextual menus) that aren't present on the marketing pages inspected — those components live in Carbon's documentation rather than in the marketing extraction.
- Form-field error and validation styling is documented in Carbon docs; the inspected pages didn't render error states.
- Dark mode is documented in Carbon as Gray-100 theme but isn't exposed on these marketing pages — only the footer inverts. The full dark theme is a separate Carbon palette not extracted here.
- The community.ibm.com sub-domain uses a different chrome (community-platform white-label) that approximates Carbon but isn't strict — the documented system applies to ibm.com proper.

## Resolved Tokens (implementation appendix)

This file has no front matter, and the body above references ~25 `{...}` tokens with no value defined anywhere in the document — only 6 hex codes appear literally in the prose (`#0f62fe`, `#f4f4f4`, `#e0e0e0`, `#161616`, `#525252`, `#8c8c8c`). This section resolves every token referenced above against the **official Carbon token packages**, installed and inspected directly in `node_modules` (no value below is invented or guessed):

- `@carbon/colors@11.54.0` — raw color scales (`gray`, `blue`, `green`, `red`, `yellow`, `purple`, `cyan`, `teal`, `magenta`, `orange`)
- `@carbon/themes@11.77.0` — the compiled **White** theme object (`require('@carbon/themes').white`), which is Carbon's own mapping of semantic roles (`textPrimary`, `layer01`, `borderSubtle00`, ...) onto those raw scale values
- `@carbon/type@11.63.0` — named type styles (`body01`, `caption01`, `heading03`, ...) and `fontFamilies` / `fontWeights`
- `@carbon/layout@11.55.0` — the `spacing01`–`spacing13` scale

Where a `{...}` token in the body above has no exact match in these packages, that is stated explicitly below rather than guessed.

### Colors

| Token | Value | Carbon source |
|---|---|---|
| `{colors.canvas}` | `#ffffff` | `@carbon/themes` white theme, `background` |
| `{colors.surface-1}` | `#f4f4f4` | white theme `layer01` (= `@carbon/colors` `gray10`) |
| `{colors.surface-2}` | `#e0e0e0` | white theme `layerAccent01` (= `gray20`) |
| `{colors.hairline}` | `#e0e0e0` | white theme `borderSubtle00` (= `gray20`) |
| `{colors.hairline-strong}` | `#8d8d8d` | white theme `borderStrong01` (= `gray50`) |
| `{colors.ink}` | `#161616` | white theme `textPrimary` (= `gray100`) |
| `{colors.ink-muted}` | `#525252` | white theme `textSecondary` (= `gray70`) |
| `{colors.ink-subtle}` | `#6f6f6f` | white theme `textHelper` (= `gray60`) — **not** the `#8c8c8c` this file's prose states literally; see "Flagged discrepancies" below (V5) |
| `{colors.inverse-ink}` | `#ffffff` | white theme `textInverse` |
| `{colors.primary}` | `#0f62fe` | white theme `interactive` / `linkPrimary` / `borderInteractive` / `focus` (all agree) = `@carbon/colors` `blue60` |
| `{colors.on-primary}` | `#ffffff` | white theme `textOnColor` |
| `{colors.blue-60}` | `#0f62fe` | `@carbon/colors` `blue60` — **identical to `{colors.primary}`**; see discrepancy note |
| `{colors.blue-80}` | `#002d9c` | `@carbon/colors` `blue80` |
| `{colors.semantic-success}` | `#24a148` | `@carbon/colors` `green50` (= white theme `supportSuccess`) |
| `{colors.semantic-warning}` | `#f1c21b` | `@carbon/colors` `yellow30` (= white theme `supportWarning`) |
| `{colors.semantic-error}` | `#da1e28` | `@carbon/colors` `red60` (= white theme `supportError`) |
| `{colors.semantic-info}` | `#0043ce` | white theme `supportInfo` = `@carbon/colors` `blue70` — prose claims "identical to primary" (`#0f62fe`); the actual White-theme token is one step darker. See discrepancy note |

Additional values used by the plan's locked decisions (V1/V4), pulled from the same packages and confirmed to match the plan's literal hex codes exactly:

- Chart data-viz series (`--chart-1..5`, V1): `purple70 #6929c4`, `cyan50 #1192e8`, `teal70 #005d5d`, `magenta70 #9f1853`, `red50 #fa4d56` — all from `@carbon/colors`
- Alert/status states (V1): `red60 #da1e28`, `orange40 #ff832b`, `yellow30 #f1c21b`, `green60 #198038` — all from `@carbon/colors`
- Badge pair (V4 example): `green10 #defbe6` / `green70 #0e6027` — from `@carbon/colors.green`

### Typography

| Token | DESIGN.md spec | Carbon source | Match |
|---|---|---|---|
| `{typography.body}` | 16px/400/1.50/0.16px | `@carbon/type` `body02` = `{16px, 400, 1.5, letterSpacing: 0}` | Size/weight/line-height match; **letter-spacing does not** — see discrepancy note |
| `{typography.body-sm}` | 14px/400/1.29/0.16px | `body01` / `bodyCompact01` = `{14px, 400, 1.2857, 0.16px}` | Exact |
| `{typography.body-emphasis}` | 14px/600/1.29/0.16px | `headingCompact01` = `{14px, 600, 1.2857, 0.16px}` | Exact |
| `{typography.caption}` | 12px/400/1.33/0.32px | `caption01` / `label01` = `{12px, 400, 1.3333, 0.32px}` | Exact |
| `{typography.button}` | 14px/400/1.29/0.16px | No dedicated `button` export in `@carbon/type` (Carbon defines button label type in component-level Sass, not shipped in this token package) — value is identical to `body01`/`bodyCompact01` | Same value as `body-sm`, no distinct named token |
| `{typography.eyebrow}` | 14px/400/1.29/0.16px | Same as above — no distinct `eyebrow` export; value matches `body01` | Same value as `body-sm`, no distinct named token |
| `{typography.subhead}` | 20px/400/1.40/0 | `heading03` = `{20px, 400, 1.4, 0}` | Exact |
| `{typography.card-title}` | 24px/400/1.33/0 | No named token at 24px — Carbon's heading scale jumps `heading03` (20px) → `heading04`/`productiveHeading04` (28px). 24px is a valid step in `@carbon/type`'s `scale` array (`[…18,20,24,28…]`) but ships no dedicated semantic style there | No exact named-token match |
| `{typography.headline}` | 32px/400/1.25/0 | `heading05` / `productiveHeading05` = `{32px, 400, 1.25, 0}` | Exact |
| `{typography.body-lg}` | 18px/400/1.50/0 | No named token at 18px — 18 is a valid `scale` step but has no dedicated style export | No exact named-token match |
| `{typography.display-md}` | 42px/300/1.20/0 | `display01` base = `{42px, 300, 1.19, 0}` | Effectively exact (1.19 ≈ 1.20) |
| `{typography.display-lg}` | 60px/300/1.17/-0.4px | `display01` at `xlg` breakpoint = `{60px, 300, 1.17}`, letter-spacing 0 (not -0.4px) | Out of scope for this app per plan §1 ("o que não se aplica") — resolved here only for documentation completeness |
| `{typography.display-xl}` | 76px/300/1.17/-0.5px | `display01` at `max` breakpoint = `{76px, 300, 1.13}`, letter-spacing 0 | Out of scope for this app per plan §1; line-height/letter-spacing don't match exactly even as reference |

Font family and weight source: `@carbon/type` `fontFamilies.sans` = `'IBM Plex Sans', system-ui, -apple-system, BlinkMacSystemFont, '.SFNSText-Regular', sans-serif`; `fontFamilies.mono` = `'IBM Plex Mono', 'Menlo', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', Courier, monospace`; `fontWeights` = `{ light: 300, regular: 400, semibold: 600 }`.

### Spacing

| Token | Value | Carbon source (`@carbon/layout`) |
|---|---|---|
| `{spacing.xxs}` | 4px | `spacing02` (0.25rem) |
| `{spacing.xs}` | 8px | `spacing03` (0.5rem) |
| `{spacing.sm}` | 12px | `spacing04` (0.75rem) |
| `{spacing.md}` | 16px | `spacing05` (1rem) |
| `{spacing.lg}` | 24px | `spacing06` (1.5rem) |
| `{spacing.xl}` | 32px | `spacing07` (2rem) |
| `{spacing.xxl}` | 48px | `spacing09` (3rem) — `spacing08` (40px/2.5rem) exists in the package but isn't part of this file's named scale |
| `{spacing.section}` | 96px | `spacing12` (6rem) |

All eight match the package exactly.

### Border radius

| Token | Value | Carbon source |
|---|---|---|
| `{rounded.none}` | 0px | Not a package export — Carbon's flat-geometry convention is a design rule ("every corner is square"), not a shipped token. No package value needed |
| `{rounded.xs}` / `{rounded.sm}` / `{rounded.md}` / `{rounded.lg}` / `{rounded.pill}` | 2 / 4 / 6 / 8 / 9999px | **Not found in any of the four installed packages.** `@carbon/colors`, `@carbon/themes`, `@carbon/type`, and `@carbon/layout` export no radius/border-radius token at all (grepped all four for `radius`/`round`: zero matches). These five values are conventional (4px-grid-aligned) placeholders, not Carbon-sourced — flagged here rather than presented as verified |

### Flagged discrepancies (do not silently resolve)

- **`{colors.inverse-canvas}`**: the prose in `## Overview` (line 16) and `## Colors` (line 37) states this is "charcoal #161616." The actual Carbon White-theme token for an inverted surface *within* a light theme is `backgroundInverse = #393939` (`gray80`), not `gray100`. `#161616` is Carbon's Gray 100 *theme background* — a separate, unextracted theme (see this file's own "Known Gaps"), not the White theme's inverse-surface token. **Not used by this app** — V3 keeps the sidebar light and no footer is being built, so this token has no call site in Etapas 0–1.
- **`{colors.inverse-surface-1}`**: closest match is `backgroundInverseHover = #474747`; there is no token literally named "one step lighter than inverse-canvas." Also unused in this app for the same reason as above.
- **`{colors.inverse-ink-muted}`**: no corresponding token exists in the White theme object at all (checked every `*Inverse*` key it exports). Unresolved. Also unused in this app.
- **`{colors.blue-60}`**: the prose (line 27) describes it as "hovered link state," but in Carbon's actual 10–100 color scale, `blue-60` **is** `#0f62fe` — the same value as `{colors.primary}`. The real hover-link value is `linkPrimaryHover` in the White theme, which resolves to `blue-70 #0043ce`. Treat the prose label as a naming error in this file, not as a second color.
- **`{colors.blue-hover}`** (line 29, "hover state for primary buttons"): **unresolved**. Carbon's historically documented hover-primary value only exists as a v10 SCSS/type-declaration artifact (`@carbon/themes/lib/v10/*.d.ts` ships the type but the v11 package installed here — 11.77.0 — has no runtime JS export for it; it would require `@carbon/styles` Sass, which is deliberately not installed per this refactor's architecture decision in the plan §0). Do not invent a value for this token; where a hover state is needed, use the resolved `blue-70 #0043ce` instead.
- **`{colors.semantic-info}`**: prose (line 51) says "identical to primary." The White theme's actual `supportInfo` token is `#0043ce` (`blue-70`), one step darker than primary — Carbon deliberately keeps passive "info" status visually distinct from interactive blue.
- **`{typography.body}` letter-spacing**: this file specifies 0.16px at 16px body (lines 72, 228, and repeated in Do's/Don'ts). Carbon's own 16px token (`body02`/`bodyLong02`) ships with `letter-spacing: 0`. The 0.16px positive-tracking value is real Carbon data, but it belongs to the **14px** tokens (`body01`, `bodyCompact01`, `label02`), not 16px. This file generalizes a 14px detail onto 16px body text. Etapa 1's instructions explicitly lock `letter-spacing: 0.16px` on the body regardless — implemented as instructed, flagged here for the record.

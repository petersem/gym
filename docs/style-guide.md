# Gym App — Frontend Style Guide

Source of truth: [backend/src/public/css/style.css](../backend/src/public/css/style.css)
(Tailwind + DaisyUI source, compiled to `backend/src/dist/css/tailwind.css`, which is the
file actually linked from [partials/head.ejs](../backend/src/views/partials/head.ejs)).

> **Important:** Edits to `style.css` are not visible in the browser until the compiled
> file is regenerated. Run `npm run build:css` (in `backend/`) after every CSS change, or
> run `npm run tailwind` in a separate terminal to watch and rebuild automatically.
> `npm run dev` only rebuilds CSS once, at startup.

---

## 1. Tooling

- **Tailwind CSS v4** — imported with `@import "tailwindcss";` at the top of `style.css`.
  No `tailwind.config.js`; theming is done via the CSS-first `@theme` / `@plugin` syntax.
- **DaisyUI** — loaded via `@plugin "daisyui" { themes: light --default, dark; }`, with two
  custom themes (`light`, `dark`) defined immediately after using `@plugin "daisyui/theme"`.
- Almost all page layout is done with **hand-written custom classes** (BEM-ish, not
  utility classes). Tailwind utility classes and DaisyUI component classes are used
  sparingly, mostly for buttons, cards, badges, and the nav bar.

---

## 2. Design tokens

Custom CSS variables (not DaisyUI tokens) drive most of the visual design. Defined on
`:root` for light mode and overridden on `:root[data-theme="dark"]` for dark mode:

| Variable | Light hex | Dark hex | Purpose |
|---|---|---|---|
| `--gym-ink` | `#17231d` | `#eaf2ec` | Primary text colour |
| `--gym-forest` | `#1d4a38` | `#286247` | Primary brand green (buttons, links, accents) |
| `--gym-citron` | `#d3ee78` | `#d5f078` | Secondary accent (brand mark, headings, highlights) |
| `--gym-coral` | `#d96e4c` | `#f09576` | Accent/hover colour (errors, hover states, sort-link hover) |
| `--gym-muted` | `#65736b` | `#afbeb4` | Secondary/label text |
| `--gym-line` | `#dfe7e0` | `#33473a` | Border colour |
| `--gym-paper` | `#f3f6f2` | `#101713` | Page background |
| `--gym-surface` | `#ffffff` | `#1a2620` | Card/table/form background |
| `--gym-control-border` | `#cbd6cd` | `#465b4c` | Input/select/textarea border |
| `--gym-link` | `#1d4a38` | `#a1d5b0` | Anchor colour |
| `--gym-nav-bg` | `#17231d` | `#09110d` | Nav bar background |
| `--gym-button-hover` | `#17231d` | `#334e3f` | Hover colour for buttons |
| `--gym-gridline` | `rgba(29,74,56,0.025)` | `rgba(224,243,228,0.035)` | Repeating vertical gridlines on `<body>` background |
| `--gym-glow` | `rgba(255,255,255,0.75)` | `rgba(224,243,228,0.03)` | Top-of-page gradient glow on `<body>` background |
| `--gym-shadow` | `rgba(23,35,29,0.055)` | `rgba(0,0,0,0.22)` | Box-shadow colour (cards, nav, forms) |

Fixed colours that don't change between themes: pure white `#ffffff` (button text),
delete-button red `#b84f45` / `#d66d62` (light/dark, matches `--color-error`), and the
focus-ring colour `rgba(217, 110, 76, 0.45)` used on every focusable control.

Theme switching is handled by a small inline script in `head.ejs` that reads
`localStorage["gym-theme"]` (or the OS preference) and sets `data-theme` on `<html>`
before first paint (avoids flash of wrong theme). The toggle itself is a DaisyUI
`toggle toggle-sm` checkbox in `partials/header.ejs`.

### DaisyUI theme colours

Configured via two `@plugin "daisyui/theme"` blocks (`name: "light"` / `name: "dark"`) —
these back the few DaisyUI component classes in use (`card`, `badge`, `alert`, `btn`,
`bg-base-100`). They intentionally mirror the `--gym-*` palette above:

| DaisyUI variable | Light hex | Dark hex |
|---|---|---|
| `--color-base-100` | `#ffffff` | `#1a2620` |
| `--color-base-200` | `#f3f6f2` | `#101713` |
| `--color-base-300` | `#dfe7e0` | `#33473a` |
| `--color-base-content` | `#17231d` | `#eaf2ec` |
| `--color-primary` | `#1d4a38` | `#286247` |
| `--color-primary-content` | `#f5f9f3` | `#ffffff` |
| `--color-secondary` | `#d3ee78` | `#d5f078` |
| `--color-secondary-content` | `#1b281f` | `#17231d` |
| `--color-accent` | `#d96e4c` | `#f09576` |
| `--color-accent-content` | `#ffffff` | `#17231d` |
| `--color-neutral` | `#17231d` | `#263b30` |
| `--color-neutral-content` | `#f4f7f3` | `#eaf2ec` |
| `--color-info` | `#327a78` | `#4c9e9a` |
| `--color-success` | `#4a7853` | `#5b9566` |
| `--color-warning` | `#e4b752` | `#e4bd61` |
| `--color-error` | `#b84f45` | `#d66d62` |
| `--radius-selector` / `--radius-field` | `0.25rem` | (same both themes) |
| `--radius-box` | `0.35rem` | (same both themes) |

**Note:** the custom `button`/`.btn`/`input`/`select` rules further down `style.css`
override DaisyUI's own button/card colouring with the `--gym-*` tokens, so on-screen
colours match the table in §2, not the raw DaisyUI palette, even on elements carrying a
DaisyUI class.

### Typography

- Fonts are loaded from Google Fonts in `partials/head.ejs`:
  `family=Barlow+Condensed:wght@500;600;700&family=DM+Sans:wght@400;500;600;700`
  (only weights 500/600/700 for Barlow Condensed and 400/500/600/700 for DM Sans are
  fetched — don't use other weights, they won't be loaded).
- Body font: `"DM Sans", sans-serif` — declared via Tailwind's `@theme { --font-sans: ... }`
  and again explicitly on `html`/`body` (belt-and-braces, both point at the same font).
- Display/heading font: `"Barlow Condensed", sans-serif` (`--font-display` in `@theme`),
  applied directly (not through a Tailwind utility) to `h2`, `h3`, and `.brand-copy strong`
  — bold (700), uppercase, condensed letterforms.
- `section h2` has a decorative `::before` bar in `--gym-citron` to the left of the heading.
- Small uppercase "eyebrow" text (`.brand-copy small`, `.site-kicker`, `.eyebrow`) uses
  `--gym-muted`, 11px, weight 700, uppercase — reuse the `.eyebrow` class for any new
  small-caps label text.

---

## 3. DaisyUI & Tailwind — exact usage

Only a handful of DaisyUI/Tailwind classes are used in the codebase — nearly all page
layout is hand-written custom CSS (see §4). Below is every occurrence, verbatim, with the
full `class="..."` attribute as written in the source.

| Class(es) | File : line | Exact markup |
|---|---|---|
| `btn`, `btn-primary` | [dashboard.ejs:26](../backend/src/views/dashboard.ejs#L26) | `<a class="btn btn-primary" href="/authenticate/logout">Log out</a>` |
| `btn`, `btn-primary` | [dashboard.ejs:28](../backend/src/views/dashboard.ejs#L28) | `<a class="btn btn-primary" href="/authenticate">Log in</a>` |
| `btn`, `btn-secondary` | [dashboard.ejs:29](../backend/src/views/dashboard.ejs#L29) | `<a class="btn btn-secondary" href="/authenticate/register">Register</a>` |
| `btn`, `btn-outline` | [dashboard.ejs:31](../backend/src/views/dashboard.ejs#L31) | `<a class="btn btn-outline" href="/api-docs">API documentation</a>` |
| `btn`, `btn-outline` | [location_list.ejs:44](../backend/src/views/location_list.ejs#L44) | `<a class="btn btn-outline" href="/locations/<%= location.id %>">View location</a>` |
| `btn`, `btn-primary` | [booking_management.ejs:57](../backend/src/views/booking_management.ejs#L57) | `<button class="btn btn-primary session-book-button" type="submit" name="action" value="create" hidden>Book</button>` |
| `card`, `bg-base-100`, `shadow-sm` | [location_list.ejs:37](../backend/src/views/location_list.ejs#L37) | `<article class="card-tile card bg-base-100 shadow-sm">` |
| `card`, `bg-base-100` | [booking_management.ejs:38](../backend/src/views/booking_management.ejs#L38) / [:97](../backend/src/views/booking_management.ejs#L97) | `<article class="session-day card bg-base-100">` |
| `badge`, `badge-neutral` | [partials/header.ejs:18](../backend/src/views/partials/header.ejs#L18) | `class="badge badge-neutral authenticated-user role-badge role-<%= authenticatedUser.role %>"` |
| `navbar` | [partials/nav.ejs:1](../backend/src/views/partials/nav.ejs#L1) | `<nav class="navbar site-nav" aria-label="Primary navigation">` |
| `menu`, `menu-horizontal` | [partials/nav.ejs:2](../backend/src/views/partials/nav.ejs#L2) | `<ul class="menu menu-horizontal site-menu">` |
| `alert`, `alert-success` | [booking_management.ejs:21](../backend/src/views/booking_management.ejs#L21) | `<div class="alert alert-success" role="status">Booking deleted.</div>` |
| `toggle`, `toggle-sm` | [partials/header.ejs:13](../backend/src/views/partials/header.ejs#L13) | `<input class="toggle toggle-sm" id="theme-toggle" type="checkbox" aria-label="Use dark theme">` |

That's the complete list — no other DaisyUI or raw Tailwind utility classes (`flex`,
`grid`, `p-*`, `text-*`, `rounded-*`, etc.) appear anywhere in the views. Every other class
you'll see (`form-grid`, `list-search`, `card-tile`, `session-day`, etc.) is custom CSS
defined in `style.css`, described in §4.

**Pattern to follow:** a DaisyUI class is always combined with one or more custom classes
on the same element (`card-tile card bg-base-100 shadow-sm`, `session-day card bg-base-100`,
`badge badge-neutral authenticated-user role-badge role-admin`). Never rely on DaisyUI's
default colours alone — the custom class supplies the actual `--gym-*` colour/spacing
overrides. When adding a new DaisyUI element, follow the same pairing convention.

---

## 4. Shared custom classes ("common things")

### Buttons & links
- `button`, `input[type="submit"]`, `.link-button`, `.btn` all share one base style
  (forest-green filled button). `button[type="button"]` renders as a neutral/outline
  button. `button[value="delete"]` is red. `.btn-outline` / `.link-button.btn-outline`
  render as outline/ghost buttons.

### Forms
- `.form-grid` — 2-column label/field grid (label ~130px, field flexible), used for every
  create/edit form. Add `.responsive-half` to cap form width at 760px. Wrap in
  `form.form-grid` to also get card-like padding/border/shadow (the CRUD forms on
  Activities/Blog/Bookings/Locations/Sessions/Users pages all do this).
- `.two-col` — inside a `.form-grid`, makes an element span both columns (e.g. read-only
  "Updated by" text).
- `.margin-auto` — centers a `.responsive-half` block (used on login/register).
- `.search-form` — a 3-column grid (label / input / button) for simple GET search forms
  with **only** a search box (currently only [location_list.ejs](../backend/src/views/location_list.ejs)
  uses it standalone with a sort `<select>` bolted on — see note below).

### List/search/sort pattern (Activities, Locations, Users management pages)
These three pages share one pattern, deliberately kept **separate** from the Sessions
page's classes (see note below) so the two can evolve independently:
- `.list-search` + `.list-search-control` — label + `<input type="search">` + button,
  wired to a small inline `<script>` that reads/writes `window.location.search` and
  reloads the page (all filtering/sorting happens server-side, not in the browser).
- `.list-results` (wrapper, adds horizontal scroll on narrow screens) and
  `.list-results-table` — the results table.
- `.sort-link` — an `<a>` in a `<th>` that toggles `sort_by`/`sort_dir` query params.
  Direction arrow is a CSS `::after` pseudo-element driven by the `aria-sort` attribute
  on the parent `<th>` (`ascending`/`descending`/`none`), **not** a JS-toggled class.

**Sessions page note:** [session_management.ejs](../backend/src/views/session_management.ejs)
uses the **exact same visual pattern** but its own classes: `.session-name-search`,
`.session-search-control`, `.session-results`, `.session-results-table`,
`.session-sort-button`. This duplication is intentional — the Sessions page was
explicitly called out as the reference layout and its classes must not be touched
when styling other pages. If you need to change the shared look, update both the
`.session-*` rules and the `.list-*` rules.

### Cards / lists
- `.card-list` — responsive card grid (`auto-fit`, min 230px) used for the public
  locations list.
- `.card-tile` — a bordered/shadowed card, also reused (bare, without `.card-list`)
  for blog post entries.
- `.data-list` — label/value grid for read-only detail pages (location details).
- `.dashboard-links` — flex row of buttons on the dashboard.

### Booking calendar
- `.session-calendar` — 7-column grid (one per day), scrollable on overflow.
- `.session-day` — a single day's card (DaisyUI `card bg-base-100` + custom border/shadow).
- `.available-session*` / `.session-book-*` — session list items and the "Book" button
  inside a calendar day cell.

### Layout shells
- `.site-header`, `.brand`, `.brand-mark`, `.brand-copy`, `.site-kicker`, `.user-controls`,
  `.theme-toggle-control` — top header bar (logo, tagline, theme toggle, role badge).
- `.site-nav` / `.site-menu` — primary nav (DaisyUI `navbar`/`menu`, recoloured dark).
- `.site-footer` — bottom footer, space-between flex row.
- `main > section` — every page section gets consistent bottom margin/padding and a
  bottom divider line; `section h2` gets the citron accent bar automatically.

### Role badge colours

The logged-in user's name badge in the header (`.badge.badge-neutral.authenticated-user.role-badge.role-<%= authenticatedUser.role %>`
in [partials/header.ejs:18](../backend/src/views/partials/header.ejs#L18)) is colour-coded by
role, set in `style.css`:

| Role | Border/background | Text colour |
|---|---|---|
| `role-admin` | `--gym-coral` (`#d96e4c` light / `#f09576` dark) | `#ffffff` |
| `role-trainer` | `--gym-forest` (`#1d4a38` light / `#286247` dark) — **overridden to `#a1d5b0` in dark mode** for contrast | `#ffffff` |
| `role-member` | `--gym-citron` (`#d3ee78` light / `#d5f078` dark) | `var(--gym-ink)` (adapts automatically per theme) |

The dark-theme override for `role-trainer` (`:root[data-theme="dark"] .role-badge.role-trainer`)
is the only role whose border/background doesn't just follow its token automatically —
`--gym-forest` gets too dark against the dark nav/header background, so a lighter green is
hardcoded for that combination only. Follow this pattern (token first, hardcoded dark
override only if needed for contrast) if you add a new role.

### Responsive behaviour
One breakpoint only: `@media screen and (max-width: 760px)`. Below 760px: forms drop to
a single column, results tables get a `min-width` and scroll horizontally, the header
wraps, and multi-column layouts (`.checkout-layout`, `.half-half-layout`,
`.session-calendar`) collapse to one column.

---

## 5. Page-by-page reference

| Page | File | Key classes/components |
|---|---|---|
| Dashboard | [dashboard.ejs](../backend/src/views/dashboard.ejs) | `.dashboard-intro`, `.dashboard-links`, `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-outline` |
| Login | [login.ejs](../backend/src/views/login.ejs) | `.form-grid.responsive-half.margin-auto`, `.link-button` |
| Register | [register.ejs](../backend/src/views/register.ejs) | Same as login |
| Status/error page | [status.ejs](../backend/src/views/status.ejs) | `.link-button` only |
| Activities | [activity_management.ejs](../backend/src/views/activity_management.ejs) | `.list-search(-control)`, `.list-results(-table)`, `.sort-link`, `.form-grid.responsive-half` |
| Locations (admin) | [location_management.ejs](../backend/src/views/location_management.ejs) | Same `.list-*` pattern as Activities, `.two-col` |
| Locations (public list) | [location_list.ejs](../backend/src/views/location_list.ejs) | `.search-form`, `.card-list`, `.card-tile card bg-base-100 shadow-sm`, `.btn-outline` |
| Location details | [location_details.ejs](../backend/src/views/location_details.ejs) | `.data-list`, `.data-list-heading` |
| Sessions | [session_management.ejs](../backend/src/views/session_management.ejs) | `.session-filter-controls` (`.form-grid.responsive-half`), `.session-name-search(-control)`, `.session-results(-table)`, `.session-sort-button` — **do not rename, see §4** |
| Bookings | [booking_management.ejs](../backend/src/views/booking_management.ejs) | `.alert.alert-success`, `.session-calendar`, `.session-day card bg-base-100`, `.available-session*`, `.btn.btn-primary` |
| Blog | [blog_management.ejs](../backend/src/views/blog_management.ejs) | `.search-form`, `.card-tile`, `.two-col`, `.form-grid.responsive-half` |
| Users | [user_management.ejs](../backend/src/views/user_management.ejs) | Same `.list-*` pattern as Activities |
| Header/Nav/Footer partials | [partials/](../backend/src/views/partials/) | `.site-header`, `navbar`/`menu` (DaisyUI), `badge`/`badge-neutral` + `.role-badge.role-*`, `toggle.toggle-sm`, `.site-footer` |

---

## 6. Conventions to follow for new pages

1. **Search/sort/filter is always server-side.** Build a GET form or plain links that set
   query params (`search_term`, `sort_by`, `sort_dir`, etc.) and let the controller do the
   filtering/sorting — never filter or sort with client-side JavaScript.
2. **Reuse `.list-*` classes** for any new admin list+search+sort page, unless it's the
   Sessions page (keep `.session-*` classes there).
3. **Reuse `.form-grid.responsive-half`** for any new create/edit form; wrap it in
   `<form class="form-grid responsive-half">` for the card treatment.
4. **Use DaisyUI sparingly** — only for `btn`, `card`, `badge`, `alert`, `navbar`/`menu`,
   `toggle`, and only alongside a custom class if you need non-default colours/spacing.
5. **Always rebuild CSS** (`npm run build:css` or `npm run tailwind --watch`) after editing
   `style.css` — the browser never reads that file directly.

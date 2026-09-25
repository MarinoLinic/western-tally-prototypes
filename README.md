# Western Tally — Prototype Library

A zero-dependency static viewer for the 89 desktop screenshots captured across
15 Western Tally prototype directions (ports 5000–5014). It exists to make the
archive browsable: every prototype, page, and theme is one click or keystroke
away, with no build step and no install.

## Features

- Browse 15 prototypes with previous / next buttons, a native `<select>`, or
  arrow keys.
- Per-prototype page switching: Home, Map, Entry — plus **Full map** on p07.
- Light / dark theme switching. Theme is a *preference*: prototypes without a
  dark capture (p08) temporarily show light while the dark preference is kept.
- Fit vs. 100% zoom; a checkered neutral canvas; one `<img>` element only.
- Deep-linkable state (`?prototype=&page=&theme=&zoom=`) plus `localStorage`
  restore; `Open original` always points at the displayed capture.
- Accessible: labelled controls, `aria-pressed` segmented buttons, disabled
  states, visible focus, `aria-live` status, `prefers-reduced-motion` support.
- Responsive below 820 px — the viewer itself works on a phone even though
  mobile captures are not in the archive yet.

## Architecture

```
western-tally-prototypes/
├── index.html        markup: sticky header + control deck, meta strip, canvas, footer
├── styles.css        tokens + editorial-utility styling, responsive, reduced-motion
├── catalog.js        window.PROTOTYPE_CATALOG — readable literal, one object per prototype
├── app.js            classic-script viewer logic (state, rendering, keys, prefetch)
├── serve.py          stdlib-only ThreadingHTTPServer on 127.0.0.1:4173
├── README.md         this file
└── screenshots/      89 renamed PNG captures (image bytes unchanged)
```

**Why dependency-free:** the entire app is ~600 lines of hand-written HTML/CSS/
JS served as static files. There is nothing to install, compile, or bundle —
`catalog.js` + `app.js` are classic scripts (not ES modules), so `index.html`
works even when opened directly from disk (`file://`), and `serve.py` adds
correct caching headers and a stable URL when a server is wanted.

## Running it

```bat
py serve.py             :: serve on http://127.0.0.1:4173/ and open the browser
py serve.py 8080        :: choose a different port
py serve.py --no-open   :: serve without opening a browser
```

`python serve.py` works too. Any static server works, but `serve.py` adds the
cache policy the archive is designed around (see *Implementation notes*).

**Direct-open fallback:** double-click `index.html`. Everything works from
`file://` except that query-param/localStorage persistence may be skipped in
browsers that restrict those APIs for local files — the viewer degrades
gracefully.

### Controls and shortcuts

| Control / key                    | Action                                  |
| -------------------------------- | --------------------------------------- |
| `‹ Prev` / `Next ›`              | previous / next prototype (wraps 0–14)  |
| prototype select                 | jump to any prototype                   |
| Page: Home · Map · Entry · Full map | switch page (unavailable pages are disabled) |
| Theme: Light · Dark              | set preferred theme                     |
| Viewport: Desktop · Mobile       | Mobile is disabled — awaiting captures  |
| Zoom: Fit · 100%                 | fit-to-width vs. natural size           |
| `Open original`                  | open the displayed PNG in a new tab     |
| `↑` / `↓`                        | previous / next prototype               |
| `←` / `→`                        | previous / next available page          |
| `T`                              | toggle preferred theme                  |
| `Z`                              | toggle Fit / 100%                       |
| `O`                              | open original                           |

## Catalog

`catalog.js` defines `window.PROTOTYPE_CATALOG`, an array in numeric order.
Each entry: `id`, `number`, `label`, `direction`, `source`, and
`captures.desktop` keyed by page → theme → path.

| ID  | #  | Label                     | Direction                | Source             |
| --- | -- | ------------------------- | ------------------------ | ------------------ |
| p00 | 0  | Baseline                  | Current site             | current design     |
| p01 | 1  | Prototype 1               | The Tracker              | original direction |
| p02 | 2  | Prototype 2               | The Terminal             | original direction |
| p03 | 3  | Prototype 3               | The Register             | original direction |
| p04 | 4  | Prototype 4               | The Console              | original direction |
| p05 | 5  | Prototype 5               | The Placard              | original direction |
| p06 | 6  | Prototype 6               | The Atlas                | original direction |
| p07 | 7  | ADL.org                   | The Monitor              | adl.org            |
| p08 | 8  | Compact Magazine          | The Magazine of Record   | compactmag.com     |
| p09 | 9  | HOPE not hate             | The Campaign Poster      | hopenothate.org.uk |
| p10 | 10 | OVD-Info                  | The Monitoring Project   | ovd.info           |
| p11 | 11 | Parsec                    | The Product              | parsec.app         |
| p12 | 12 | Southern Poverty Law Center | The Campaign Report    | splcenter.org      |
| p13 | 13 | T3 Chat                   | The App Shell            | t3.chat            |
| p14 | 14 | Yusuke Sugomori           | The Instrument           | yusugomori.com     |

## Capture ordering assumptions

Original filenames look like
`screencapture-127-0-0-1-PORT[-path]-YYYY-MM-DD-HH_MM_SS.png`. The words in the
optional path segment (`add`, `events`, `map`) were **not** trusted — ordering
within each port is purely chronological by the embedded timestamp.

Within each port the sorted captures were assigned this sequence:

- **All prototypes except p07 and p08** (6 captures):
  `home-light, home-dark, map-light, map-dark, entry-light, entry-dark`
- **p07 — ADL.org** (8 captures): the same six, then
  `map-full-light, map-full-dark` (its two `/map` captures were taken last).
- **p08 — Compact Magazine** (3 captures, light only):
  `home-light, map-light, entry-light`. There are no dark captures; the viewer
  falls back to light while preserving a dark *preference*.

Notable consequence: for p14 the second-oldest capture is an `events` URL —
it is still `home-dark`, because timestamp position, not the URL word, is
authoritative.

## Filename grammar

```
SLUG-desktop-NN-PAGE-THEME.png
```

| Token      | Meaning                                                          |
| ---------- | ---------------------------------------------------------------- |
| `SLUG`     | prototype slug, e.g. `p07-adl-org`, `p12-splcenter-org`          |
| `desktop`  | viewport — `mobile` reserved for a future batch                  |
| `NN`       | page number: `01` home, `02` map, `03` entry, `04` map-full      |
| `PAGE`     | page name: `home`, `map`, `entry`, `map-full`                    |
| `THEME`    | `light` or `dark`                                                |

Examples: `p02-terminal-desktop-01-home-light.png`,
`p07-adl-org-desktop-04-map-full-dark.png`.

All renames were done with `git mv`; no image data was modified, deleted, or
recompressed.

## Renaming manifest (89 files)

| Original filename | New filename |
| ----------------- | ------------ |
| screencapture-127-0-0-1-5000-2026-09-23-20_42_03.png | screenshots/p00-baseline-desktop-01-home-light.png |
| screencapture-127-0-0-1-5000-2026-09-23-20_42_08.png | screenshots/p00-baseline-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5000-2026-09-23-20_42_15.png | screenshots/p00-baseline-desktop-02-map-light.png |
| screencapture-127-0-0-1-5000-2026-09-23-20_42_20.png | screenshots/p00-baseline-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5000-add-2026-09-23-20_43_00.png | screenshots/p00-baseline-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5000-add-2026-09-23-20_43_05.png | screenshots/p00-baseline-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5001-2026-09-23-20_43_26.png | screenshots/p01-tracker-desktop-01-home-light.png |
| screencapture-127-0-0-1-5001-2026-09-23-20_43_32.png | screenshots/p01-tracker-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5001-2026-09-23-20_43_40.png | screenshots/p01-tracker-desktop-02-map-light.png |
| screencapture-127-0-0-1-5001-2026-09-23-20_43_44.png | screenshots/p01-tracker-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5001-add-2026-09-23-20_43_55.png | screenshots/p01-tracker-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5001-add-2026-09-23-20_44_00.png | screenshots/p01-tracker-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5002-2026-09-23-20_44_18.png | screenshots/p02-terminal-desktop-01-home-light.png |
| screencapture-127-0-0-1-5002-2026-09-23-20_44_22.png | screenshots/p02-terminal-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5002-2026-09-23-20_44_27.png | screenshots/p02-terminal-desktop-02-map-light.png |
| screencapture-127-0-0-1-5002-2026-09-23-20_44_31.png | screenshots/p02-terminal-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5002-add-2026-09-23-20_44_41.png | screenshots/p02-terminal-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5002-add-2026-09-23-20_44_47.png | screenshots/p02-terminal-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5003-2026-09-23-20_45_04.png | screenshots/p03-register-desktop-01-home-light.png |
| screencapture-127-0-0-1-5003-2026-09-23-20_45_14.png | screenshots/p03-register-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5003-2026-09-23-20_45_22.png | screenshots/p03-register-desktop-02-map-light.png |
| screencapture-127-0-0-1-5003-2026-09-23-20_45_27.png | screenshots/p03-register-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5003-add-2026-09-23-20_45_34.png | screenshots/p03-register-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5003-add-2026-09-23-20_45_39.png | screenshots/p03-register-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5004-2026-09-23-20_45_58.png | screenshots/p04-console-desktop-01-home-light.png |
| screencapture-127-0-0-1-5004-2026-09-23-20_46_09.png | screenshots/p04-console-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5004-2026-09-23-20_46_17.png | screenshots/p04-console-desktop-02-map-light.png |
| screencapture-127-0-0-1-5004-2026-09-23-20_46_22.png | screenshots/p04-console-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5004-add-2026-09-23-20_46_28.png | screenshots/p04-console-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5004-add-2026-09-23-20_46_34.png | screenshots/p04-console-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5005-2026-09-23-20_47_29.png | screenshots/p05-placard-desktop-01-home-light.png |
| screencapture-127-0-0-1-5005-2026-09-23-20_47_36.png | screenshots/p05-placard-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5005-2026-09-23-20_47_43.png | screenshots/p05-placard-desktop-02-map-light.png |
| screencapture-127-0-0-1-5005-2026-09-23-20_47_47.png | screenshots/p05-placard-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5005-add-2026-09-23-20_47_54.png | screenshots/p05-placard-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5005-add-2026-09-23-20_47_58.png | screenshots/p05-placard-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5006-2026-09-23-20_48_12.png | screenshots/p06-atlas-desktop-01-home-light.png |
| screencapture-127-0-0-1-5006-2026-09-23-20_48_18.png | screenshots/p06-atlas-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5006-2026-09-23-20_48_27.png | screenshots/p06-atlas-desktop-02-map-light.png |
| screencapture-127-0-0-1-5006-2026-09-23-20_48_32.png | screenshots/p06-atlas-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5006-add-2026-09-23-20_48_41.png | screenshots/p06-atlas-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5006-add-2026-09-23-20_48_45.png | screenshots/p06-atlas-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5007-2026-09-23-20_49_36.png | screenshots/p07-adl-org-desktop-01-home-light.png |
| screencapture-127-0-0-1-5007-2026-09-23-20_49_42.png | screenshots/p07-adl-org-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5007-events-2026-09-23-20_50_02.png | screenshots/p07-adl-org-desktop-02-map-light.png |
| screencapture-127-0-0-1-5007-events-2026-09-23-20_50_08.png | screenshots/p07-adl-org-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5007-add-2026-09-23-20_50_17.png | screenshots/p07-adl-org-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5007-add-2026-09-23-20_50_21.png | screenshots/p07-adl-org-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5007-map-2026-09-23-20_50_27.png | screenshots/p07-adl-org-desktop-04-map-full-light.png |
| screencapture-127-0-0-1-5007-map-2026-09-23-20_50_31.png | screenshots/p07-adl-org-desktop-04-map-full-dark.png |
| screencapture-127-0-0-1-5008-2026-09-23-20_51_08.png | screenshots/p08-compactmag-com-desktop-01-home-light.png |
| screencapture-127-0-0-1-5008-events-2026-09-23-20_51_44.png | screenshots/p08-compactmag-com-desktop-02-map-light.png |
| screencapture-127-0-0-1-5008-add-2026-09-23-20_52_09.png | screenshots/p08-compactmag-com-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5009-2026-09-23-20_52_25.png | screenshots/p09-hopenothate-org-uk-desktop-01-home-light.png |
| screencapture-127-0-0-1-5009-2026-09-23-20_52_40.png | screenshots/p09-hopenothate-org-uk-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5009-map-2026-09-23-20_52_48.png | screenshots/p09-hopenothate-org-uk-desktop-02-map-light.png |
| screencapture-127-0-0-1-5009-map-2026-09-23-20_52_56.png | screenshots/p09-hopenothate-org-uk-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5009-add-2026-09-23-20_53_08.png | screenshots/p09-hopenothate-org-uk-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5009-add-2026-09-23-20_53_14.png | screenshots/p09-hopenothate-org-uk-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5010-2026-09-23-20_54_45.png | screenshots/p10-ovd-info-desktop-01-home-light.png |
| screencapture-127-0-0-1-5010-2026-09-23-20_54_51.png | screenshots/p10-ovd-info-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5010-map-2026-09-23-20_54_59.png | screenshots/p10-ovd-info-desktop-02-map-light.png |
| screencapture-127-0-0-1-5010-map-2026-09-23-20_55_04.png | screenshots/p10-ovd-info-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5010-add-2026-09-23-20_55_10.png | screenshots/p10-ovd-info-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5010-add-2026-09-23-20_55_14.png | screenshots/p10-ovd-info-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5011-2026-09-23-20_55_39.png | screenshots/p11-parsec-app-desktop-01-home-light.png |
| screencapture-127-0-0-1-5011-2026-09-23-20_55_46.png | screenshots/p11-parsec-app-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5011-map-2026-09-23-20_55_56.png | screenshots/p11-parsec-app-desktop-02-map-light.png |
| screencapture-127-0-0-1-5011-map-2026-09-23-20_56_00.png | screenshots/p11-parsec-app-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5011-add-2026-09-23-20_56_17.png | screenshots/p11-parsec-app-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5011-add-2026-09-23-20_56_22.png | screenshots/p11-parsec-app-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5012-2026-09-23-20_57_13.png | screenshots/p12-splcenter-org-desktop-01-home-light.png |
| screencapture-127-0-0-1-5012-2026-09-23-20_57_19.png | screenshots/p12-splcenter-org-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5012-map-2026-09-23-20_57_26.png | screenshots/p12-splcenter-org-desktop-02-map-light.png |
| screencapture-127-0-0-1-5012-map-2026-09-23-20_57_44.png | screenshots/p12-splcenter-org-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5012-add-2026-09-23-20_58_00.png | screenshots/p12-splcenter-org-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5012-add-2026-09-23-20_58_05.png | screenshots/p12-splcenter-org-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5013-2026-09-23-20_58_45.png | screenshots/p13-t3-chat-desktop-01-home-light.png |
| screencapture-127-0-0-1-5013-2026-09-23-20_58_50.png | screenshots/p13-t3-chat-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5013-map-2026-09-23-20_58_57.png | screenshots/p13-t3-chat-desktop-02-map-light.png |
| screencapture-127-0-0-1-5013-map-2026-09-23-20_59_01.png | screenshots/p13-t3-chat-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5013-add-2026-09-23-20_59_06.png | screenshots/p13-t3-chat-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5013-add-2026-09-23-20_59_11.png | screenshots/p13-t3-chat-desktop-03-entry-dark.png |
| screencapture-127-0-0-1-5014-2026-09-23-20_59_51.png | screenshots/p14-yusugomori-com-desktop-01-home-light.png |
| screencapture-127-0-0-1-5014-events-2026-09-23-21_00_21.png | screenshots/p14-yusugomori-com-desktop-01-home-dark.png |
| screencapture-127-0-0-1-5014-events-2026-09-23-21_00_27.png | screenshots/p14-yusugomori-com-desktop-02-map-light.png |
| screencapture-127-0-0-1-5014-events-2026-09-23-21_00_33.png | screenshots/p14-yusugomori-com-desktop-02-map-dark.png |
| screencapture-127-0-0-1-5014-add-2026-09-23-21_00_40.png | screenshots/p14-yusugomori-com-desktop-03-entry-light.png |
| screencapture-127-0-0-1-5014-add-2026-09-23-21_00_45.png | screenshots/p14-yusugomori-com-desktop-03-entry-dark.png |

## Adding a new capture batch (repeatable workflow)

For a future desktop or mobile batch:

1. **Capture** each prototype in the canonical order —
   `home-light, home-dark, map-light, map-dark, entry-light, entry-dark`
   (plus `map-full` pairs where the direction has one) — without changing the
   capture tool's timestamped filenames.
2. **Copy** the raw PNGs into the repo untouched; never recompress.
3. **Rename** with the grammar `SLUG-VIEWPORT-NN-PAGE-THEME.png` (use
   `desktop` or `mobile` for `VIEWPORT`), sorting each prototype's captures by
   timestamp — never by URL words — and `git mv` them into `screenshots/`.
4. **Update `catalog.js`**: add or fill the matching page/theme paths under
   `captures.desktop` (or add a `captures.mobile` block for a mobile batch).
5. **Only then** flip device availability: enable the Mobile segmented button
   in `index.html`/`app.js` after the mobile captures actually exist, not
   before.
6. **Verify** every catalog path exists on disk and counts match the capture
   log (see checklist below).
7. **Spot-check** in the browser: the first and last prototype, plus every
   exception (today: p07's full map, p08's light-only set).

## Implementation notes

- **State & persistence:** state is `{ prototype, page, theme, zoom }`.
  Query params (`?prototype=&page=&theme=&zoom=`) win, then `localStorage`,
  then defaults `p00 / home / light / fit`. Every change writes back via
  `history.replaceState` and `localStorage`, both wrapped in try/catch for
  `file://` and locked-down browsers. Zoom values are `fit` and `full`
  (`full` = the `100%` button).
- **Theme preference:** `state.theme` is the user's preference, not the
  displayed variant. `resolve()` falls back to `light` when the preferred
  variant is absent (only p08 today), shows "Dark unavailable — showing the
  light capture", and keeps the dark preference so the next prototype resumes
  dark automatically.
- **Image dimensions:** the metadata strip reads `img.naturalWidth ×
  img.naturalHeight` after each `load` event — nothing is hardcoded.
- **Prefetch & cache:** during idle time two `<link rel="prefetch" as="image">`
  elements are pointed at the same page/theme on the previous and next
  prototypes. `serve.py` sends `Cache-Control: public, max-age=31536000,
  immutable` for `/screenshots/` and `no-cache` for everything else, so renamed
  images are cached forever while code always revalidates.
- **Rendering:** exactly one `<img decoding="async">`; Fit applies
  `width: min(100%, 1440px); height: auto`, 100% uses natural width inside a
  horizontally scrolling canvas. The image is never cropped or framed.
- **Accessibility/responsiveness:** segmented controls use `aria-pressed`,
  unavailable options are truly `disabled`, the fallback notice and a hidden
  status line are `aria-live="polite"`, focus is a vermilion outline, and all
  transitions are removed under `prefers-reduced-motion: reduce`. Under 820 px
  the header wraps into compact rows and the canvas padding shrinks.

## Verification checklist

```bat
:: 89 PNGs under screenshots/, none left in root
dir /b screenshots\*.png | find /c /v ""
dir /b *.png

:: catalog integrity: every referenced path exists, grammar holds,
:: p07 = 8 refs, p08 = 3, all others = 6, total = 89
py -c "import re,os;src=open('catalog.js').read();ps=re.findall(r'\"(screenshots/[^\"]+)\"',src);assert all(os.path.exists(p) for p in ps);assert len(ps)==89;print('catalog ok:',len(ps),'refs')"

:: server compiles and serves
py -m py_compile serve.py
py serve.py 4173 --no-open
```

Then in the browser at `http://127.0.0.1:4173/`:

- [ ] p00 home light renders; metadata shows real `width × height`
- [ ] p07 Full map dark renders; other prototypes disable the Full map button
- [ ] With dark preferred, p08 shows light + "Dark unavailable" notice; p09 resumes dark
- [ ] 100% zoom shows natural width with horizontal scroll; Fit restores
- [ ] `↑`/`↓`/`←`/`→`, `T`, `Z`, `O` shortcuts work outside form fields
- [ ] ~390 px viewport: header controls wrap, viewer stays usable
- [ ] No console errors; second visit restores the last selection

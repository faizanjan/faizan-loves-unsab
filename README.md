# Compiling a Heart ❤️

An anniversary site in two acts.

**Act I — the terminal.** A boot sequence, three questions, then: *do you wanna
see it? [Y/n]*. Say yes and `heart.js` is typed out and run in front of her —
the source on screen is the loop that really draws the rows, one per iteration.
Then: *is that beautiful enough for you? [Y/n]* — and either answer leads to the
advanced renderer. Typed at a readable pace; a `1×` / `2×` pacing control lives
in the title bar, and `slow`, `fast`, `help`, `whoami`, `ls`, `date` work as
commands at any prompt. There is deliberately no way for her to skip the
sequence.

**Photos.** Currently none are published — the site is shared publicly, so the
photo wall is switched off and the reveal falls back to the plain gradient. To
turn it back on, put the originals in `photos-raw/` and run
`./scripts/optimize-photos.sh`. They are resized, compressed and EXIF-stripped
into `src/photos/`, then tiled into the reveal's fixed wallpaper — the letter
scrolls over it while the photos stay put. The grid is computed from the photo
count and the viewport's own aspect ratio, so every photo gets a cell and none
are cropped off the edges. A light gradient sits on top, with a pool of
darkness behind the heart so the particles still read, and a soft column of
shade behind the text. Leave the folder empty and the page falls back to the
plain gradient.

**Act II — the reveal.** ~1200 canvas particles spiral in and assemble into a
heart, then beat on a real double-thump cardiac curve. Touch it and it bursts.
Below it: the letter, and a live counter of how long you've been together.

## Run locally

```bash
npm install
npm run dev
```

> **Node:** Vite 7's dev server needs Node **20.19+** (or 22.12+). The default
> `node` here is 20.11.0, which fails with `crypto.hash is not a function`.
> `npm run build` works on it, but for `npm run dev` use a newer Node —
> `nvm install 22 && nvm use 22`, or Homebrew's (`/opt/homebrew/opt/node/bin`).

## Build

```bash
npm run build
```

## What to change

| Thing | Where |
| --- | --- |
| Start date for the counter | `TOGETHER_SINCE` at the top of `src/reveal.jsx` |
| The letter, names, title | `src/reveal.jsx` |
| Questions, answers, boot text | the script block in `src/terminal.jsx` |
| The terminal heart loop | `HEART_SRC` + `heartRows()` in `src/terminal.jsx` — keep them identical |
| Typing speed | `CHAR_MS` / `LINE_MS` in `src/terminal.jsx` |
| Heart density, colour, beat | `PALETTE`, `beatEnvelope`, `seed()` in `src/heartCanvas.jsx` |
| Backdrop strength | `.backdrop.ready` opacity and `.veil` alphas in `src/styles.css` |
| Backdrop blur / tint | `ctx.filter` and the `'color'` blend fill in `src/backdrop.jsx` |

## While developing

On `localhost` only, an amber `dev` button sits bottom-right: **skip to the
heart →** jumps straight past the terminal to the finished reveal — particle
heart, letter, photos, counter — and **↺ replay terminal** goes back and
restarts it. `?reveal` in the URL does the same on load. Neither appears on a
deployed build — the check is on `window.location.hostname`.

This is the only skip that exists. Her title bar offers `1×` / `2×` pacing and
nothing else.

## Notes

- Mobile-first: the base CSS targets a phone, `@media (min-width: 700px)` only
  adds to it. The terminal tracks `visualViewport` so the on-screen keyboard
  never covers the prompt.
- Sound is two small WebAudio tones — no assets. Toggle is on the reveal screen.
- `prefers-reduced-motion` skips the assembly, the beat, and the fades.

## Deploy

`base: './'` is already set, so the build is portable.

- **GitHub Pages** — push, then `npm run deploy` (publishes `dist` to `gh-pages`),
  or use a Pages Action.
- **Vercel / Netlify** — point at the repo; build `npm run build`, output `dist`.

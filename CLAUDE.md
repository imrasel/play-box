# PlayBox: project map

PlayBox is a free music and games app for small children, built around the owner's 4-year-old son. It is a web app (PWA), so one codebase covers Android, iPhone and laptops, and it installs from a link and works offline.

Live at https://playbox.ostris.net. Read this file first, then `README.md`.

## Rules we have agreed

These came from real decisions. Keep to them unless the owner changes them.

**For the child**
- Little games have no reading, no timers and no losing. Mistakes are gentle, and a miss never ends a game.
- Every game opens straight into play with no settings first. Options sit behind a small button inside the game.
- Tap targets are big. Reward everything.
- Sound effects stay literal: a balloon pops and a knife slices. Do not add piano notes to them.

**For the look**
- The whole app is landscape. An upright phone turns the screen itself (see Rotation below).
- Home must be visible and clear of notches and bars in every module.
- Avoid muddy shadows on the game list. Keep tiles bright and icons large.
- Android matches the Samsung S23 look, which the owner has approved. iPhone is second priority.

**For content and law**
- Never use the names or artwork of Perfect Piano, Fruit Ninja, or other existing apps.
- Never write copyrighted melodies into the app. Bollywood, modern Bangla and film songs reach it through the MIDI import, or as notes the owner supplies.
- Do not add Jana Gana Mana (India's anthem).
- Keep the piano credit: Salamander Grand Piano by Alexander Holm, CC BY 3.0. It appears in Piano Setup and the README. Amar Shonar Bangla's source is credited in `src/piano/songs.ts`.
- Beats named "style" are drum-machine versions of traditional rhythms, not recordings.

**For the code**
- Never commit server addresses, passwords or keys.
- `ostris.net` is the owner's live company site. Never deploy over it.

## Commands

    npm install
    npx playwright install chromium webkit   # first time only, for browser checks
    npm run dev       # dev server; open the Network URL on a phone on the same Wi-Fi
    npm test          # unit tests
    npm run build     # type-check and build into dist/
    npm run check     # build, unit tests and every browser check
    npm run deploy    # runs check, then publishes only if everything passed

To watch a browser check run in a visible Chrome window, which the owner prefers:

    npm run build && npx vite preview --port 4199
    SHOW=1 node scripts/e2e-games.mjs /tmp

## Layout

    src/
      main.ts          Starts the app, routes by URL hash, draws the home screen
      modules.ts       Every screen in the app. Add new ones here
      style.css        All styles, including safe areas and rotation
      core/
        audio.ts       Shared sound engine; pauses all sound when the app is hidden
        awake.ts       Keeps the screen on until 3 minutes pass with no touch
        dom.ts         h(): small element builder
        install.ts     Install button, iPhone steps, fullscreen on Android
        rotate.ts      Converts touches on the turned screen back to app coordinates
        safe-space.ts  Measures the space browser bars really take on each phone
        storage.ts     localStorage wrappers that never throw
        ui.ts          Shared buttons, sliders, side panels, Home button
      piano/           Keyboard, voices, chords, Learn, Note Rain, recording, MIDI
      drums/           Kit art, synthesised sounds, backing beats
      guitar/          Neck, plucked-string synth, chord shapes, strum patterns
      games/
        games.ts       The game list
        play.ts        Shared frame for little games: Home, sounds, confetti
        *-logic.ts     Game rules with no drawing, covered by unit tests
        *-art.ts       Pre-rendered sprites
    public/            Icons, the share image (og.png), piano samples
    scripts/           Browser checks, deploy and image generators
    tests/             Unit tests for all pure logic

## How things work

**Adding a module or game.** Write a function `(root, goBack) => cleanup`, list it in `src/modules.ts`, and for a game add a tile to `GAMES` in `src/games/games.ts`. Little games start from `gameScreen()` in `play.ts`. Put rules in a `*-logic.ts` file with no DOM, so they can be unit tested.

**Rotation.** On a phone held upright, CSS turns `.piano` and `.hub` 90 degrees clockwise. So:
- Read sizes with `clientWidth` and `clientHeight`, never `getBoundingClientRect()`, on anything inside.
- Read touches on canvases with `localPoint()` from `core/rotate.ts`.
- The phone's top is the app's left, its right is the app's top, its bottom is the app's right, and its left is the app's bottom.

**Safe areas.** Use `--safe-t`, `--safe-r`, `--safe-b` and `--safe-l` from `style.css`. They are named from the app's point of view and already account for rotation. Controls must respect them. Instruments may run into the bottom gesture area, to use the space.

**Viewport.** `viewport-fit=cover` is removed at startup unless the app is installed, so a browser page stays clear of the browser's own bars.

**Sound.** All sound is generated in the app except the grand piano, which uses 30 MP3 samples. Connect to `getEngine().input`, and create audio inside a tap. Timed playback must use the audio clock, so that hiding the app pauses it.

**Offline.** `vite-plugin-pwa` precaches everything in the build, including the samples. Saved recordings, scores and imported songs live in that device's localStorage and do not sync.

**Canvas art.** Paint expensive art once to an offscreen canvas and reuse it, so phones stay smooth.

## Testing

Each browser check needs the built app served on port 4199; `npm run check` handles that.

| Script | Covers |
|---|---|
| `e2e.mjs` | Piano, Learn, Note Rain, recording, import, offline |
| `e2e-drums.mjs` | Every drum and beat, recording, pausing when hidden |
| `e2e-guitar.mjs` | Chords, strumming, patterns, guitar types |
| `e2e-games.mjs` | All little games, laptop mouse and keys, short screens |
| `e2e-rotate.mjs` | Upright phones in WebKit and Chromium |
| `e2e-notch.mjs` | Home clear of a simulated notch in every module |
| `e2e-fit.mjs` | Real phone sizes, both ways round, every screen |
| `e2e-install.mjs` | Install flow and every screen offline |
| `e2e-awake.mjs` | Screen stays on, and lets go after 3 idle minutes |

Browser checks measure sound by level, so they prove something plays, not that it sounds good. A long run can occasionally report silence that does not repeat. That cause is not yet known: rerun the single script, and treat it as real if it repeats. WebKit on a Mac is not a real iPhone, and neither Android nor iPhone installs are covered, so test those by hand.

## Deploying

The site is static files behind nginx. Set the target on your own machine, never in this repo:

    export PLAYBOX_DEPLOY="user@host:/path/to/site/"
    npm run deploy

Ask the owner for the target. nginx must serve `sw.js`, `index.html` and `manifest.webmanifest` with `Cache-Control: no-cache`, or phones will miss updates. Installing and offline both need HTTPS.

## Known gaps and ideas

- iPhone layout in the browser is good but not perfect. Installing to the Home Screen gives the cleanest result.
- Sound delay on real phones has not been measured.
- Guitar fretboard has no note bending.
- Not built yet: Tabla & Dhol module, power chords for Rock Electric, hand settings and A-B loop in Learn, drum recording with the backing beat.

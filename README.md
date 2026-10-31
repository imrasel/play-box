# PlayBox

A free music and games app for small children: piano, drums, guitar and little games. It is a web app (PWA), so it runs on Android, iPhone and laptops from one codebase, installs from a link, and works offline.

Live at https://playbox.ostris.net

**Developers: read [CLAUDE.md](CLAUDE.md) first.** It is the full project map: layout, how things work, the rules we keep to, testing and deploying.

    npm install
    npm run dev        # open the printed Network URL on a phone on the same Wi-Fi
    npm test           # unit tests
    npm run check      # build, unit tests and every browser check
    npm run deploy     # checks everything, then publishes

Browser checks also need `npx playwright install chromium webkit` the first time.

## Adding a module

Drums and each game are modules. Write a function that fills `root` and returns a cleanup function, then list it in `src/modules.ts`. Play sound through `getEngine()` from `src/core/audio.ts`.

## Credits

Amar Shonar Bangla: words and music by Rabindranath Tagore, melody adapted from Gagan Harkara. Notes read from the score typeset by Johan Schoone on Cantorion (CC BY-SA 3.0).

Piano sound: Salamander Grand Piano by Alexander Holm, licensed CC BY 3.0, converted to MP3 by the `@audio-samples/piano-mp3-velocity9` package (MIT).

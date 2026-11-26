# Golden Hour Courier — Island Air Mail

A golden-hour flight game for the make.fun bounty
**best-flight-game-20261126-0057** ("Make the best flight game").
Fly the mail rings, mind the wind, and bring her down on the island
runway before the fuel gauge turns red.

## The game

You are the last mail pilot of the Meridian Archipelago. The sun is
sinking, the wind is picking up, and eight villages are waiting for
their post. Thread the glowing mail rings in order, ride the
slipstream, then land on runway 09 before the depot bell rings.

- **5 aircraft** — Otter DHC-2 (forgiving workhorse), Kestrel S-1
  (aerobatic dart), Albatross C-9 (twin-engine hauler), Heron SF-4
  (seaplane, water landings OK), Comet X-77 (silver rocket). Each has
  its own cruise/stall/fuel/agility numbers.
- **4 islands** — Meridian Atoll (golden hour), Frostpeak Range (dawn
  snow), Port Aurelia (dusk harbour city), Ember Dunes (noon desert).
  Seeded terrain, landmarks, and a ring course per island.
- **6 weather presets + 4 times of day** — clear skies, sea breeze,
  storm front (rain), morning fog, snow squall, dust haze; wind and
  gusts push the plane around.
- **3 missions** — Island Mail Run (8 rings, 360 s), Express Parcel
  Dash (6 rings, 150 s), Free Flight (no timer).
- **Real flight model** — throttle sets a target speed, bank turns the
  heading, pitch trades speed for altitude, slow flight stalls and
  sinks, wind and gusts shove you, gear/flaps matter on landing. A
  landing only counts when it is slow, gentle, lined up, and on the
  gear; a hard touchdown or a water landing ends the run.
- **Scoring** — 250 pts per ring (+streak, +100 for a perfect centre),
  up to 1,000 pts for the landing (centre + soft + slow) plus a time
  bonus; medals from No medal to Golden Wings.
- **Presentation** — Three.js chase and cockpit cameras, glowing rings
  with light beams, drifting clouds, rain/snow, sun sprite, screen
  shake on boost, procedural WebAudio (engine drone, wind, ring
  chimes, stall warning, success/fail arpeggios), radio chatter from
  the depot, full HUD (airspeed, altitude, VSI, compass strip, fuel,
  wind, minimap, mission timer, next-ring distance).
- **Controls** — keyboard (W/S throttle, arrows bank/pitch, Shift
  boost, G gear, F flaps, C camera, M mute, P pause), mouse drag to
  steer + wheel throttle, touch buttons on mobile.

## Run it locally

```sh
node serve.ts --port 8080
# open http://127.0.0.1:8080/ in desktop Chrome
```

No build step, no network at runtime: everything the game needs is
under `game/` (Three.js is vendored as `game/vendor/three.min.js`) or a
`data:` URI. `index.html` also opens directly from disk.

## Deterministic screenshots

`?shot=start|play|end&seed=N` stages a scene by playing the real rules
forward from a fresh world with an autopilot, so the same seed always
gives the same frame:

- `?shot=start&seed=1` — title screen with aircraft/island/weather pickers
- `?shot=play&seed=1` — mid-flight, ring 1 passed, ring 2 ahead
- `?shot=end&seed=1` — full 8-ring run flown and landed (Golden Wings)

Taken headless with the Playwright Chromium shell:

```sh
~/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell \
  --headless --no-sandbox --disable-gpu --use-angle=swiftshader \
  --enable-unsafe-swiftshader --window-size=1280,720 \
  --virtual-time-budget=45000 --screenshot=shot.png \
  "http://127.0.0.1:8080/?shot=play&seed=1"
```

The shipped screenshots are `screenshots/1-play.jpg` (cover),
`2-start.jpg`, `3-play2.jpg`, `4-end.jpg` (see `shots.json`).

## Local test results (2026-11-26, headless Chromium, seed 1)

- Title screen renders: all 5 aircraft, 4 islands, 6 weather cards,
  controls, FLY button — no console errors.
- Play shot renders: Otter in flight over Meridian Atoll, HUD fully
  lit (88 kt, 1,167 ft, score 250, rings 1/8, time 5:20, fuel 96%,
  compass, minimap, ring 2 ahead with beam) — no console errors.
- End shot renders: autopilot flies all 8 rings and lands —
  "Mail delivered!", 8/8 rings · 2,000 pts, landing 1,030 pts, time
  bonus +236, flight time 5:13, fuel 71%, medal Golden Wings,
  total 4,366 — no console errors.
- `makefun check` (kit CLI, `--worktree`): see the finisher's run; the
  game itself passes the local gates (game/ ≤ 48 MiB, ≤ 993 files,
  index.html ≤ 1 MiB, 4 screenshots ≤ 256 KiB each, all references
  inside game/ or `data:` URIs).

## Layout

```
main.ts                  kit entrypoint (copies game/ + screenshots/, writes dossier.json)
serve.ts                 local dev server (serves game/ on 127.0.0.1)
LICENSE                  MIT
shots.json               the four shipped screenshots, in order
vendor/makefun-game.ts   kit file, unchanged
game/
  index.html             canvas + DOM HUD + screens
  src/                   config, random, audio, input, physics, world,
                         aircraft, render, missions, shots, main
  vendor/three.min.js    Three.js 0.160.0 (MIT), vendored
  assets/                procedural PNG textures (cloud, water, runway,
                         terrain grain) generated by tools/make-textures.py
screenshots/             1-play.jpg, 2-start.jpg, 3-play2.jpg, 4-end.jpg
tools/make-textures.py   texture generator (PIL, seeded)
```

Total game content is ~1.1 MB of real systems, content, and features —
no padding. All art and audio are original or procedural; the only
third-party code is Three.js.

// Golden Hour Courier — Island Air Mail (best-flight-game-20261126-0057, Node 22, standard library only).
// A golden-hour island mail-run flight game: pick one of 5 aircraft (Otter DHC-2, Kestrel S-1,
// Albatross C-9, Heron SF-4 seaplane, Comet X-77) and fly mail across 4 islands (Meridian Atoll,
// Frostpeak Range, Port Aurelia, Ember Dunes), threading 8 mail rings in order and landing on
// runway 09 before the clock or the fuel runs out. Arcade flight model with real bones — stall,
// wind gusts, gear and flaps, and a landing that only counts when it is slow, gentle, straight
// and on the runway — plus ring/streak/perfect scoring, a landing score up to 1.030 pts, time
// bonus, and medals up to Golden Wings. Three.js chase + cockpit cameras, a full HUD (speed,
// altitude, VSI, compass, fuel, wind, minimap), clouds, rain and snow, generated WebAudio sound
// and radio chatter; the only vendor code is Three.js 0.160.0.
// This entrypoint copies game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, via the vendored make.fun library.
// Dossier caps below are the scorer's own reference/gate.json limits, kept as-is so the entry
// self-checks against exactly what the scorer enforces: 4 screenshots at most (we ship 4 —
// cover, start, play, end — each a JPEG at or under 256 KiB), 993 game files / 48 MiB total
// (we ship 21 files, ~1.0 MB of real content), 1000-byte path cap, and 160 KiB of text.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

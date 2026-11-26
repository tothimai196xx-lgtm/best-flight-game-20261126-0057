// Golden Hour Courier — boot, screens and the one loop.
// ?seed=N fixes the random draws. ?shot=start|play|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.

import { AIRCRAFT, ISLANDS, WEATHER, MISSIONS, BEST_KEY, STEP, RUNWAY } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_CAMERA, ACTION_MUTE, ACTION_GEAR, ACTION_FLAPS } from './input.js';
import { createFlight, EVENT_RING, EVENT_PERFECT_RING, EVENT_LANDED, EVENT_CRASH, EVENT_FUEL_EMPTY, EVENT_STALL, EVENT_OUT_OF_BOUNDS } from './physics.js';
import { createRenderer } from './render.js';
import { preloadTextures } from './world.js';
import { createMission } from './missions.js';
import { stageShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const rand = createRandom(seed);

const canvas = $('scene');
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

let screen = 'title';
let aircraft = AIRCRAFT[0];
let island = ISLANDS[0];
let weather = { ...WEATHER[0], windDir: rand.next() * Math.PI * 2 };
let missionId = 'mail-run';
let flight = null;
let mission = null;
let world = null;
let elapsed = 0;
let msgUntil = 0;
let radioShown = '';

function announce(message) { $('status').textContent = message; }
function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; }
  catch { return 0; }
}
function saveBest(value) {
  try { window.localStorage.setItem(BEST_KEY, String(value)); } catch { /* ignore */ }
}

// --- pickers on the title screen ---
function buildPickers() {
  const aRow = $('aircraftRow');
  AIRCRAFT.forEach((a, i) => {
    const el = document.createElement('div');
    el.className = 'pick' + (i === 0 ? ' sel' : '');
    el.innerHTML = `<b>${a.name}</b><span class="stat">${a.tag} · ${a.blurb}</span><span>${a.desc}</span>`;
    el.addEventListener('click', () => {
      aircraft = a;
      aRow.querySelectorAll('.pick').forEach((p) => p.classList.remove('sel'));
      el.classList.add('sel');
      audio.unlock(); audio.click();
    });
    aRow.appendChild(el);
  });
  const iRow = $('islandRow');
  ISLANDS.forEach((isl, i) => {
    const el = document.createElement('div');
    el.className = 'pick' + (i === 0 ? ' sel' : '');
    el.innerHTML = `<b>${isl.name}</b><span class="stat">${isl.tag}</span><span>${isl.desc}</span><span class="stat">${isl.lore}</span>`;
    el.addEventListener('click', () => {
      island = isl;
      iRow.querySelectorAll('.pick').forEach((p) => p.classList.remove('sel'));
      el.classList.add('sel');
      audio.unlock(); audio.click();
    });
    iRow.appendChild(el);
  });
  const wRow = $('weatherRow');
  WEATHER.forEach((w, i) => {
    const el = document.createElement('div');
    el.className = 'pick' + (i === 0 ? ' sel' : '');
    el.innerHTML = `<b>${w.name}</b><span class="stat">${w.wind} kt wind · gusts ${w.gust} kt</span><span>${w.desc}</span>`;
    el.addEventListener('click', () => {
      weather = { ...w, windDir: rand.next() * Math.PI * 2 };
      wRow.querySelectorAll('.pick').forEach((p) => p.classList.remove('sel'));
      el.classList.add('sel');
      audio.unlock(); audio.click();
    });
    wRow.appendChild(el);
  });
  const best = readBest();
  $('bestLine').textContent = best > 0
    ? `Best mail run so far: ${best.toLocaleString('en-US')} points. The depot remembers.`
    : 'No mail run yet. The depot bell rings at 17:40 — make it home by then.';
}

function buildWorld() {
  world = renderer.load(island, weather, island.timeOfDay, aircraft);
  flight = createFlight(aircraft, island, weather, world.terrainHeight);
  mission = createMission(missionId, island, aircraft, weather);
  if (missionId === 'free') world.setNextRing(-1);
  return world;
}

function showScreen(name) {
  $('titleScreen').classList.toggle('hidden', name !== 'title');
  $('endScreen').classList.toggle('hidden', name !== 'end');
  $('pauseScreen').classList.toggle('hidden', name !== 'paused');
  $('hud').style.display = name === 'play' ? 'block' : (name === 'paused' ? 'block' : 'none');
}

function startGame(id) {
  missionId = id;
  audio.unlock();
  buildWorld();
  screen = 'play';
  showScreen('play');
  renderer.clearBig();
  renderer.showBeacon('');
  renderer.showBig(MISSIONS.find((m) => m.id === id).name, MISSIONS.find((m) => m.id === id).brief);
  msgUntil = elapsed + 4;
  announce(`Flying the ${MISSIONS.find((m) => m.id === id).name} over ${island.name} in the ${aircraft.name}.`);
}

function showEnd() {
  screen = 'end';
  const b = mission.breakdown;
  $('endTitle').textContent = mission.title();
  $('endSub').textContent = mission.subtitle();
  $('medalEmoji').textContent = b.medal.emoji;
  const rows = [
    ['Rings flown', `${b.rings} / ${b.ringsTotal}  ·  ${b.ringPoints.toLocaleString('en-US')} pts`],
    ['Landing', b.landingPoints > 0 ? `${b.landingPoints.toLocaleString('en-US')} pts` : '—'],
    ['Time bonus', b.timeBonus > 0 ? `+${b.timeBonus.toLocaleString('en-US')} pts` : '—'],
    ['Flight time', `${Math.floor(b.timeUsed / 60)}:${String(b.timeUsed % 60).padStart(2, '0')}`],
    ['Fuel remaining', `${b.fuelLeft}%`],
    ['Aircraft', aircraft.name],
    ['Island', island.name],
    ['Medal', `${b.medal.emoji} ${b.medal.name}`],
    ['TOTAL SCORE', b.score.toLocaleString('en-US')],
  ];
  $('endStats').innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('');
  if (b.score > readBest() && mission.result === 'landed') {
    saveBest(b.score);
    $('endSub').textContent += ' New best score!';
  }
  showScreen('end');
  announce(`${mission.title()} Score ${b.score}.`);
}

function bigMessage(msg, sub, secs = 2.6) {
  renderer.showBig(msg, sub);
  msgUntil = elapsed + secs;
}

function handleEvents(events) {
  const f = flight.state;
  if (events & EVENT_RING) {
    const n = mission.nextRing + 1;
    mission.nextRing = n;
    world.setNextRing(n);
    const pts = 250 + Math.min(4, f.streak - 1) * 50;
    bigMessage(`RING ${n}!`, `+${pts} pts · ${mission.ringsTotal - n} to go`);
    audio.ring();
    announce(`Ring ${n} of ${mission.ringsTotal}.`);
  }
  if (events & EVENT_PERFECT_RING) {
    bigMessage('PERFECT CENTRE!', '+100 slipstream bonus — she surges forward');
    audio.perfect();
    renderer.addShake(0.3);
  }
  if (events & EVENT_STALL) {
    audio.stallWarn();
    renderer.showWarn('STALL! Nose down, add power');
    setTimeout(() => renderer.showWarn(''), 2600);
  }
  if (events & EVENT_FUEL_EMPTY) {
    bigMessage('OUT OF FUEL', 'Glide her down — find flat ground or the runway');
    audio.fail();
  }
  if (events & EVENT_OUT_OF_BOUNDS) {
    renderer.showWarn('TURN BACK — you are leaving the archipelago');
  }
  if (events & EVENT_LANDED) {
    audio.thud(false);
    renderer.addShake(0.4);
    mission.finish('landed', flight, flight.landingQuality());
    showEnd();
  }
  if (events & EVENT_CRASH) {
    audio.thud(true);
    audio.fail();
    renderer.addShake(1.2);
    mission.finish('crash', flight);
    showEnd();
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  elapsed += dt;

  const actions = input.takeActions();
  if (actions & ACTION_MUTE) audio.setMuted(!audio.isMuted());
  if (screen === 'title' && (actions & ACTION_CONFIRM)) { /* clicks on picks only */ }
  if (screen === 'play' && (actions & ACTION_PAUSE)) {
    screen = 'paused';
    showScreen('paused');
    announce('Paused.');
  } else if (screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
    screen = 'play';
    showScreen('play');
    announce('Flying.');
  }
  if (screen === 'play' && (actions & ACTION_CAMERA)) {
    renderer.setCameraMode(renderer.getCameraMode() === 'chase' ? 'cockpit' : 'chase');
    bigMessage(renderer.getCameraMode() === 'chase' ? 'CHASE CAMERA' : 'COCKPIT CAMERA', '', 1.4);
    audio.click();
  }
  if (screen === 'play' && (actions & ACTION_GEAR)) {
    flight.state.gear = !flight.state.gear;
    renderer.plane.setGearDown(flight.state.gear);
    bigMessage(flight.state.gear ? 'GEAR DOWN' : 'GEAR UP', '', 1.2);
    audio.click();
  }
  if (screen === 'play' && (actions & ACTION_FLAPS)) {
    flight.state.flaps = !flight.state.flaps;
    bigMessage(flight.state.flaps ? 'FLAPS DOWN' : 'FLAPS UP', '', 1.2);
    audio.click();
  }

  if (screen === 'play' && flight) {
    // Fixed-step simulation.
    accumulator += dt;
    let guard = 0;
    while (accumulator >= STEP && guard < 8) {
      const axis = input.axis();
      const events = flight.step(STEP, {
        roll: axis.roll, pitch: axis.pitch,
        throttleDelta: () => input.throttleDelta(),
        boost: () => input.boost(),
      }, missionId === 'free' ? [] : world.rings, mission.nextRing);
      handleEvents(events);
      mission.tick(STEP, flight, events);
      if (mission.finished) { showEnd(); break; }
      accumulator -= STEP;
      guard += 1;
    }
    if (screen !== 'play') return; // mission ended inside the steps

    const d = flight.toDisplay();
    const boosting = input.boost() && flight.state.fuel > 0;
    renderer.plane.update(flight.state, dt, elapsed, d.speedKt);
    renderer.updateCamera(flight.state, dt, boosting);
    world.update(dt, renderer.cameraPos, elapsed);
    audio.update(flight.state.throttle, d.speedKt, d.airborne);
    renderer.drawHud(d, mission, weather, island.timeOfDay, island);

    // Beacon: where is the next ring?
    if (missionId !== 'free' && mission.nextRing < world.rings.length) {
      const r = world.rings[mission.nextRing];
      const dist = Math.hypot(r.x - flight.state.x, r.y - flight.state.y, r.z - flight.state.z);
      const rAlt = Math.round(r.y * 3.281);
      renderer.showBeacon(`NEXT RING ${mission.nextRing + 1} · ${Math.round(dist).toLocaleString('en-US')} m · RING ALT ${rAlt.toLocaleString('en-US')} ft`);
    } else if (missionId === 'free') {
      renderer.showBeacon('FREE FLIGHT — land on runway 09 whenever you like');
    } else {
      renderer.showBeacon('ALL RINGS FLOWN — land on runway 09!');
    }
    // Warnings: low fuel, gear up near the ground, stall.
    if (flight.state.fuel < 20 && flight.state.fuel > 0) renderer.showWarn(`LOW FUEL — ${Math.round(flight.state.fuel)}% left`);
    else if (flight.state.y < 120 && !flight.state.gear && flight.state.airborne) renderer.showWarn('GEAR UP — press G to lower the gear');
    else if (elapsed > msgUntil) renderer.showWarn('');
    // Big message expiry + radio chatter.
    if (elapsed > msgUntil) {
      if (mission.radioLine) {
        if (radioShown !== mission.radioLine) { radioShown = mission.radioLine; renderer.showBig('', `📻 ${mission.radioLine}`); }
      } else { renderer.clearBig(); radioShown = ''; }
    }
    renderer.render();
  } else if (screen === 'title' && world) {
    // Idle title scene: slow orbit around the parked plane.
    const t = elapsed * 0.05;
    const px = RUNWAY.x + Math.sin(t) * 60;
    const pz = RUNWAY.z + 260 + Math.cos(t) * 60;
    renderer.camera.position.set(px, 26, pz);
    renderer.camera.lookAt(RUNWAY.x, 12, RUNWAY.z);
    world.update(dt, renderer.cameraPos, elapsed);
    renderer.render();
  }
}

let last = performance.now();
let accumulator = 0;

// --- shot mode: stage a deterministic scene, paint it, flag readiness ---
function runShot() {
  const staged = stageShot(shot, { flight, world, mission, renderer, debug: params.get('debug') === '1' });
  const d = flight.toDisplay();
  const boosting = false;
  renderer.plane.update(flight.state, 0.016, elapsed, d.speedKt);
  // Let the chase camera settle onto the plane before painting.
  for (let i = 0; i < 90; i++) renderer.updateCamera(flight.state, 1 / 60, boosting);
  world.update(0.016, renderer.cameraPos, 1);
  renderer.drawHud(d, mission, weather, island.timeOfDay, island);
  if (staged.screen === 'title') {
    showScreen('title');
    renderer.render();
  } else if (staged.screen === 'play') {
    showScreen('play');
    renderer.showBig('ISLAND MAIL RUN', 'Eight rings, one runway, golden light');
    if (mission.nextRing < world.rings.length) {
      const r = world.rings[mission.nextRing];
      renderer.showBeacon(`NEXT RING ${mission.nextRing + 1} · ${Math.round(Math.hypot(r.x - flight.state.x, r.y - flight.state.y, r.z - flight.state.z)).toLocaleString('en-US')} m`);
    }
    renderer.render();
  } else {
    showEnd();
    renderer.render();
  }
  let painted = 0;
  function paint() {
    renderer.render();
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

// --- wire the buttons ---
$('flyBtn').addEventListener('click', () => startGame('mail-run'));
$('freeBtn').addEventListener('click', () => startGame('free'));
$('againBtn').addEventListener('click', () => startGame(missionId));
$('changeBtn').addEventListener('click', () => { screen = 'title'; buildWorld(); showScreen('title'); });
$('resumeBtn').addEventListener('click', () => { screen = 'play'; showScreen('play'); });
$('quitBtn').addEventListener('click', () => { screen = 'title'; buildWorld(); showScreen('title'); });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') { screen = 'paused'; showScreen('paused'); }
});

buildPickers();
preloadTextures().then(() => {
  buildWorld();
  showScreen('title');
  $('loading').remove();
  announce('Golden Hour Courier. Pick an aircraft, an island and the weather, then fly the mail run.');
  if (shot) runShot();
  else requestAnimationFrame(frame);
});

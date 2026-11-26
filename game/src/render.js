// Renderer for Golden Hour Courier — the Three.js scene, chase + cockpit
// cameras, screen shake, the full DOM HUD (speed/altitude tapes, compass,
// fuel, wind, minimap) and the centre messages. The HUD is DOM so the
// instruments stay crisp and legible in every screenshot.

import * as THREE from '../vendor/three.min.js';
import { createWorld } from './world.js';
import { buildAircraft } from './aircraft.js';
import { TIMES, RUNWAY, WORLD } from './config.js';

const $ = (id) => document.getElementById(id);

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.5, 20000);
  camera.position.set(0, 120, 400);

  let world = null;
  let plane = null;
  let cameraMode = 'chase'; // 'chase' | 'cockpit'
  let shake = 0;
  const camPos = new THREE.Vector3(0, 120, 400);
  const camTarget = new THREE.Vector3();
  const lookAt = new THREE.Vector3();

  // --- compass strip: one tick div per 15 degrees, repositioned each frame ---
  const strip = $('compassStrip');
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 15) {
    const el = document.createElement('div');
    el.className = 'tick';
    const card = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[deg];
    el.innerHTML = card ? `${String(deg).padStart(3, '0')}<small>${card}</small>` : String(deg).padStart(3, '0');
    strip.appendChild(el);
    ticks.push({ deg, el });
  }
  const compassRead = $('compassRead');

  const minimap = $('minimap');
  const mctx = minimap.getContext('2d');

  function resize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);

  function load(island, weather, timeName, aircraft) {
    if (world) { scene.remove(world.group); }
    world = createWorld(island, weather, timeName);
    scene.add(world.group);
    const time = TIMES[timeName] || TIMES.golden;
    const fogColor = new THREE.Color(island.palette.fog);
    const vis = weather.vis;
    scene.fog = new THREE.Fog(fogColor, 600, Math.round(1200 + 6800 * vis));
    scene.background = new THREE.Color(time.sky);
    if (plane) scene.remove(plane.group);
    plane = buildAircraft(aircraft);
    scene.add(plane.group);
    scene.add(plane.trails[0]);
    scene.add(plane.trails[1]);
    camPos.set(0, 60, 500);
    return world;
  }

  function setCameraMode(mode) { cameraMode = mode; }
  function getCameraMode() { return cameraMode; }
  function addShake(amount) { shake = Math.min(1.2, shake + amount); }

  function updateCamera(state, dt, boosting) {
    const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
    const cp = Math.cos(state.pitch), sp = Math.sin(state.pitch);
    if (cameraMode === 'cockpit') {
      // Nose-mounted: just ahead of the canopy, looking along the flight path.
      const px = state.x + fx * 2.2, py = state.y + 1.1, pz = state.z + fz * 2.2;
      camPos.lerp(new THREE.Vector3(px, py, pz), 1 - Math.pow(0.0001, dt));
      lookAt.set(state.x + fx * cp * 120, state.y + sp * 120, state.z + fz * cp * 120);
    } else {
      // Chase: behind and above, lagging the turns so the world sweeps.
      const dist = 26 + state.speed * 0.16;
      const height = 7 + state.speed * 0.03;
      const tx = state.x - fx * cp * dist;
      const ty = state.y - sp * dist + height;
      const tz = state.z - fz * cp * dist;
      camPos.lerp(new THREE.Vector3(tx, ty, tz), 1 - Math.pow(0.001, dt));
      lookAt.set(state.x + fx * 60, state.y + sp * 40, state.z + fz * 60);
    }
    // Screen shake: boost, stall buffet and hard manoeuvres.
    shake = Math.max(0, shake - dt * 1.6);
    let sh = shake;
    if (boosting) sh = Math.max(sh, 0.35);
    if (sh > 0.01) {
      const s = sh * 1.6;
      camPos.x += (Math.random() - 0.5) * s;
      camPos.y += (Math.random() - 0.5) * s;
      camPos.z += (Math.random() - 0.5) * s;
    }
    camera.position.copy(camPos);
    camera.lookAt(lookAt);
    // Roll the camera a touch with the bank so turns feel physical.
    camera.rotateZ(-state.roll * 0.22);
  }

  function drawHud(d, mission, weather, timeName, island) {
    $('speedVal').textContent = d.speedKt;
    $('altVal').textContent = d.altFt.toLocaleString('en-US');
    $('vsiVal').textContent = (d.vsi >= 0 ? '+' : '') + d.vsi.toLocaleString('en-US');
    $('fuelVal').textContent = d.fuel;
    $('scoreVal').textContent = d.score.toLocaleString('en-US');
    $('ringsVal').textContent = `${d.rings} / ${mission.ringsTotal}`;
    const t = mission.def.timeLimit > 0 ? mission.timeLeft : d.time;
    const mm = Math.floor(t / 60), ss = Math.floor(t % 60);
    $('timeVal').textContent = `${mm}:${String(ss).padStart(2, '0')}`;
    $('timeVal').style.color = mission.def.timeLimit > 0 && mission.timeLeft < 60 ? '#ff6b6b' : '';
    $('speedFill').style.width = `${Math.min(100, (d.speedKt / 200) * 100)}%`;
    $('altFill').style.width = `${Math.min(100, (d.altFt / 8000) * 100)}%`;
    $('vsiFill').style.width = `${Math.max(0, Math.min(100, 50 + (d.vsi / 3000) * 50))}%`;
    $('fuelFill').style.width = `${d.fuel}%`;
    $('fuelFill').style.background = d.fuel < 20 ? '#ff6b6b' : d.fuel < 40 ? '#ffb020' : '';
    $('fuelVal').style.color = d.fuel < 20 ? '#ff6b6b' : '';
    // Compass: ticks slide across a 120-degree window centred on the heading.
    const w = strip.clientWidth || 460;
    const pxPerDeg = w / 120;
    for (const t of ticks) {
      let diff = ((t.deg - d.heading + 540) % 360) - 180;
      const x = w / 2 + diff * pxPerDeg;
      t.el.style.display = (Math.abs(diff) > 62 || x < 22 || x > w - 22) ? 'none' : 'block';
      t.el.style.left = `${x}px`;
    }
    compassRead.innerHTML = `HDG ${String(d.heading).padStart(3, '0')}&deg; &middot; ${d.compass}`;
    // Wind + weather line.
    const windDirName = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(((weather.windDir ?? 2.2) * 180 / Math.PI + 180) % 360 / 45) % 8];
    $('windVal').textContent = `${weather.wind} kt · ${windDirName}`;
    $('weatherVal').textContent = `${timeName[0].toUpperCase() + timeName.slice(1)} · ${weather.name}`;
    drawMinimap(d, mission, island);
  }

  function drawMinimap(d, mission, island) {
    const S = 168, C = S / 2;
    const scale = S / (WORLD.half * 2 + 400);
    const px = (x) => C + x * scale;
    const pz = (z) => C + z * scale;
    mctx.clearRect(0, 0, S, S);
    // Sea + island blob.
    mctx.fillStyle = 'rgba(13,74,102,0.9)';
    mctx.fillRect(0, 0, S, S);
    mctx.fillStyle = 'rgba(79,158,87,0.85)';
    mctx.beginPath();
    mctx.arc(C, C, 2300 * scale, 0, Math.PI * 2);
    mctx.fill();
    // Runway.
    mctx.strokeStyle = '#f5f5f0';
    mctx.lineWidth = 3;
    mctx.beginPath();
    mctx.moveTo(px(RUNWAY.x), pz(RUNWAY.z - RUNWAY.length / 2));
    mctx.lineTo(px(RUNWAY.x), pz(RUNWAY.z + RUNWAY.length / 2));
    mctx.stroke();
    // Rings.
    if (world) {
      world.rings.forEach((r, i) => {
        mctx.beginPath();
        mctx.arc(px(r.x), pz(r.z), i === mission.nextRing ? 5 : 3.5, 0, Math.PI * 2);
        mctx.fillStyle = r.done ? '#38bdf8' : i === mission.nextRing ? '#7dff9e' : '#ffc857';
        mctx.fill();
      });
    }
    // Plane triangle, rotated to heading.
    const hdg = (d.heading * Math.PI) / 180;
    mctx.save();
    mctx.translate(px(d.x ?? 0), pz(d.z ?? 0));
    mctx.rotate(hdg);
    mctx.fillStyle = '#ffffff';
    mctx.beginPath();
    mctx.moveTo(0, -8); mctx.lineTo(5, 6); mctx.lineTo(-5, 6); mctx.closePath();
    mctx.fill();
    mctx.restore();
    mctx.fillStyle = '#9fd8ff';
    mctx.font = 'bold 11px system-ui, sans-serif';
    mctx.fillText('N', C - 3, 12);
  }

  function showBig(msg, sub = '') {
    $('bigMsg').textContent = msg;
    $('subMsg').textContent = sub;
  }
  function clearBig() { $('bigMsg').textContent = ''; $('subMsg').textContent = ''; }
  function showBeacon(text) { $('ringBeacon').textContent = text; }
  function showWarn(text) {
    const el = $('warn');
    if (text) { el.textContent = text; el.style.display = 'block'; }
    else el.style.display = 'none';
  }

  return {
    load, updateCamera, drawHud, showBig, clearBig, showBeacon, showWarn,
    setCameraMode, getCameraMode, addShake,
    render() { renderer.render(scene, camera); },
    get world() { return world; },
    get plane() { return plane; },
    get scene() { return scene; },
    get camera() { return camera; },
    get cameraPos() { return camPos; },
  };
}

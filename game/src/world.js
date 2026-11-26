// World for Golden Hour Courier — terrain, sea, sky, runway, mail rings,
// landmarks, clouds and weather, all generated from the island's seed so the
// same island always looks the same. Terrain height is a pure function, shared
// by the physics module, so the ground you see is the ground you hit.

import * as THREE from '../vendor/three.min.js';
import { WORLD, RUNWAY, TIMES, PALETTE } from './config.js';
import { makeNoise, createRandom } from './random.js';

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) { return a + (b - a) * t; }
function hexRgb(h) { return [(h >> 16 & 255) / 255, (h >> 8 & 255) / 255, (h & 255) / 255]; }

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Procedural PNG assets under game/assets/ (drawn by tools/make-textures.py).
// preloadTextures() resolves when all four are in; createWorld uses them when
// present and falls back to equivalent canvas textures otherwise, so the game
// never depends on an async load finishing.
const TEX = {};
let texPromise = null;
export function preloadTextures() {
  if (texPromise) return texPromise;
  const loader = new THREE.TextureLoader();
  const jobs = [
    ['cloud', './assets/cloud.png'],
    ['water', './assets/water.png'],
    ['runway', './assets/runway.png'],
    ['grain', './assets/terrain-grain.png'],
  ].map(([key, url]) => loader.loadAsync(url).then((t) => { TEX[key] = t; }).catch(() => {}));
  texPromise = Promise.all(jobs);
  return texPromise;
}

export function createWorld(island, weather, timeName) {
  const rand = createRandom(island.seed);
  const noise = makeNoise(island.seed * 7 + 13);
  const time = TIMES[timeName] || TIMES.golden;
  const pal = island.palette;
  const group = new THREE.Group();

  // Two seeded mountain peaks per island (Frostpeak's are the tall ones).
  const peaks = [
    { x: rand.range(-1400, -500), z: rand.range(-1400, -300), h: island.terrain.peak, r: rand.range(700, 1000) },
    { x: rand.range(500, 1300), z: rand.range(-1200, 200), h: island.terrain.peak * 0.8, r: rand.range(600, 900) },
  ];

  function terrainHeight(x, z) {
    const r = Math.hypot(x, z) / 2300;
    const mask = 1 - smoothstep(0.62, 1.0, r);
    let h = island.terrain.base + noise.fbm(x * 0.00055 + 3.1, z * 0.00055 + 7.7, 4) * island.terrain.amp;
    for (const p of peaks) {
      const d2 = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
      h += p.h * Math.exp(-d2 / (p.r * p.r));
    }
    h = h * mask - (1 - mask) * 34;
    // Flatten the airfield: the runway sits on level ground.
    const rd = Math.hypot(x - RUNWAY.x, z - RUNWAY.z);
    const flat = 1 - smoothstep(340, 600, rd);
    h = lerp(h, 4, flat);
    // The departure valley: a low corridor north of the runway so the climb
    // out clears the hills instead of flying straight into them — but never
    // under the airfield itself (flat == 1 there, so the valley fades out).
    const cx = 1 - smoothstep(180, 420, Math.abs(x - RUNWAY.x));
    const cz = smoothstep(200, 420, z) * (1 - smoothstep(1400, 1700, z));
    h = lerp(h, 45, cx * cz * 0.85 * (1 - flat));
    // The approach corridor: the valley floor south of the runway follows
    // the glide slope down to the threshold, so the final leg always has
    // ground clearance — without it the slope dives straight through the
    // hill south of the field and the landing autopilot has to climb away.
    const ax = 1 - smoothstep(140, 380, Math.abs(x - RUNWAY.x));
    const az = smoothstep(700, 1000, z) * (1 - smoothstep(2600, 2900, z));
    if (ax * az > 0) {
      const slopeFloor = Math.max(4, 8 + (z - (RUNWAY.z - RUNWAY.length / 2 + 80)) * 0.09 - 18);
      h = lerp(h, Math.min(h, slopeFloor), ax * az * 0.95 * (1 - flat));
    }
    return h;
  }

  // --- sky dome: vertical gradient, zenith deeper than the horizon band ---
  const zenith = new THREE.Color(time.sky).lerp(new THREE.Color(0x2a2a55), 0.55);
  const skyTex = canvasTexture(4, 512, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#' + zenith.getHexString());
    grad.addColorStop(0.42, '#' + new THREE.Color(time.sky).getHexString());
    grad.addColorStop(0.55, '#' + new THREE.Color(time.horizon).getHexString());
    grad.addColorStop(0.62, '#' + new THREE.Color(time.horizon).getHexString());
    grad.addColorStop(1, '#2a3a52');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(9000, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // --- sun disc + glow ---
  const sunTex = canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 128, 8, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,246,220,1)');
    grad.addColorStop(0.25, 'rgba(255,200,110,0.9)');
    grad.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  });
  const sunAngle = time.sun;
  const sunDir = new THREE.Vector3(Math.sin(sunAngle * 1.4), Math.sin(sunAngle), -Math.cos(sunAngle * 1.4)).normalize();
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, fog: false, depthWrite: false, transparent: true }));
  sun.position.copy(sunDir).multiplyScalar(8200);
  sun.scale.set(2600, 2600, 1);
  group.add(sun);

  // --- terrain ---
  const SEG = 190;
  const geo = new THREE.PlaneGeometry(WORLD.size, WORLD.size, SEG, SEG);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const cSand = hexRgb(pal.sand), cGrass = hexRgb(pal.grass), cDeep = hexRgb(pal.deepGrass);
  const cRock = hexRgb(pal.rock), cSnow = hexRgb(pal.snow);
  const tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = terrainHeight(x, z);
    pos.setY(i, h);
    const beach = 1 - smoothstep(island.terrain.beach, island.terrain.beach + 7, h);
    const grassy = smoothstep(6, 26, h) * (1 - smoothstep(120, 260, h));
    const rocky = smoothstep(140, 300, h) * (1 - smoothstep(320, 520, h));
    const snowy = smoothstep(island.id === 'frostpeak' ? 240 : 430, island.id === 'frostpeak' ? 380 : 640, h);
    // Mix: sand -> grass -> rock -> snow, with a little noise variation.
    const n = noise.fbm(x * 0.01, z * 0.01, 2) * 0.08;
    tmp.setRGB(0, 0, 0);
    tmp.r += cSand[0] * beach + cGrass[0] * grassy + cDeep[0] * grassy * 0.4 + cRock[0] * rocky + cSnow[0] * snowy;
    tmp.g += cSand[1] * beach + cGrass[1] * grassy + cDeep[1] * grassy * 0.4 + cRock[1] * rocky + cSnow[1] * snowy;
    tmp.b += cSand[2] * beach + cGrass[2] * grassy + cDeep[2] * grassy * 0.4 + cRock[2] * rocky + cSnow[2] * snowy;
    const shade = 1 - smoothstep(0, 500, h) * 0.12 + n;
    colors[i * 3] = Math.min(1, tmp.r * shade + 0.02);
    colors[i * 3 + 1] = Math.min(1, tmp.g * shade + 0.02);
    colors[i * 3 + 2] = Math.min(1, tmp.b * shade + 0.02);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  if (TEX.grain) {
    TEX.grain.wrapS = TEX.grain.wrapT = THREE.RepeatWrapping;
    TEX.grain.repeat.set(48, 48);
    TEX.grain.colorSpace = THREE.SRGBColorSpace;
  }
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.grain ?? null }));
  group.add(terrain);

  // --- sea ---
  const waterTex = TEX.water ?? canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 2;
    for (let i = 0; i < 46; i++) {
      const y = rand.range(0, h), x = rand.range(0, w), len = rand.range(18, 70);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + len, y); g.stroke();
    }
  });
  waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  waterTex.repeat.set(36, 36);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(11000, 11000),
    new THREE.MeshPhongMaterial({ color: pal.water, transparent: true, opacity: 0.88, shininess: 120, specular: 0x99ccff, map: waterTex, alphaMap: waterTex }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = WORLD.waterLevel;
  group.add(sea);

  // --- runway: painted asphalt texture with centreline, thresholds and "09" ---
  const rwTex = TEX.runway ?? canvasTexture(256, 1024, (g, w, h) => {
    g.fillStyle = '#33373d'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 900; i++) g.fillRect(rand.range(0, w), rand.range(0, h), 2, 2);
    g.fillStyle = '#f5f5f0';
    for (let y = 60; y < h - 40; y += 64) g.fillRect(w / 2 - 4, y, 8, 34);
    g.fillRect(14, 26, w - 28, 10); g.fillRect(14, h - 36, w - 28, 10);
    g.font = 'bold 92px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('09', w / 2, h - 90);
    g.save(); g.translate(w / 2, 150); g.rotate(Math.PI); g.fillText('27', 0, 0); g.restore();
    g.fillStyle = '#ffc857'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  });
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshLambertMaterial({ map: rwTex }),
  );
  runway.rotation.x = -Math.PI / 2;
  runway.rotation.z = Math.PI; // texture "09" faces the approach end
  runway.position.set(RUNWAY.x, terrainHeight(RUNWAY.x, RUNWAY.z) + 0.4, RUNWAY.z);
  group.add(runway);
  // Runway edge lights.
  const lightGeo = new THREE.SphereGeometry(1.6, 8, 6);
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (let s = -1; s <= 1; s += 2) {
    for (let d = -RUNWAY.length / 2; d <= RUNWAY.length / 2; d += 62) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(RUNWAY.x + s * (RUNWAY.width / 2 + 3), terrainHeight(RUNWAY.x, RUNWAY.z) + 1.5, RUNWAY.z + d);
      group.add(l);
    }
  }

  // --- mail rings: torus + number + light beam; only the next one glows green ---
  const rings = [];
  const ringGroup = new THREE.Group();
  const ringGeo = new THREE.TorusGeometry(26, 1.8, 10, 40);
  const ringPositions = [];
  ringPositions.push({ x: 40, z: 420, y: island.ringAlt - 40 }); // first ring sits lower: the climb-out meets it
  for (let i = 1; i < island.rings; i++) {
    const a = (i / island.rings) * Math.PI * 2 + 0.5;
    const r = island.ringSpread * (0.5 + rand.next() * 0.5);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = Math.max(island.ringAlt + rand.range(-90, 130), terrainHeight(x, z) + 130);
    ringPositions.push({ x, z, y });
  }
  ringPositions.forEach((p, i) => {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.ring, transparent: true, opacity: 0.95 });
    const mesh = new THREE.Mesh(ringGeo, mat);
    mesh.position.set(p.x, p.y, p.z);
    // Face along the course (toward the next ring).
    const next = ringPositions[(i + 1) % ringPositions.length];
    mesh.lookAt(next.x, next.y, next.z);
    ringGroup.add(mesh);
    // Number plate.
    const numTex = canvasTexture(128, 128, (g) => {
      g.fillStyle = 'rgba(8,18,34,0.85)'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill();
      g.strokeStyle = '#ffc857'; g.lineWidth = 5; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
      g.fillStyle = '#ffe9a8'; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(i + 1), 64, 68);
    });
    const plate = new THREE.Sprite(new THREE.SpriteMaterial({ map: numTex, transparent: true, depthWrite: false }));
    plate.position.set(p.x, p.y + 34, p.z);
    plate.scale.set(22, 22, 1);
    ringGroup.add(plate);
    // Light beam so the next ring can be found from anywhere.
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 900, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: PALETTE.ringNext, transparent: true, opacity: 0.0, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.set(p.x, p.y + 420, p.z);
    ringGroup.add(beam);
    rings.push({ x: p.x, y: p.y, z: p.z, radius: 26, mesh, beam, mat, done: false });
  });
  group.add(ringGroup);

  function setNextRing(idx) {
    rings.forEach((r, i) => {
      r.mat.color.setHex(r.done ? PALETTE.ringDone : (i === idx ? PALETTE.ringNext : PALETTE.ring));
      r.beam.material.opacity = i === idx ? 0.16 : 0;
      r.mesh.scale.setScalar(i === idx ? 1.15 : 1);
    });
  }
  setNextRing(0);

  // --- landmarks ---
  const landmarkGroup = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5230 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const pineMat = new THREE.MeshLambertMaterial({ color: 0x1f5138 });
  const wallMat = new THREE.MeshLambertMaterial({ color: 0xf2e3c6 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0xc65a3c });
  const windowMat = new THREE.MeshBasicMaterial({ color: timeName === 'noon' ? 0xffe9a8 : 0xffc857 });

  function addPalm(x, z) {
    const h = terrainHeight(x, z);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.1, 11, 6), trunkMat);
    trunk.position.y = 5.5; trunk.rotation.z = 0.12; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(1.6, 7, 4), leafMat);
      frond.position.y = 11.5;
      frond.rotation.z = Math.PI / 2.4;
      frond.rotation.y = (i / 6) * Math.PI * 2;
      frond.translateY(1.5);
      g.add(frond);
    }
    g.position.set(x, h, z);
    landmarkGroup.add(g);
  }
  function addPine(x, z) {
    const h = terrainHeight(x, z);
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.2, 5, 6), trunkMat);
    trunk.position.y = 2.5; g.add(trunk);
    for (let i = 0; i < 3; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(6 - i * 1.6, 9, 7), pineMat);
      cone.position.y = 7 + i * 5; g.add(cone);
    }
    g.position.set(x, h, z);
    landmarkGroup.add(g);
  }
  function addHouse(x, z, s = 1) {
    const h = terrainHeight(x, z);
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(10 * s, 6 * s, 9 * s), wallMat);
    walls.position.y = 3 * s; g.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5 * s, 4.5 * s, 4), roofMat);
    roof.position.y = 8 * s; roof.rotation.y = Math.PI / 4; g.add(roof);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2 * s, 2.2 * s), windowMat);
    win.position.set(0, 3.4 * s, 4.55 * s); g.add(win);
    g.position.set(x, h, z);
    g.rotation.y = rand.range(0, Math.PI * 2);
    landmarkGroup.add(g);
  }
  function addLighthouse(x, z, hgt) {
    const h = terrainHeight(x, z);
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(4, 6, hgt, 12), new THREE.MeshLambertMaterial({ color: 0xf5f0e1 }));
    tower.position.y = hgt / 2; g.add(tower);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.4, 5, 12), new THREE.MeshLambertMaterial({ color: 0xd94f30 }));
    band.position.y = hgt * 0.62; g.add(band);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(3.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    lamp.position.y = hgt + 2; g.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(4.4, 4, 10), new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    cap.position.y = hgt + 6; g.add(cap);
    g.position.set(x, h, z);
    landmarkGroup.add(g);
  }
  function addCityBlock(x, z, w, d, hgt) {
    const h = terrainHeight(x, z);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), new THREE.MeshLambertMaterial({ color: 0x5a6b7d }));
    m.position.set(x, h + hgt / 2, z);
    landmarkGroup.add(m);
    const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 3, d * 0.7), windowMat);
    top.position.set(x, h + hgt + 1.5, z);
    landmarkGroup.add(top);
  }

  for (const lm of island.landmarks) {
    if (lm.kind === 'lighthouse') addLighthouse(lm.x, lm.z, lm.h);
    else if (lm.kind === 'village') for (let i = 0; i < lm.houses; i++) addHouse(lm.x + rand.range(-90, 90), lm.z + rand.range(-90, 90), rand.range(0.8, 1.3));
    else if (lm.kind === 'palms') for (let i = 0; i < lm.count; i++) addPalm(lm.x + rand.range(-160, 160), lm.z + rand.range(-160, 160));
    else if (lm.kind === 'pines') for (let i = 0; i < lm.count; i++) addPine(lm.x + rand.range(-260, 260), lm.z + rand.range(-260, 260));
    else if (lm.kind === 'cabin') addHouse(lm.x, lm.z, 0.9);
    else if (lm.kind === 'city') for (let i = 0; i < lm.blocks; i++) addCityBlock(lm.x + rand.range(-260, 260), lm.z + rand.range(-260, 260), rand.range(18, 42), rand.range(18, 42), rand.range(22, 90));
    else if (lm.kind === 'cranes') for (let i = 0; i < lm.count; i++) {
      const cx = lm.x + i * 70, cz = lm.z;
      const ch = terrainHeight(cx, cz);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(6, 64, 6), new THREE.MeshLambertMaterial({ color: 0xd9a441 }));
      tower.position.set(cx, ch + 32, cz); landmarkGroup.add(tower);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(56, 3, 3), new THREE.MeshLambertMaterial({ color: 0xd9a441 }));
      arm.position.set(cx + 14, ch + 62, cz); landmarkGroup.add(arm);
    }
    else if (lm.kind === 'mesa') {
      const mh = terrainHeight(lm.x, lm.z);
      const mesa = new THREE.Mesh(new THREE.CylinderGeometry(lm.w * 0.55, lm.w * 0.8, lm.h, 4), new THREE.MeshLambertMaterial({ color: pal.rock }));
      mesa.position.set(lm.x, mh + lm.h / 2 - 10, lm.z);
      mesa.rotation.y = Math.PI / 4;
      landmarkGroup.add(mesa);
    } else if (lm.kind === 'pier') {
      const deck = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 180), new THREE.MeshLambertMaterial({ color: 0x8a6b45 }));
      deck.position.set(lm.x, 2.5, lm.z);
      landmarkGroup.add(deck);
    }
  }
  group.add(landmarkGroup);

  // --- clouds: soft blobs of flattened spheres, drifting with the wind ---
  const cloudTex = TEX.cloud ?? canvasTexture(128, 128, (g) => {
    const grad = g.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.7, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  });
  const clouds = [];
  const cloudCount = Math.round(26 + weather.cloud * 30);
  const cloudMat = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.85, depthWrite: false });
  for (let i = 0; i < cloudCount; i++) {
    const s = new THREE.Sprite(cloudMat);
    const sc = rand.range(120, 320);
    s.scale.set(sc, sc * 0.42, 1);
    s.position.set(rand.range(-2600, 2600), rand.range(480, 950), rand.range(-2600, 2600));
    group.add(s);
    clouds.push(s);
  }

  // --- rain / snow particles, only in the matching weather ---
  let precip = null;
  if (weather.rain || weather.snow) {
    const N = 1400;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pPos[i * 3] = rand.range(-300, 300);
      pPos[i * 3 + 1] = rand.range(0, 300);
      pPos[i * 3 + 2] = rand.range(-300, 300);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    precip = new THREE.Points(pGeo, new THREE.PointsMaterial({
      color: weather.snow ? 0xffffff : 0xaaccee, size: weather.snow ? 2.2 : 1.4,
      transparent: true, opacity: 0.7, sizeAttenuation: true,
    }));
    group.add(precip);
  }

  // --- lighting ---
  const sunLight = new THREE.DirectionalLight(time.sunColor, 1.6);
  sunLight.position.copy(sunDir).multiplyScalar(3000);
  group.add(sunLight);
  group.add(new THREE.AmbientLight(0xffffff, 0.25));
  const hemi = new THREE.HemisphereLight(time.sky, 0x334455, time.hemi);
  group.add(hemi);

  return {
    group,
    terrainHeight,
    rings,
    setNextRing,
    update(dt, camPos, elapsed) {
      for (const c of clouds) {
        c.position.x += (weather.wind * 0.514 * 0.4 + 1.2) * dt;
        if (c.position.x > 2800) c.position.x = -2800;
      }
      // Ring pulse: the next ring breathes.
      const t = elapsed * 2.2;
      rings.forEach((r, i) => {
        if (!r.done) r.mesh.rotation.z = Math.sin(t + i) * 0.06;
      });
      if (precip) {
        const p = precip.geometry.attributes.position;
        const fall = (weather.snow ? 26 : 120) * dt;
        for (let i = 0; i < p.count; i++) {
          let y = p.getY(i) - fall;
          if (y < 0) y = 300;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(elapsed + i) * 0.15);
        }
        p.needsUpdate = true;
        precip.position.set(camPos.x, camPos.y - 120, camPos.z);
      }
    },
  };
}

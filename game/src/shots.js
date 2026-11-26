// Screenshot staging for Golden Hour Courier — the scenes behind
// ?shot=start|play|end (with &seed=N). Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short game really looks like and the same
// seed always gives the same frame.

import { STEP } from './config.js';
import { EVENT_RING, EVENT_LANDED, EVENT_CRASH } from './physics.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 40;
const END_LIMIT_SECONDS = 350;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function normAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Carrot-chasing on the course line: aim 500 m ahead of the plane's
// projection onto the prev→ring line, never past the ring itself, so the
// final leg is a straight run through the centre instead of a turn around
// a point target (a banked point-chase is a stable orbit).
function approachAim(s, rings, next, overshoot = 0) {
  const ring = rings[next];
  const prev = next > 0 ? rings[next - 1] : { x: 0, y: ring.y, z: 1420 };
  const dx = ring.x - prev.x, dz = ring.z - prev.z;
  const dl = Math.hypot(dx, dz) || 1;
  const ux = dx / dl, uz = dz / dl;
  const along = (s.x - prev.x) * ux + (s.z - prev.z) * uz;
  const carrotAlong = Math.min(Math.max(along + 500, 0), dl + overshoot);
  return { x: prev.x + ux * carrotAlong, y: ring.y, z: prev.z + uz * carrotAlong };
}

// Autopilot: a P-controller on bank and pitch, aiming at a point beyond the
// target so the flight path runs straight through a ring instead of orbiting
// it. Throttle eases off close to a ring so the turn radius shrinks.
function autopilotInput(flight, target, opts = {}) {
  const s = flight.state;
  const dx = target.x - s.x, dz = target.z - s.z, dy = target.y - s.y;
  const dist = Math.hypot(dx, dy, dz);
  const desired = Math.atan2(dx, -dz);
  const err = normAngle(desired - s.heading);
  const desiredBank = clamp(err * 0.9, -0.85, 0.85);
  const roll = clamp((desiredBank - s.roll) * 2.5, -1, 1);
  // Climb with a base pitch while below the target, not just proportional to
  // the gap: a pure P-controller eases off too early and arrives under the ring.
  let desiredPitch = s.speed < 34 ? 0 : (dy > 0 ? clamp(0.12 + dy * 0.004, 0, 0.45) : clamp(dy * 0.004, -0.28, 0));
  // Terrain clearance: never let the ground catch up with the climb — but
  // never climb past the ring itself: the course hangs every ring at least
  // 130 m above the ground below it, so at ring altitude the plane is safe.
  // The guard below keeps the clearance push from fighting the descent onto
  // a ring that sits over a ridge.
  if (opts.terrainHeight && s.speed >= 34) { // only once she is flying
    const ground = opts.terrainHeight(s.x, s.z);
    if (s.y < target.y - 20) {
      if (s.y < ground + 90) desiredPitch = Math.max(desiredPitch, 0.5);
      else if (s.y < ground + 160) desiredPitch = Math.max(desiredPitch, 0.18);
    }
  }
  const pitch = clamp((s.pitch - desiredPitch) * 2.0, -1, 1);
  // Slow right down near a ring: a slow plane turns tight enough to thread it.
  const wantThrottle = s.speed < 45 ? 1 : (dist < 500 ? 0.45 : dist < 1000 ? 0.65 : (opts.throttle ?? 0.78));
  return {
    roll, pitch,
    throttleDelta: () => (flight.state.throttle < wantThrottle - 0.02 ? 1 : (flight.state.throttle > wantThrottle + 0.02 ? -1 : 0)),
    boost: () => false,
  };
}

// Landing autopilot: two phases, both flown by carrot-chasing so no point
// target is ever chased in a turn (that ends in a stable orbit).
//   JOIN: fly to a waypoint south of the field (0, 170, 2600) on the line from
//         wherever the plane is when the landing starts; capture within 250 m.
//   FINAL: ride the runway centreline from the entry (0, 2260) to the threshold
//         (0, 920) on the glide slope, gear down, flaps down, gentle touchdown.
let landingJoined = false;
let landPrev = null;
function landingInput(flight, runway, terrainHeight) {
  const s = flight.state;
  if (!landPrev) landPrev = { x: s.x, z: s.z, y: s.y };
  const threshold = { x: runway.x, z: runway.z - runway.length / 2 + 80 };
  const entry = { x: runway.x, z: runway.z + runway.length / 2 + 800 };
  const waypoint = { x: runway.x, y: 130, z: runway.z + runway.length / 2 + 1450 };
  // Go-around: flew past the threshold still high — circle back and try
  // again instead of orbiting the runway forever.
  if (landingJoined && s.z < threshold.z - 50 && s.y > 20) {
    landingJoined = false;
    landPrev = { x: s.x, z: s.z, y: s.y };
  }
  let target, targetAlt, wantThrottle;
  let descentFF = 0; // feedforward pitch for the glide slope
  if (!landingJoined) {
    const dW = Math.hypot(s.x - waypoint.x, s.y - waypoint.y, s.z - waypoint.z);
    if (dW < 250) landingJoined = true;
  }
  if (!landingJoined) {
    target = approachAim(s, [landPrev, waypoint], 1);
    targetAlt = Math.max(130, terrainHeight(s.x, s.z) + 130);
    wantThrottle = 0.5;
  } else {
    target = approachAim(s, [entry, threshold], 1, 400); // carrot runs 400 m past the threshold
    const ground = terrainHeight(s.x, s.z);
    const along = (s.x - entry.x) * 0 + (s.z - entry.z) * -1; // entry->threshold runs north (-z)
    // Let the glide target run BELOW the threshold height past the threshold
    // (floor 5 m, just under the gear): a target of exactly 8 m makes the
    // plane porpoise on it forever and never touch the runway.
    targetAlt = along < 0 ? Math.max(130, ground + 130) : Math.max(5, 8 + (s.z - threshold.z) * 0.09);
    if (along >= 0) descentFF = -0.13; // on the glide: hold the slope rate
    wantThrottle = 0.3;
  }
  // Same P-controller as the ring autopilot.
  const dx = target.x - s.x, dz = target.z - s.z, dy = targetAlt - s.y;
  const dist = Math.hypot(dx, dy, dz);
  const desired = Math.atan2(dx, -dz);
  const err = normAngle(desired - s.heading);
  const desiredBank = clamp(err * 0.9, -0.85, 0.85);
  const roll = clamp((desiredBank - s.roll) * 2.5, -1, 1);
  const desiredPitch = s.speed < 20 ? 0 : (dy > 0 ? clamp(0.12 + dy * 0.004, 0, 0.45) : clamp(descentFF + dy * 0.015, -0.28, 0));
  const pitch = clamp((s.pitch - desiredPitch) * 8.0, -1, 1); // stiff: beat the pitch auto-centre
  return {
    roll, pitch,
    throttleDelta: () => (flight.state.throttle < wantThrottle - 0.02 ? 1 : (flight.state.throttle > wantThrottle + 0.02 ? -1 : 0)),
    boost: () => false,
  };
}

export function stageShot(name, ctx) {
  const { flight, world, mission } = ctx;
  const rings = world.rings;
  if (name !== 'play' && name !== 'end') {
    // Title scene: the plane sits on the runway, engine idling, the island
    // and the first ring ahead in the golden light.
    flight.state.throttle = 0.25;
    for (let i = 0; i < START_SECONDS / STEP; i++) {
      flight.step(STEP, { roll: 0, pitch: 0, throttleDelta: () => 0, boost: () => false }, [], 0);
    }
    return { screen: 'title', mission };
  }
  if (name === 'play') {
    // Fly the mail run: take off, climb to the first ring, thread rings.
    let next = 0;
    for (let i = 0; i < PLAY_SECONDS / STEP; i++) {
      // Aim straight at the ring centre: a point beyond the ring pulls the
      // pursuit curve off the centre and the plane ends up orbiting it.
      const target = next < rings.length ? approachAim(flight.state, rings, next) : { x: 0, y: 400, z: 0 };
      const ev = flight.step(STEP, autopilotInput(flight, target, { terrainHeight: world.terrainHeight }), rings, next);
      mission.tick(STEP, flight, ev);
      if (ev & EVENT_RING) { // EVENT_RING
        next += 1;
        mission.nextRing = next;
        world.setNextRing(next);
      }
      if (flight.state.crashed || flight.state.landed) break;
    }
    return { screen: 'play', mission };
  }
  // End scene: fly the whole run on autopilot, then land (or crash trying).
  // The end-scene pilot flies harder than the play-scene one: full cruise,
  // tighter banks, so the run fits inside the mission clock.
  let next = 0;
  let landed = false;
  landingJoined = false;
  landPrev = null;
  for (let i = 0; i < END_LIMIT_SECONDS / STEP; i++) {
    let ev;
    if (next < rings.length) {
      ev = flight.step(STEP, autopilotInput(flight, approachAim(flight.state, rings, next), { throttle: 0.85, terrainHeight: world.terrainHeight }), rings, next);
      if (ev & EVENT_RING) { next += 1; mission.nextRing = next; world.setNextRing(next); }
    } else {
      flight.state.gear = true;
      flight.state.flaps = true;
      ev = flight.step(STEP, landingInput(flight, { x: 0, z: 1150, length: 620 }, world.terrainHeight), [], 0);
    }
    mission.tick(STEP, flight, ev);
    const nearRing = next < rings.length && Math.hypot(flight.state.x - rings[next].x, flight.state.y - rings[next].y, flight.state.z - rings[next].z) < 500;
    if (ctx.debug && (i % 60 === 0 || nearRing)) {
      const s = flight.state;
      const rg = next < rings.length ? rings[next] : null;
      const aim = next < rings.length ? approachAim(s, rings, next) : null;
      console.log(`[end] t=${s.time.toFixed(0)}s next=${next} ring=${rg ? `${rg.x.toFixed(0)},${rg.y.toFixed(0)},${rg.z.toFixed(0)}` : '-'} aim=${aim ? `${aim.x.toFixed(0)},${aim.y.toFixed(0)},${aim.z.toFixed(0)}` : '-'} x=${s.x.toFixed(0)} y=${s.y.toFixed(0)} z=${s.z.toFixed(0)} g=${world.terrainHeight(s.x, s.z).toFixed(0)} hdg=${(s.heading * 180 / Math.PI).toFixed(0)} spd=${(s.speed * 1.944).toFixed(0)}kt vy=${s.vy.toFixed(1)} pitch=${s.pitch.toFixed(2)} roll=${s.roll.toFixed(2)} thr=${s.throttle.toFixed(2)} fuel=${s.fuel.toFixed(0)} joined=${landingJoined}`);
    }
    if (ev & EVENT_LANDED) { landed = true; break; }
    if (ev & EVENT_CRASH) break;
    if (flight.state.crashed || flight.state.landed) break;
  }
  if (landed) mission.finish('landed', flight, flight.landingQuality());
  else if (flight.state.crashed) mission.finish('crash', flight);
  else mission.finish('timeout', flight);
  return { screen: 'end', mission };
}

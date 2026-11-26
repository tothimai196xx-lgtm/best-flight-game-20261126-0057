// Flight model for Golden Hour Courier — an arcade model with real bones:
// throttle sets a target speed, bank turns the heading, pitch trades speed for
// altitude, slow flight stalls and sinks, wind pushes and gusts, and a landing
// is only a landing when it is slow, gentle, lined up and on the gear.
// Units: metres, seconds, radians internally; the HUD converts to ft / kt.

import { WORLD, RUNWAY, SCORE } from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1 << 0;
export const EVENT_PERFECT_RING = 1 << 1;
export const EVENT_LANDED = 1 << 2;
export const EVENT_CRASH = 1 << 3;
export const EVENT_FUEL_EMPTY = 1 << 4;
export const EVENT_STALL = 1 << 5;
export const EVENT_OUT_OF_BOUNDS = 1 << 6;

const KT = 1.94384; // m/s -> knots
const FT = 3.28084; // m -> feet

export function createFlight(aircraft, island, weather, terrainHeight) {
  const start = { x: RUNWAY.x, z: RUNWAY.z + RUNWAY.length / 2 - 40, y: 2 };
  const state = {
    // Start on the ground wherever the terrain is, not at an absolute height.
    x: start.x, y: terrainHeight(start.x, start.z) + 1.2, z: start.z,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, // m/s
    throttle: 0,
    fuel: aircraft.tank,
    gear: true, flaps: false,
    airborne: false,
    vy: 0, vspeed: 0,
    score: 0, ringsHit: 0, streak: 0,
    time: 0, landed: false, crashed: false, outOfFuel: false,
    windDir: weather.windDir ?? 2.2, // radians, blowing FROM
    windSpeed: weather.wind, // m/s-ish (kt stored as-is, scaled in use)
    gustPhase: Math.random() * 100,
    slipstream: 0, // seconds of boost left from a perfect ring
    lastStallWarn: -10,
  };

  function groundAt(x, z) { return terrainHeight(x, z); }

  function step(dt, input, rings, nextRingIndex) {
    if (state.landed || state.crashed) return EVENT_NONE;
    let events = EVENT_NONE;
    state.time += dt;

    // --- throttle ---
    const tDelta = input.throttleDelta ? input.throttleDelta() : 0;
    state.throttle = Math.max(0, Math.min(1, state.throttle + tDelta * dt * 0.55));
    if (state.outOfFuel) state.throttle = 0;
    const boosting = input.boost && input.boost() && state.fuel > 0 && state.airborne;

    // --- fuel ---
    const burn = (0.04 + state.throttle * 0.10) / Math.max(0.35, aircraft.fuel) + (boosting ? 0.25 : 0);
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0 && !state.outOfFuel) { state.outOfFuel = true; events |= EVENT_FUEL_EMPTY; }

    // --- gusts: smooth pseudo-random wind variation ---
    state.gustPhase += dt * 0.7;
    const gust = Math.sin(state.gustPhase) * Math.sin(state.gustPhase * 2.7) * weather.gust * 0.514;
    const windKt = weather.wind + gust;
    const windX = Math.sin(state.windDir) * windKt * 0.514 * 0.35;
    const windZ = Math.cos(state.windDir) * windKt * 0.514 * 0.35;

    // --- controls (mushy below stall, sluggish in gusts) ---
    const handling = weather.handling * (state.speed < aircraft.stall * 0.514 ? 0.55 : 1);
    const rollRate = 1.9 * aircraft.turn * handling;
    const pitchRate = 1.35 * aircraft.agility * handling;
    state.roll += input.roll * rollRate * dt;
    state.roll = Math.max(-1.15, Math.min(1.15, state.roll));
    // Roll eases back toward level when the stick is centred.
    if (Math.abs(input.roll) < 0.05) state.roll *= Math.max(0, 1 - 1.4 * dt * aircraft.stability);
    state.pitch += -input.pitch * pitchRate * dt * 0.55;
    state.pitch = Math.max(-0.5, Math.min(0.62, state.pitch));
    if (Math.abs(input.pitch) < 0.05) state.pitch *= Math.max(0, 1 - 0.9 * dt);

    // --- speed: throttle pulls toward a target; drag and climb bleed it ---
    const stallMs = aircraft.stall * 0.514;
    const maxMs = aircraft.maxSpeed * 0.514 * (boosting ? 1.28 : 1);
    const targetMs = stallMs + state.throttle * (maxMs - stallMs);
    const climbBleed = Math.max(0, state.pitch) * 6 * dt * aircraft.climb;
    const accel = (targetMs - state.speed) * 0.55 * dt;
    state.speed = Math.max(0, state.speed + accel - climbBleed);
    if (state.slipstream > 0) { state.speed += 4 * dt; state.slipstream -= dt; }

    // --- heading follows the bank (coordinated turn) ---
    const turnRate = (state.roll * 0.55 * (state.speed / Math.max(20, aircraft.cruise * 0.514))) * aircraft.turn;
    state.heading += turnRate * dt * (state.airborne ? 1 : 0.25);

    // --- vertical: pitch + lift; below stall the wing gives up (in the air only) ---
    const lift = Math.min(1, state.speed / Math.max(1, stallMs * 1.25));
    let vy = Math.sin(state.pitch) * state.speed * lift;
    if (state.speed < stallMs && state.airborne) {
      vy -= (stallMs - state.speed) * 0.9; // sinking
      if (state.time - state.lastStallWarn > 3 && state.airborne) { state.lastStallWarn = state.time; events |= EVENT_STALL; }
    }
    if (state.flaps) vy += 0.4; // flaps add a touch of lift at low speed
    state.vy = vy;
    state.vspeed = vy * 196.85; // ft/min

    // --- integrate ---
    const fx = Math.sin(state.heading), fz = -Math.cos(state.heading);
    const cp = Math.cos(state.pitch);
    state.x += (fx * cp * state.speed + windX) * dt;
    state.z += (fz * cp * state.speed + windZ) * dt;
    state.y += vy * dt;

    // --- ground / water ---
    const g = groundAt(state.x, state.z);
    const onRunway = Math.abs(state.x - RUNWAY.x) < RUNWAY.width / 2 + 6 &&
      Math.abs(state.z - RUNWAY.z) < RUNWAY.length / 2 + 10;
    const overWater = g <= WORLD.waterLevel + 0.4;
    if (state.y <= g + 1.2) {
      state.y = g + 1.2;
      if (!state.airborne) {
        // Rolling on the ground: she sits on her gear, no sink, no crash.
        state.vy = 0;
      } else if (onRunway && state.gear && Math.abs(vy) < 5.5 && state.speed < 52 && Math.abs(state.roll) < 0.35 && Math.abs(state.pitch) < 0.22) {
        state.landed = true;
        events |= EVENT_LANDED;
      } else if (overWater && aircraft.id === 'heron' && Math.abs(vy) < 4.5 && state.speed < 45) {
        state.landed = true; // the seaplane settles on the lagoon
        events |= EVENT_LANDED;
      } else if (state.speed < 6 && Math.abs(vy) < 3 && !state.airborne) {
        // gentle stop on the ground — a field landing, counts as a crash-free end
        state.landed = true;
        events |= EVENT_LANDED;
      } else {
        state.crashed = true;
        events |= EVENT_CRASH;
      }
    }
    if (state.y > g + 8) state.airborne = true; // airborne means clear of the ground below
    if (state.y < 40 && state.speed < 8 && !state.airborne) state.airborne = false;

    // --- out of bounds: soft wall with a nudge home ---
    const r = Math.hypot(state.x, state.z);
    if (r > WORLD.half + 500) {
      events |= EVENT_OUT_OF_BOUNDS;
      const home = Math.atan2(-state.x, -state.z); // heading that points home
      let diff = home - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += Math.max(-0.4, Math.min(0.4, diff)) * dt * 0.8;
    }

    // --- rings: only the next ring is live ---
    if (rings && nextRingIndex < rings.length) {
      const ring = rings[nextRingIndex];
      const dx = state.x - ring.x, dy = state.y - ring.y, dz = state.z - ring.z;
      const d = Math.hypot(dx, dy, dz);
      if (d < ring.radius) {
        state.ringsHit += 1;
        state.streak += 1;
        let pts = SCORE.ring + Math.min(4, state.streak - 1) * SCORE.ringStreak;
        if (d < 9) { pts += SCORE.perfectRing; state.slipstream = 2.5; events |= EVENT_PERFECT_RING; }
        state.score += pts;
        events |= EVENT_RING;
      }
    }
    return events;
  }

  return {
    state,
    step,
    addScore(n) { state.score += n; },
    landingQuality() {
      // 0..1: gentle + centred + slow = good
      const centre = 1 - Math.min(1, Math.abs(state.x - RUNWAY.x) / (RUNWAY.width / 2 + 6));
      const soft = 1 - Math.min(1, Math.abs(state.vy) / 5.5);
      const slow = 1 - Math.min(1, Math.max(0, state.speed - 28) / 24);
      return Math.max(0, Math.min(1, centre * 0.4 + soft * 0.4 + slow * 0.2));
    },
    toDisplay() {
      const hdg = ((state.heading * 180 / Math.PI) % 360 + 360) % 360;
      return {
        x: state.x, z: state.z,
        speedKt: Math.round(state.speed * KT),
        altFt: Math.max(0, Math.round(state.y * FT)),
        heading: Math.round(hdg),
        vsi: Math.round(state.vspeed),
        fuel: Math.max(0, Math.round(state.fuel)),
        score: state.score,
        rings: state.ringsHit,
        time: state.time,
        airborne: state.airborne,
        compass: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(hdg / 45) % 8],
      };
    },
  };
}

// Missions for Golden Hour Courier — the mail run state machine: ring order,
// timer, landing judgement, radio chatter and the final score breakdown.

import { MISSIONS, RADIO, SCORE, MEDALS } from './config.js';
import { createRandom } from './random.js';

export function createMission(missionId, island, aircraft, weather) {
  const def = MISSIONS.find((m) => m.id === missionId) || MISSIONS[0];
  const rand = createRandom(island.seed + missionId.length * 131);
  const radio = [...RADIO];
  let radioIdx = Math.floor(rand.next() * radio.length);
  let nextRadioAt = 12;

  const mission = {
    def,
    nextRing: 0,
    ringsTotal: def.rings,
    timeLeft: def.timeLimit,
    finished: false,
    result: null, // 'landed' | 'crash' | 'fuel' | 'timeout' | 'quit'
    landQuality: 0,
    radioLine: null,
    radioUntil: 0,
    ringTimes: [],
    startFuel: aircraft.tank,

    tick(dt, flight, events) {
      if (this.finished) return;
      if (def.timeLimit > 0) {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) { this.timeLeft = 0; this.finish('timeout', flight); return; }
      }
      // Radio chatter every ~25 seconds.
      nextRadioAt -= dt;
      if (nextRadioAt <= 0) {
        this.radioLine = radio[radioIdx % radio.length];
        radioIdx += 1;
        this.radioUntil = 6;
        nextRadioAt = 22 + rand.next() * 10;
      }
      if (this.radioUntil > 0) this.radioUntil -= dt;
      else this.radioLine = null;
    },

    finish(result, flight, landQuality = 0) {
      if (this.finished) return;
      this.finished = true;
      this.result = result;
      this.landQuality = landQuality;
      const f = flight.state;
      const timeUsed = f.time;
      let landingPts = 0;
      if (result === 'landed') {
        landingPts = Math.round(def.landingPoints * (0.45 + 0.55 * landQuality));
        if (landQuality > 0.85) landingPts += SCORE.landingSoft;
        if (f.ringsHit >= def.rings && def.rings > 0) landingPts += SCORE.landingCentre;
        f.score += landingPts;
      }
      let timeBonus = 0;
      if (result === 'landed' && def.timeLimit > 0 && f.ringsHit >= def.rings) {
        timeBonus = Math.round(this.timeLeft * SCORE.timeBonusPerSecond);
        f.score += timeBonus;
      }
      const medal = result === 'landed'
        ? (MEDALS.find((m) => f.score >= m.min) || MEDALS[MEDALS.length - 1])
        : { min: 0, name: 'No medal', emoji: result === 'crash' ? '🌊' : result === 'fuel' ? '⛽' : '⏰' };
      this.result = result;
      this.breakdown = {
        rings: f.ringsHit,
        ringsTotal: def.rings,
        ringPoints: f.ringsHit * SCORE.ring,
        landingPoints: landingPts,
        timeBonus,
        timeUsed: Math.round(timeUsed),
        timeLeft: Math.round(this.timeLeft),
        fuelLeft: Math.max(0, Math.round(f.fuel)),
        score: f.score,
        medal,
        perfect: result === 'landed' && f.ringsHit >= def.rings && landQuality > 0.85,
      };
    },

    title() {
      if (this.result === 'landed' && this.breakdown?.perfect) return 'A perfect round!';
      if (this.result === 'landed') return this.breakdown.rings >= def.rings ? 'Mail delivered!' : 'Down safe — mail short';
      if (this.result === 'crash') return 'Down in the drink…';
      if (this.result === 'fuel') return 'Out of fuel';
      if (this.result === 'timeout') return 'The bell already rang';
      return 'Flight over';
    },

    subtitle() {
      if (this.result === 'landed') return `Runway 09, ${island.name}. The depot stamps your card ${this.breakdown.medal.emoji} ${this.breakdown.medal.name}.`;
      if (this.result === 'crash') return 'The plane is a write-off, the mail is soggy, and the depot is already writing the report.';
      if (this.result === 'fuel') return 'She glided as far as she could. The villages will wait one more day.';
      if (this.result === 'timeout') return 'The depot bell rang at 17:40. The mail sleeps on the plane tonight.';
      return 'The sky is still there tomorrow.';
    },
  };
  return mission;
}

// Golden Hour Courier — every tuning number, aircraft, island, weather preset and
// mission in one place. Nothing here is copied from another game: the Meridian
// Archipelago, its pilots, its mail routes and its aircraft are invented for this game.

export const STEP = 1 / 60; // fixed simulation step, seconds
export const WORLD = { size: 5200, half: 2600, waterLevel: 0, maxAlt: 2600 };
export const RUNWAY = { x: 0, z: 1150, heading: 0, length: 620, width: 46 };

// ---------------------------------------------------------------------------
// Aircraft — five mail planes, each a different trade of speed, agility, fuel
// and landing manners. Stats are 0..1 except where noted; the physics module
// turns them into real numbers.
// ---------------------------------------------------------------------------
export const AIRCRAFT = [
  {
    id: 'otter',
    name: 'Otter DHC-2',
    tag: 'The workhorse',
    desc: 'Slow, honest, floats forever. Huge wings, forgiving stall, sips fuel. The plane the old mail pilots swear by.',
    color: 0xd94f30, accent: 0xf5f0e1, speed: 0.45, agility: 0.55, fuel: 1.0, stability: 0.95,
    maxSpeed: 118, cruise: 82, climb: 0.9, turn: 0.75, stall: 42, tank: 100,
    blurb: 'Cruise 82 kt · Stall 42 kt · Tank 100%',
  },
  {
    id: 'kestrel',
    name: 'Kestrel S-1',
    tag: 'The sportster',
    desc: 'A tiny aerobatic dart with a big engine. Turns on a coin, climbs like a rocket, drinks fuel and punishes sloppy landings.',
    color: 0x2f7fd9, accent: 0xffe14d, speed: 0.85, agility: 1.0, fuel: 0.55, stability: 0.5,
    maxSpeed: 168, cruise: 122, climb: 1.5, turn: 1.35, stall: 58, tank: 62,
    blurb: 'Cruise 122 kt · Stall 58 kt · Tank 62%',
  },
  {
    id: 'albatross',
    name: 'Albatross C-9',
    tag: 'The heavy lifter',
    desc: 'Twin-engine cargo hauler. Carries the whole archipelago\'s parcels in one go. Slow to turn, rock-steady in gusts, lands like a truck.',
    color: 0x3d9970, accent: 0xd8dee9, speed: 0.6, agility: 0.4, fuel: 0.8, stability: 1.0,
    maxSpeed: 132, cruise: 96, climb: 0.8, turn: 0.55, stall: 52, tank: 110,
    blurb: 'Cruise 96 kt · Stall 52 kt · Tank 110%',
  },
  {
    id: 'heron',
    name: 'Heron SF-4',
    tag: 'The seaplane',
    desc: 'Floats on her belly and lands on water as happily as on tarmac. Perfect for the lagoon villages; just mind the crosswind on the floats.',
    color: 0xe8b93e, accent: 0x17324a, speed: 0.55, agility: 0.7, fuel: 0.85, stability: 0.8,
    maxSpeed: 126, cruise: 90, climb: 1.0, turn: 0.9, stall: 46, tank: 88,
    blurb: 'Cruise 90 kt · Stall 46 kt · Tank 88% · Water landings OK',
  },
  {
    id: 'comet',
    name: 'Comet X-77',
    tag: 'The record breaker',
    desc: 'A polished silver rocket built for the annual Golden Hour Race. Fastest thing with a propeller over the Meridian Sea — and the thirstiest.',
    color: 0xc0c8d4, accent: 0xd94f30, speed: 1.0, agility: 0.8, fuel: 0.4, stability: 0.6,
    maxSpeed: 196, cruise: 148, climb: 1.7, turn: 1.05, stall: 64, tank: 55,
    blurb: 'Cruise 148 kt · Stall 64 kt · Tank 55%',
  },
];

// ---------------------------------------------------------------------------
// Islands — four places in the Meridian Archipelago. Each one is a full world:
// terrain seed, palette, landmarks, ring course, runway, weather bias.
// ---------------------------------------------------------------------------
export const ISLANDS = [
  {
    id: 'meridian',
    name: 'Meridian Atoll',
    tag: 'Home base · golden hour',
    desc: 'Turquoise lagoon, white sand, palm groves and the red-roofed mail depot. The classic run: eight rings over the reef, home to runway 09.',
    seed: 1123,
    palette: { sand: 0xe8d9a0, grass: 0x4f9e57, deepGrass: 0x2e7d46, rock: 0x8a7f74, snow: 0xf4f7f5, water: 0x1b6f8f, waterDeep: 0x0d4a66, sky: 0xffb36b, fog: 0xffc98a },
    terrain: { base: 26, amp: 150, peak: 420, beach: 6 },
    landmarks: [
      { kind: 'lighthouse', x: -780, z: -420, h: 64 },
      { kind: 'village', x: 420, z: 620, houses: 14 },
      { kind: 'palms', x: -320, z: 900, count: 26 },
      { kind: 'palms', x: 760, z: -180, count: 18 },
      { kind: 'village', x: -620, z: 1180, houses: 9 },
      { kind: 'pier', x: 180, z: 1420 },
    ],
    rings: 8, ringAlt: 420, ringSpread: 1500,
    weatherBias: 'clear', timeOfDay: 'golden',
    lore: 'The depot bell rings at 17:40 sharp. Miss it and the mail sleeps on the plane.',
  },
  {
    id: 'frostpeak',
    name: 'Frostpeak Range',
    tag: 'Snow mountains · dawn',
    desc: 'Granite teeth under fresh snow, pine forests in the valleys, a frozen lake for a runway. Thin cold air, hard turns, rings threaded between the peaks.',
    seed: 7741,
    palette: { sand: 0xcfd8dc, grass: 0x3a6b4f, deepGrass: 0x24402e, rock: 0x6e6a66, snow: 0xf8fbff, water: 0x2c5f7c, waterDeep: 0x16394f, sky: 0x9fc4e8, fog: 0xcfe0ee },
    terrain: { base: 60, amp: 420, peak: 1150, beach: 2 },
    landmarks: [
      { kind: 'village', x: -240, z: 700, houses: 11 },
      { kind: 'pines', x: 500, z: -600, count: 60 },
      { kind: 'pines', x: -900, z: 300, count: 48 },
      { kind: 'cabin', x: 980, z: 940 },
      { kind: 'lighthouse', x: 1120, z: -900, h: 52 },
    ],
    rings: 8, ringAlt: 700, ringSpread: 1700,
    weatherBias: 'snow', timeOfDay: 'dawn',
    lore: 'Old pilots say Frostpeak keeps one ring hidden behind the north tooth. It does not. It keeps two.',
  },
  {
    id: 'sunsetcity',
    name: 'Port Aurelia',
    tag: 'Harbour city · dusk',
    desc: 'A working harbour at dusk: cranes, container stacks, a lit-up waterfront and the mail runway squeezed between the docks and the sea wall.',
    seed: 3390,
    palette: { sand: 0xb8a88a, grass: 0x5a7d4f, deepGrass: 0x3c5a37, rock: 0x7d7468, snow: 0xe8e4da, water: 0x274b63, waterDeep: 0x142c40, sky: 0xe86a92, fog: 0xf2a56b },
    terrain: { base: 18, amp: 90, peak: 260, beach: 4 },
    landmarks: [
      { kind: 'city', x: -560, z: -260, blocks: 26 },
      { kind: 'cranes', x: -900, z: 620, count: 5 },
      { kind: 'village', x: 700, z: 480, houses: 12 },
      { kind: 'pier', x: -300, z: 1500 },
      { kind: 'lighthouse', x: 1250, z: 300, h: 58 },
    ],
    rings: 8, ringAlt: 380, ringSpread: 1400,
    weatherBias: 'clear', timeOfDay: 'dusk',
    lore: 'The harbourmaster waves a green lamp when the runway is clear. Red means a freighter is crossing. Wait for green.',
  },
  {
    id: 'ember',
    name: 'Ember Dunes',
    tag: 'Desert canyon · noon',
    desc: 'Red rock canyons, a dry riverbed, dust devils and a heat-haze runway. The rings hang low between the mesas and the wind never sits still.',
    seed: 9021,
    palette: { sand: 0xd9a05b, grass: 0x8a7a3d, deepGrass: 0x6b5d2e, rock: 0xa44a2e, snow: 0xe8dcc8, water: 0x3d7a8c, waterDeep: 0x1e4a5a, sky: 0x7ec3e8, fog: 0xe8c98f },
    terrain: { base: 34, amp: 210, peak: 640, beach: 3 },
    landmarks: [
      { kind: 'mesa', x: -700, z: -700, w: 320, h: 210 },
      { kind: 'mesa', x: 800, z: -500, w: 260, h: 170 },
      { kind: 'village', x: 120, z: 820, houses: 10 },
      { kind: 'cabin', x: -1000, z: 900 },
      { kind: 'palms', x: 300, z: -1100, count: 12 },
    ],
    rings: 8, ringAlt: 460, ringSpread: 1600,
    weatherBias: 'dust', timeOfDay: 'noon',
    lore: 'Desert mail is paid by the kilo and the kilo is paid in water. Fly low, fly straight, do not chase the dust devils.',
  },
];

// ---------------------------------------------------------------------------
// Weather — five conditions, each changing wind, visibility, light and handling.
// ---------------------------------------------------------------------------
export const WEATHER = [
  { id: 'clear', name: 'Clear skies', desc: 'Light breeze, endless visibility. The postcard day.', wind: 8, gust: 4, vis: 1.0, rain: 0, cloud: 0.35, handling: 1.0 },
  { id: 'breeze', name: 'Sea breeze', desc: 'A steady 18 kt push off the water. Rings drift; hold your line.', wind: 18, gust: 9, vis: 0.95, rain: 0, cloud: 0.5, handling: 0.95 },
  { id: 'storm', name: 'Storm front', desc: '32 kt gusts, rain, low cloud. Only the stubborn fly — the mail pays double.', wind: 32, gust: 18, vis: 0.6, rain: 1, cloud: 0.95, handling: 0.8 },
  { id: 'fog', name: 'Morning fog', desc: 'Visibility down to a whisper. Fly by the compass and the beacon, not your eyes.', wind: 5, gust: 2, vis: 0.35, rain: 0, cloud: 0.7, handling: 1.0 },
  { id: 'snow', name: 'Snow squall', desc: 'Wet snow, grey light, slick runway. Frostpeak weather, wherever you are.', wind: 14, gust: 10, vis: 0.55, rain: 0, cloud: 0.9, handling: 0.9, snow: 1 },
  { id: 'dust', name: 'Dust haze', desc: 'Hot wind off the dunes, everything the colour of old paper.', wind: 22, gust: 12, vis: 0.7, rain: 0, cloud: 0.4, handling: 0.92 },
];

// Times of day: sun angle, sky colours, light warmth.
export const TIMES = {
  dawn:   { sun: 0.16, sky: 0xffd9a0, horizon: 0xff9d7a, sunColor: 0xffd9a8, hemi: 0.75, fog: 0xe8c9a8 },
  noon:   { sun: 1.15, sky: 0x6fb7e8, horizon: 0xcfe8f5, sunColor: 0xfff6d8, hemi: 1.0, fog: 0xcfe0ee },
  golden: { sun: 0.30, sky: 0xff9e5e, horizon: 0xffc27a, sunColor: 0xffb36b, hemi: 0.9, fog: 0xffc98a },
  dusk:   { sun: 0.10, sky: 0x7a5a9e, horizon: 0xe86a92, sunColor: 0xff8f6b, hemi: 0.6, fog: 0xd98a7a },
};

// ---------------------------------------------------------------------------
// Missions — the mail runs. Each is a ring course plus a landing, scored.
// ---------------------------------------------------------------------------
export const MISSIONS = [
  {
    id: 'mail-run',
    name: 'Island Mail Run',
    desc: 'Eight rings in order, then land on runway 09. The daily round — every village gets its post.',
    rings: 8, timeLimit: 360, ringPoints: 250, landingPoints: 1000,
    brief: 'Depot to depot. Rings in order, runway at the end. Mind the fuel.',
  },
  {
    id: 'express',
    name: 'Express Parcel Dash',
    desc: 'Six rings, tighter turns, a 150-second clock. The urgent parcel does not wait for weather.',
    rings: 6, timeLimit: 150, ringPoints: 300, landingPoints: 800,
    brief: 'Six rings, fast. The parcel is marked URGENT in red ink.',
  },
  {
    id: 'free',
    name: 'Free Flight',
    desc: 'No timer, no rings required. Just you, the plane and the golden hour. Land whenever you like.',
    rings: 0, timeLimit: 0, ringPoints: 250, landingPoints: 500,
    brief: 'No clock. No route. Just fly.',
  },
];

// Radio chatter the depot plays as you fly — flavour that makes the world alive.
export const RADIO = [
  'Depot: Otter Two-Seven, wind 090 at 8, runway 09 clear for the mail run.',
  'Depot: ring two is over the reef — watch the gulls, they own that airspace.',
  'Villager: the children are waving from the pier. Dip a wing if you can.',
  'Depot: fuel check, pilot. The gauge does not lie, even when we wish it would.',
  'Harbour: freighter crossing the bay, keep your altitude over the water.',
  'Depot: beautiful flying. The old-timers would approve. Mostly.',
  'Villager: grandmother says the parcel smells of cinnamon. It does. It always does.',
  'Depot: last ring ahead. Bring her home gentle — the runway is not a suggestion.',
];

// Scoring.
export const SCORE = {
  ring: 250, ringStreak: 50, perfectRing: 100, // centred pass bonus
  landing: 1000, landingSoft: 400, landingCentre: 300,
  timeBonusPerSecond: 5, crash: 0, outOfFuel: 0,
};
export const MEDALS = [
  { min: 4200, name: 'Golden Wings', emoji: '🏆' },
  { min: 3200, name: 'Silver Propeller', emoji: '🥈' },
  { min: 2200, name: 'Bronze Compass', emoji: '🥉' },
  { min: 0, name: 'Mail Delivered', emoji: '✉️' },
];

export const BEST_KEY = 'golden-hour-courier.best';
export const PALETTE = {
  hud: '#dff4ff', amber: '#ffc857', green: '#7dff9e', red: '#ff6b6b',
  ring: 0xffc857, ringNext: 0x7dff9e, ringDone: 0x38bdf8,
};
export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

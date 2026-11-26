// Aircraft meshes for Golden Hour Courier — every plane is built from primitives
// in code (no downloaded models): fuselage, wings, tail, propeller, floats or
// twin nacelles per type, painted in the aircraft's own colours.

import * as THREE from '../vendor/three.min.js';

function mat(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}

export function buildAircraft(aircraft) {
  const group = new THREE.Group();
  const body = mat(aircraft.color);
  const accent = mat(aircraft.accent);
  const dark = mat(0x22282f);
  const glass = new THREE.MeshPhongMaterial({ color: 0x9fd8ff, shininess: 160, specular: 0xffffff });

  // Fuselage: nose cone + cylinder body + tapered tail cone.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.05, 3.2, 12), accent);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, -3.4);
  group.add(nose);
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.85, 6.4, 12), body);
  fus.rotation.x = Math.PI / 2;
  fus.position.set(0, 0, 0.4);
  group.add(fus);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.85, 3.4, 12), body);
  tail.rotation.x = -Math.PI / 2;
  tail.position.set(0, 0.15, 5.2);
  group.add(tail);

  // Canopy.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8), glass);
  canopy.scale.set(0.9, 0.62, 1.7);
  canopy.position.set(0, 0.75, -1.2);
  group.add(canopy);

  // Main wing + tailplane + fin.
  const wingSpan = aircraft.id === 'albatross' ? 17 : aircraft.id === 'otter' ? 15 : 12.5;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(wingSpan, 0.28, 2.6), accent);
  wing.position.set(0, 0.1, -0.6);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 2.6), body);
  wingTipL.position.set(-wingSpan / 2, 0.1, -0.6); group.add(wingTipL);
  const wingTipR = wingTipL.clone(); wingTipR.position.x = wingSpan / 2; group.add(wingTipR);
  const tailplane = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 1.6), accent);
  tailplane.position.set(0, 0.35, 6.2);
  group.add(tailplane);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.4, 2.2), body);
  fin.position.set(0, 1.3, 6.4);
  group.add(fin);

  // Propeller (spins in render) or twin nacelles for the Albatross.
  let prop = null;
  if (aircraft.id === 'albatross') {
    for (const s of [-1, 1]) {
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.6, 3.4, 10), dark);
      nac.rotation.x = Math.PI / 2;
      nac.position.set(s * 4.2, -0.1, -1.4);
      group.add(nac);
      const p = new THREE.Group();
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.4, 0.12), dark);
        blade.rotation.z = (b / 3) * Math.PI * 2;
        p.add(blade);
      }
      p.position.set(s * 4.2, -0.1, -3.3);
      group.add(p);
      if (!prop) prop = p;
      else prop.userData.twin = p;
    }
  } else {
    prop = new THREE.Group();
    for (let b = 0; b < (aircraft.id === 'comet' ? 4 : 3); b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.26, 4.6, 0.14), dark);
      blade.rotation.z = (b / (aircraft.id === 'comet' ? 4 : 3)) * Math.PI * 2;
      prop.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), accent);
    prop.add(hub);
    prop.position.set(0, 0, -5.1);
    group.add(prop);
  }

  // Landing gear (retracts visually when gear is up) + floats for the Heron.
  const gear = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 6), dark);
    leg.position.set(s * 1.1, -1.3, -0.8);
    gear.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 10), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(s * 1.1, -2.05, -0.8);
    gear.add(wheel);
  }
  const tailWheel = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.25, 8), dark);
  tailWheel.rotation.z = Math.PI / 2;
  tailWheel.position.set(0, -1.4, 5.6);
  gear.add(tailWheel);
  group.add(gear);

  if (aircraft.id === 'heron') {
    for (const s of [-1, 1]) {
      const float = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.45, 6.4, 8), accent);
      float.rotation.x = Math.PI / 2;
      float.position.set(s * 1.5, -1.9, -0.4);
      group.add(float);
    }
  }

  // Navigation lights: red left, green right, white tail.
  const navL = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4444 }));
  navL.position.set(-wingSpan / 2, 0.1, -0.6); group.add(navL);
  const navR = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x44ff66 }));
  navR.position.set(wingSpan / 2, 0.1, -0.6); group.add(navR);

  // Wingtip contrails: two fading trails (THREE.Line with a rolling buffer).
  const trailLen = 60;
  const trailGeoL = new THREE.BufferGeometry();
  const trailPosL = new Float32Array(trailLen * 3);
  trailGeoL.setAttribute('position', new THREE.BufferAttribute(trailPosL, 3));
  const trailL = new THREE.Line(trailGeoL, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  trailL.frustumCulled = false;
  const trailGeoR = new THREE.BufferGeometry();
  const trailPosR = new Float32Array(trailLen * 3);
  trailGeoR.setAttribute('position', new THREE.BufferAttribute(trailPosR, 3));
  const trailR = new THREE.Line(trailGeoR, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }));
  trailR.frustumCulled = false;

  let trailCursor = 0;
  const trailPtsL = Array.from({ length: trailLen }, () => new THREE.Vector3());
  const trailPtsR = Array.from({ length: trailLen }, () => new THREE.Vector3());

  return {
    group, prop, gear,
    trails: [trailL, trailR],
    setGearDown(down) { gear.visible = down; },
    // Called every frame: pose the plane from flight state, spin the prop,
    // and lay down contrail points from the wingtips.
    update(state, dt, elapsed, speedKt) {
      group.position.set(state.x, state.y, state.z);
      group.rotation.set(0, 0, 0);
      group.rotateY(state.heading);
      group.rotateX(state.pitch);
      group.rotateZ(-state.roll);
      const spin = (6 + state.throttle * 42) * dt;
      if (prop) {
        prop.rotation.z += spin;
        if (prop.userData.twin) prop.userData.twin.rotation.z -= spin;
      }
      // Contrails only when fast and airborne.
      const show = state.airborne && speedKt > 70;
      trailL.visible = show; trailR.visible = show;
      if (show) {
        const left = new THREE.Vector3(-wingSpan / 2, 0.1, 1.2).applyEuler(group.rotation).add(group.position);
        const right = new THREE.Vector3(wingSpan / 2, 0.1, 1.2).applyEuler(group.rotation).add(group.position);
        trailPtsL[trailCursor].copy(left);
        trailPtsR[trailCursor].copy(right);
        trailCursor = (trailCursor + 1) % trailLen;
        for (let i = 0; i < trailLen; i++) {
          const p = trailPtsL[(trailCursor + i) % trailLen];
          trailPosL[i * 3] = p.x; trailPosL[i * 3 + 1] = p.y; trailPosL[i * 3 + 2] = p.z;
          const q = trailPtsR[(trailCursor + i) % trailLen];
          trailPosR[i * 3] = q.x; trailPosR[i * 3 + 1] = q.y; trailPosR[i * 3 + 2] = q.z;
        }
        trailGeoL.attributes.position.needsUpdate = true;
        trailGeoR.attributes.position.needsUpdate = true;
      }
    },
  };
}

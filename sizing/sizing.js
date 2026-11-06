/*
 * Initial (conceptual) sizing of a twin-engine transport helicopter.
 * Two concepts: conventional single main rotor + tail rotor ("single")
 *               and coaxial counter-rotating rotors ("coax").
 *
 * Method (first-order, sea-level ISA):
 *  - Weight: fixed-point iteration W0 = (payload + crew + fuel) / (1 - empty-weight fraction)
 *  - Disk loading: statistical fit to AW139 / S-92 class twins, DL = 6.0 * W^0.23 [kg/m^2]
 *  - Rotor solidity from blade loading CT/sigma = 0.08, tip speed 215 m/s
 *  - Power: momentum theory (induced) + blade-element profile + parasite (flat plate f)
 *      * tail rotor ~11 % of main rotor power in hover, falling with speed
 *      * coaxial interference factor 1.16 on induced power in hover, fading with speed
 *  - Installed power = 1.6 x hover power (twin, OEI capability), MCP = 0.85 x installed
 *  - Max speed = min(power-limited, rotor-limited); rotor limit from mu <= 0.40 and
 *    advancing-tip Mach <= 0.92 (applies to conventional/articulated coax too;
 *    lift-offset + pusher compounds are NOT modelled)
 *  - Fuel: SFC 0.30 kg/kWh, cruise for range + 30 min reserve, +3 % taxi/unusable
 *
 * Coordinates for geometry: x aft from nose tip, y to starboard, z up from ground. Units m.
 * Works in the browser (window.RotorSizing) and in Node (module.exports).
 */
(function (root) {
  "use strict";
  const G = 9.81, RHO = 1.225, A_SOUND = 340.3, KT = 0.514444;

  const CONCEPTS = {
    single: { label: "Main + tail rotor", ef: 0.58, fMult: 1.0, NbPerRotor: 5, kint: 1.0, nRotors: 1 },
    coax: { label: "Coaxial", ef: 0.61, fMult: 1.3, NbPerRotor: 4, kint: 1.16, nRotors: 2 },
  };

  const ASSUME = {
    tipSpeed: 215, ctSigma: 0.08, cd0: 0.010, kappa: 1.15, sfc: 0.30,
    paxMass: 100, crewMass: 85, crew: 2, reserveH: 0.5, muMax: 0.40, machAdvMax: 0.92,
    installedOverHover: 1.6, mcpFrac: 0.85, transEff: 0.97, accessories: 1.02,
  };

  function inducedVel(vh, V) {
    // level flight, small disc tilt: v^4 + V^2 v^2 - vh^4 = 0
    const V2 = V * V;
    return Math.sqrt((-V2 + Math.sqrt(V2 * V2 + 4 * vh ** 4)) / 2);
  }

  // Shaft power [W] required at speed V [m/s]
  function powerRequired(V, s) {
    const c = CONCEPTS[s.concept];
    const T = s.W * G;
    const vh = Math.sqrt(T / (2 * RHO * s.A));
    const vi = inducedVel(vh, V);
    const mu = V / s.Vt;
    const kint = 1 + (c.kint - 1) * (vi / vh);
    const Pi = ASSUME.kappa * kint * T * vi;
    const Po = (s.sigma * ASSUME.cd0 / 8) * RHO * s.A * s.Vt ** 3 * (1 + 4.65 * mu * mu);
    const Pp = 0.5 * RHO * V ** 3 * s.f;
    const Pmr = Pi + Po + Pp;
    const Ptr = s.concept === "single" ? Pmr * (0.035 + 0.075 * vi / vh) : 0;
    const total = ((Pmr + Ptr) / ASSUME.transEff) * ASSUME.accessories;
    return { total, Pi, Po, Pp, Ptr };
  }

  function solveSpeedAtPower(s, P) {
    // highest speed where P_req <= P (P_req is bucket-shaped)
    let lo = 30, hi = 140;
    if (powerRequired(hi, s).total <= P) return hi;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (powerRequired(mid, s).total <= P) lo = mid; else hi = mid;
    }
    return lo;
  }

  function size(reqIn) {
    const req = Object.assign({ pax: 16, rangeKm: 800, cruiseKt: 145, concept: "single" }, reqIn || {});
    const c = CONCEPTS[req.concept];
    if (!c) throw new Error("Unknown concept " + req.concept);
    const Wpay = req.pax * ASSUME.paxMass, Wcrew = ASSUME.crew * ASSUME.crewMass;
    let W = 500 * req.pax + 2500;
    let s = {};
    for (let it = 0; it < 80; it++) {
      const DL = 6.0 * Math.pow(W, 0.23);
      const A = W / DL;
      const R = Math.sqrt(A / Math.PI);
      const Vt = ASSUME.tipSpeed;
      const sigma = (W * G) / (RHO * A * Vt * Vt * ASSUME.ctSigma);
      const f = 0.0035 * Math.pow(W, 2 / 3) * c.fMult;
      s = { concept: req.concept, W, DL, A, R, D: 2 * R, Vt, sigma, f };
      const Phov = powerRequired(0, s).total;
      const Pinst = ASSUME.installedOverHover * Phov;
      const Pmcp = ASSUME.mcpFrac * Pinst;
      const Vrotor = Math.min(ASSUME.muMax * Vt, ASSUME.machAdvMax * A_SOUND - Vt);
      const Vpower = solveSpeedAtPower(s, Pmcp);
      const Vmax = Math.min(Vrotor, Vpower);
      const Vcr = Math.min(req.cruiseKt * KT, 0.95 * Vmax);
      const Pcr = powerRequired(Vcr, s).total;
      const tH = (req.rangeKm * 1000) / Vcr / 3600;
      const fuel = ASSUME.sfc * (Pcr / 1000) * (tH + ASSUME.reserveH) * 1.03;
      const Wnew = (Wpay + Wcrew + fuel) / (1 - c.ef);
      Object.assign(s, { Phov, Pinst, Pmcp, Vrotor, Vpower, Vmax, Vcr, Pcr, tH, fuel, Wpay, Wcrew });
      if (Math.abs(Wnew - W) < 0.01) { W = Wnew; break; }
      W = 0.5 * W + 0.5 * Wnew;
    }
    s.W = W;
    s.We = c.ef * W;
    // best endurance / best range speeds
    let Vbe = 0, Pmin = Infinity, Vbr = 0, best = Infinity;
    const curve = [];
    for (let V = 0; V <= 105; V += 1) {
      const P = powerRequired(V, s).total;
      curve.push({ V, P });
      if (P < Pmin) { Pmin = P; Vbe = V; }
      if (V > 10 && P / V < best) { best = P / V; Vbr = V; }
    }
    const Nb = c.NbPerRotor;
    const chord = ((s.sigma / c.nRotors) * Math.PI * s.R) / Nb;
    return Object.assign(s, {
      req, label: c.label, Nb, nRotors: c.nRotors, chord, Vbe, Vbr, Pmin, curve,
      muCr: s.Vcr / s.Vt, machAdvCr: (s.Vt + s.Vcr) / A_SOUND,
      geometry: geometry(Object.assign({}, s, { req, Nb, chord })),
    });
  }

  // ---------------------------------------------------------------- geometry
  function geometry(s) {
    const pax = s.req.pax;
    const fourAbreast = pax > 8;
    const rows = Math.ceil(pax / (fourAbreast ? 4 : 3));
    const cabin = { L: rows * 0.8 + 0.6, W: fourAbreast ? 2.1 : 1.65, H: pax > 8 ? 1.45 : 1.32 };
    const Wf = cabin.W + 0.3, Hf = cabin.H + 0.5;
    const zb = 0.6;                       // belly height above ground
    const zc = zb + Hf / 2;
    const xc0 = 2.6, xc1 = xc0 + cabin.L;  // cabin start / end (cockpit ahead)
    const xh = xc0 + 0.5 * cabin.L;        // main rotor shaft station (near cabin CG)
    const zDeck = zb + Hf;
    const zh = zDeck + 0.8 + 0.5;          // (lower) hub height
    const R = s.R, D = 2 * R;

    const lofts = [], cyls = [], boxes = [], rotors = [];
    const sec = (x, w, h, z) => ({ x, w, h, z });

    lofts.push({
      name: "fuselage", color: "body",
      sections: [
        sec(0.0, 0.3 * Wf, 0.35 * Hf, zb + 0.35 * Hf),
        sec(0.6, 0.75 * Wf, 0.7 * Hf, zb + 0.4 * Hf),
        sec(1.5, 0.95 * Wf, 0.95 * Hf, zc),
        sec(xc0, Wf, Hf, zc),
        sec(xc1, Wf, Hf, zc),
        sec(xc1 + 1.4, 0.55 * Wf, 0.65 * Hf, zc + 0.15 * Hf),
        sec(xc1 + 2.4, 0.3 * Wf, 0.35 * Hf, zc + 0.3 * Hf),
      ],
    });
    // engine / transmission cowling on the roof
    const cowl = (x, w, h) => sec(x, w, h, zDeck - 0.12 + h / 2);
    lofts.push({
      name: "cowling", color: "body",
      sections: [cowl(xc0 - 0.2, 0.45 * Wf, 0.2), cowl(xh - 1.3, 0.85 * Wf, 0.8),
                 cowl(xh + 1.8, 0.8 * Wf, 0.75), cowl(xh + 3.1, 0.35 * Wf, 0.3)],
    });

    const tbx0 = xc1 + 2.3, tbz0 = zc + 0.3 * Hf;
    let xEnd, zTR = null, Rtr = 0, xTR = null;
    const extra = {};
    if (s.concept === "single") {
      Rtr = 0.195 * R;
      xTR = xh + R + Rtr + 0.25;
      zTR = zh - 0.35;
      xEnd = xTR + 0.45;
      lofts.push({
        name: "tailboom", color: "body",
        sections: [sec(tbx0, 0.62, 0.62, tbz0), sec(xTR - 0.9, 0.34, 0.34, zTR - 1.3)],
      });
      // swept vertical fin carrying the tail rotor (approximated as two boxes)
      boxes.push({ name: "fin_lower", color: "body", p: [xTR - 0.55, 0, zTR - 1.05], size: [1.3, 0.2, 0.9] });
      boxes.push({ name: "fin_upper", color: "body", p: [xTR - 0.1, 0, zTR + 0.25], size: [0.9, 0.18, 1.7] });
      boxes.push({ name: "h_stab", color: "body", p: [xTR - 2.0, 0, zTR - 1.15], size: [0.65, 0.22 * D, 0.1] });
      cyls.push({ name: "tr_hub", color: "hub", p: [xTR, -0.2, zTR], axis: "y", r: 0.14, len: 0.3 });
      const sigTr = 0.12, NbTr = 4;
      rotors.push({ name: "tail_rotor", hub: [xTR, -0.38, zTR], axis: "y", R: Rtr, Nb: NbTr,
        chord: (sigTr * Math.PI * Rtr) / NbTr, rootCut: 0.2, dir: 1, rpmScale: 5 });
      extra.Dtr = 2 * Rtr;
      extra.tailArm = xTR - xh;
    } else {
      xEnd = xh + Math.max(0.72 * R, 4.6);
      lofts.push({
        name: "tailboom", color: "body",
        sections: [sec(tbx0, 0.66, 0.6, tbz0), sec(xEnd - 0.2, 0.36, 0.34, tbz0 + 0.1)],
      });
      const span = Math.max(0.3 * D, Wf + 1.5);
      boxes.push({ name: "h_stab", color: "body", p: [xEnd - 0.55, 0, tbz0 + 0.1], size: [0.9, span, 0.1] });
      boxes.push({ name: "fin_port", color: "body", p: [xEnd - 0.5, -span / 2, tbz0 + 0.35], size: [1.1, 0.12, 1.3] });
      boxes.push({ name: "fin_stbd", color: "body", p: [xEnd - 0.5, span / 2, tbz0 + 0.35], size: [1.1, 0.12, 1.3] });
      extra.rotorGap = 0.09 * D;
    }

    // landing gear (retractable tricycle; sponsons house the mains)
    const ySp = Wf / 2 + 0.3, xMain = xc1 - 0.5;
    boxes.push({ name: "sponson_port", color: "body", p: [xMain, -ySp, zb + 0.25], size: [2.4, 0.6, 0.55] });
    boxes.push({ name: "sponson_stbd", color: "body", p: [xMain, ySp, zb + 0.25], size: [2.4, 0.6, 0.55] });
    cyls.push({ name: "nose_wheel", color: "tyre", p: [1.3, 0, 0.3], axis: "y", r: 0.3, len: 0.22 });
    cyls.push({ name: "nose_strut", color: "hub", p: [1.3, 0, (0.3 + zb + 0.2) / 2], axis: "z", r: 0.06, len: zb - 0.1 });
    for (const sgn of [-1, 1]) {
      cyls.push({ name: sgn < 0 ? "main_wheel_port" : "main_wheel_stbd", color: "tyre", p: [xMain, sgn * (ySp + 0.05), 0.34], axis: "y", r: 0.34, len: 0.26 });
    }

    // main rotor(s)
    const rotorGap = s.concept === "coax" ? 0.09 * D : 0;
    const zTop = zh + rotorGap;
    cyls.push({ name: "mast", color: "hub", p: [xh, 0, (zDeck + 0.6 + zTop) / 2], axis: "z", r: 0.16, len: zTop - zDeck - 0.6 + 0.2 });
    cyls.push({ name: "hub_lower", color: "hub", p: [xh, 0, zh], axis: "z", r: 0.38, len: 0.32 });
    rotors.push({ name: s.concept === "coax" ? "rotor_lower" : "main_rotor", hub: [xh, 0, zh], axis: "z",
      R, Nb: s.Nb, chord: s.chord, rootCut: 0.12, dir: 1, rpmScale: 1 });
    if (s.concept === "coax") {
      cyls.push({ name: "hub_upper", color: "hub", p: [xh, 0, zTop], axis: "z", r: 0.38, len: 0.32 });
      rotors.push({ name: "rotor_upper", hub: [xh, 0, zTop], axis: "z", R, Nb: s.Nb, chord: s.chord,
        rootCut: 0.12, dir: -1, rpmScale: 1, phase: 180 / s.Nb });
    }

    const xMin = Math.min(0, xh - R);
    const xMax = Math.max(xEnd, xh + R, xTR !== null ? xTR + Rtr : -Infinity);
    const zMax = Math.max(zTop + 0.2, zTR !== null ? zTR + Rtr : 0);
    const dims = Object.assign({
      Dvalue: xMax - xMin,
      D,
      bodyLength: xEnd,
      overallHeight: zMax,
      bodyWidth: 2 * (ySp + 0.3),
      hubHeight: zh,
      cabin,
      xh, zh, zTop, xEnd, xTR, zTR, Rtr, Wf, Hf, zb, xMin, xMax,
    }, extra);
    return { lofts, cyls, boxes, rotors, dims };
  }

  const api = { size, powerRequired, CONCEPTS, ASSUME, KT, G };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.RotorSizing = api;
})(typeof window !== "undefined" ? window : globalThis);
